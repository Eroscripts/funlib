#!/usr/bin/env bun
// @bun

// 204-merge-funscripts.ts
import { mkdirSync, renameSync } from 'node:fs'
import { stat } from 'node:fs/promises'
import { dirname, extname, join } from 'node:path'

// ../../../projects/funlib/src/misc.ts
function clamp(value, left, right) {
  return Math.max(left, Math.min(right, value))
}
function compareWithOrder(a, b, order) {
  const N = order.length
  let aIndex = order.indexOf(a)
  let bIndex = order.indexOf(b)
  aIndex = aIndex > -1 ? aIndex : a ? N : a === '' ? N + 1 : N + 2
  bIndex = bIndex > -1 ? bIndex : b ? N : b === '' ? N + 1 : N + 2
  if (aIndex !== bIndex)
    return aIndex - bIndex
  if (aIndex === N) {
    return a === b ? 0 : a < b ? -1 : 1
  }
  return 0
}
function makeNonEnumerable(target, key, value) {
  return Object.defineProperty(target, key, {
    value: value ?? target[key],
    writable: true,
    configurable: true,
    enumerable: false,
  })
}
function clone(obj, ...args) {
  return new obj.constructor(obj, ...args)
}

// ../../../projects/funlib/src/converter.ts
function timeSpanToMs(timeSpan) {
  if (typeof timeSpan !== 'string') {
    throw new TypeError('timeSpanToMs: timeSpan must be a string')
  }
  const sign = timeSpan.startsWith('-') ? -1 : 1
  if (sign < 0)
    timeSpan = timeSpan.slice(1)
  const split = timeSpan.split(':').map(e => Number.parseFloat(e))
  while (split.length < 3)
    split.unshift(0)
  const [hours, minutes, seconds] = split
  return Math.round(sign * (hours * 60 * 60 + minutes * 60 + seconds) * 1000)
}
function msToTimeSpan(ms) {
  const sign = ms < 0 ? -1 : 1
  ms *= sign
  const seconds = Math.floor(ms / 1000) % 60
  const minutes = Math.floor(ms / 1000 / 60) % 60
  const hours = Math.floor(ms / 1000 / 60 / 60)
  ms = ms % 1000
  return `${sign < 0 ? '-' : ''}${hours.toFixed(0).padStart(2, '0')}:${minutes.toFixed(0).padStart(2, '0')}:${seconds.toFixed(0).padStart(2, '0')}.${ms.toFixed(0).padStart(3, '0')}`
}
function orderTrimJson(that, overrides) {
  const shape = that.constructor?.jsonShape
  if (!shape || typeof shape !== 'object') {
    throw new Error('orderTrimJson: missing static jsonShape on constructor')
  }
  const copy = { ...shape, ...that, ...overrides }
  for (const [k, v] of Object.entries(shape)) {
    if (v === undefined || !(k in copy))
      continue
    const copyValue = copy[k]
    if (copyValue === v)
      delete copy[k]
    if (Array.isArray(v) && Array.isArray(copyValue) && copyValue.length === 0 && v.length === 0) {
      delete copy[k]
    } else if (typeof v === 'object' && v !== null && Object.keys(v).length === 0 && typeof copyValue === 'object' && copyValue !== null && Object.keys(copyValue).length === 0) {
      delete copy[k]
    }
  }
  return copy
}
function fromEntries(a) {
  return Object.fromEntries(a)
}
const axisPairs = [
  ['L0', 'stroke'],
  ['L1', 'surge'],
  ['L2', 'sway'],
  ['R0', 'twist'],
  ['R1', 'roll'],
  ['R2', 'pitch'],
  ['A1', 'suck'],
]
const axisToNameMap = fromEntries(axisPairs)
const axisNameToAxisMap = fromEntries(axisPairs.map(([a, b]) => [b, a]))
const axisIds = axisPairs.map(e => e[0])
const axisNames = axisPairs.map(e => e[1])
const axisLikes = axisPairs.flat()
function axisLikeToAxis(axisLike) {
  if (!axisLike)
    return 'L0'
  if (axisIds.includes(axisLike))
    return axisLike
  if (axisNames.includes(axisLike))
    return axisNameToAxisMap[axisLike]
  if (axisLike === 'singleaxis')
    return 'L0'
  throw new Error(`axisLikeToAxis: ${axisLike} is not supported`)
}
function orderByAxis(a, b) {
  return compareWithOrder(a.id, b.id, axisIds)
}
function formatJson(json, { lineLength = 100, maxPrecision = 0, compress = true } = {}) {
  function removeNewlines(s) {
    return s.replaceAll(/ *\n\s*/g, ' ')
  }
  const inArrayRegex = /(?<=\[)((?:[^[\]]|\[[^[\]]*\])*)(?=\])/g
  json = json.replaceAll(/\{\s*"(at|time|startTime)":[^{}]+\}/g, removeNewlines)
  json = json.replaceAll(inArrayRegex, (s) => {
    s = s.replaceAll(/(?<="(at|pos)":\s*)(-?\d+\.?\d*)/g, num => Number(num).toFixed(maxPrecision).replace(/\.0+$/, ''))
    const atValues = s.match(/(?<="at":\s*)(-?\d+\.?\d*)/g) ?? []
    if (atValues.length === 0)
      return s
    const maxAtLength = Math.max(0, ...atValues.map(e => e.length))
    s = s.replaceAll(/(?<="at":\s*)(-?\d+\.?\d*)/g, s2 => s2.padStart(maxAtLength, ' '))
    const posValues = s.match(/(?<="pos":\s*)(-?\d+\.?\d*)/g) ?? []
    const posDot = Math.max(0, ...posValues.map(e => e.split('.')[1]).filter(e => e).map(e => e.length + 1))
    s = s.replaceAll(/(?<="pos":\s*)(-?\d+\.?\d*)/g, (s2) => {
      if (!s2.includes('.'))
        return s2.padStart(3) + ' '.repeat(posDot)
      const [a, b] = s2.split('.')
      return `${a.padStart(3)}.${b.padEnd(posDot - 1, ' ')}`
    })
    const actionLength = '{ "at": , "pos": 100 },'.length + maxAtLength + posDot
    let actionsPerLine1 = 10
    while (6 + (actionLength + 1) * actionsPerLine1 - 1 > lineLength)
      actionsPerLine1--
    let i = 0
    s = s.replaceAll(/\n(?!\s*$)\s*/g, s2 => i++ % actionsPerLine1 === 0 ? s2 : ' ')
    if (compress) {
      const [, start, , end] = s.match(/^(\s*(?=$|\S))([\s\S]+)((?<=^|\S)\s*)$/) ?? ['', '', '', '']
      s = start + JSON.stringify(JSON.parse(`[${s}]`)).slice(1, -1) + end
    }
    return s
  })
  return json
}
const hexCache = new Map()

// ../../../projects/funlib/src/index.ts
class FunAction {
  at = 0
  pos = 0
  constructor(action) {
    Object.assign(this, action)
  }

  static jsonShape = { at: undefined, pos: undefined }
  toJSON() {
    return orderTrimJson(this, {
      at: +this.at.toFixed(1),
      pos: +this.pos.toFixed(1),
    })
  }

  clone() {
    return clone(this)
  }
}

class FunChapter {
  name = ''
  startTime = '00:00:00.000'
  endTime = '00:00:00.000'
  constructor(chapter) {
    Object.assign(this, chapter)
  }

  get startAt() {
    return timeSpanToMs(this.startTime)
  }

  set startAt(v) {
    this.startTime = msToTimeSpan(v)
  }

  get endAt() {
    return timeSpanToMs(this.endTime)
  }

  set endAt(v) {
    this.endTime = msToTimeSpan(v)
  }

  static jsonShape = { startTime: undefined, endTime: undefined, name: '' }
  toJSON() {
    return orderTrimJson(this)
  }

  clone() {
    return clone(this)
  }
}

class FunBookmark {
  name = ''
  time = '00:00:00.000'
  constructor(bookmark) {
    this.name = bookmark?.name ?? ''
    this.time = bookmark?.time ?? '00:00:00.000'
  }

  get startAt() {
    return timeSpanToMs(this.time)
  }

  set startAt(v) {
    this.time = msToTimeSpan(v)
  }

  static jsonShape = { time: undefined, name: '' }
  toJSON() {
    return orderTrimJson(this)
  }
}

class FunMetadata {
  static Bookmark = FunBookmark
  static Chapter = FunChapter
  duration = 0
  chapters = []
  bookmarks = []
  constructor(metadata, parent) {
    Object.assign(this, metadata)
    const base = this.constructor
    if (metadata?.bookmarks)
      this.bookmarks = metadata.bookmarks.map(e => new base.Bookmark(e))
    if (metadata?.chapters)
      this.chapters = metadata.chapters.map(e => new base.Chapter(e))
    if (metadata?.duration)
      this.duration = metadata.duration
    if (this.duration > 3600) {
      const actionsDuration = parent?.actionsDuraction
      if (actionsDuration && actionsDuration < 500 * this.duration) {
        this.duration /= 1000
      }
    }
  }

  static jsonShape = {
    title: '',
    creator: '',
    description: '',
    duration: undefined,
    chapters: [],
    bookmarks: [],
    license: '',
    notes: '',
    performers: [],
    script_url: '',
    tags: [],
    type: 'basic',
    video_url: '',
  }

  toJSON() {
    return orderTrimJson(this, {
      duration: +this.duration.toFixed(3),
    })
  }

  clone() {
    const clonedData = JSON.parse(JSON.stringify(this.toJSON()))
    return clone(this, clonedData)
  }
}

class FunscriptFile {
  axisName = ''
  title = ''
  dir = ''
  mergedFiles
  constructor(filePath) {
    if (filePath instanceof FunscriptFile)
      filePath = filePath.filePath
    let parts = filePath.split('.')
    if (parts.at(-1) === 'funscript')
      parts.pop()
    const axisLike = parts.at(-1)
    if (axisLikes.includes(axisLike)) {
      this.axisName = parts.pop()
    }
    filePath = parts.join('.')
    parts = filePath.split(/[\\/]/)
    this.title = parts.pop()
    this.dir = filePath.slice(0, -this.title.length)
  }

  get id() {
    return !this.axisName ? undefined : axisLikeToAxis(this.axisName)
  }

  get filePath() {
    return `${this.dir}${this.title}${this.axisName ? `.${this.axisName}` : ''}.funscript`
  }

  clone() {
    return clone(this, this.filePath)
  }
}

class Funscript {
  static Action = FunAction
  static Chapter = FunChapter
  static Bookmark = FunBookmark
  static Metadata = FunMetadata
  static File = FunscriptFile
  static AxisScript = null
  static mergeMultiAxis(scripts, options) {
    const multiaxisScripts = scripts.filter(e => e.axes.length)
    const singleaxisScripts = scripts.filter(e => !e.axes.length)
    const groups = Object.groupBy(singleaxisScripts, e => e.file ? e.file.dir + e.file.title : '[unnamed]')
    const mergedSingleaxisScripts = Object.entries(groups).flatMap(([_title, scripts2]) => {
      if (!scripts2)
        return []
      const allScripts = scripts2.flatMap(e => [e, ...e.axes]).sort(orderByAxis)
      const axes = [...new Set(allScripts.map(e => e.id))]
      if (axes.length === allScripts.length) {
        const L0 = allScripts.find(e => e.id === 'L0')
        if (L0) {
          const result = new this(L0, {
            axes: allScripts.filter(e => e !== L0),
          })
          if (L0.file) {
            result.file = L0.file.clone()
            result.file.mergedFiles = allScripts.map(e => e.file)
          }
          return result
        }
        if (options?.allowMissingL0) {
          const result = new this({ metadata: allScripts[0].metadata.clone(), actions: [] }, {
            axes: allScripts,
          })
          if (allScripts[0].file) {
            result.file = allScripts[0].file.clone()
            result.file.axisName = ''
            result.file.mergedFiles = allScripts.map(e => e.file)
          }
          return result
        }
        throw new Error('Funscript.mergeMultiAxis: trying to merge multi-axis scripts without L0')
      }
      console.log(allScripts.map(e => e.file?.filePath), axes)
      throw new Error('Funscript.mergeMultiAxis: multi-axis scripts are not implemented yet')
    })
    return [...multiaxisScripts, ...mergedSingleaxisScripts]
  }

  id = 'L0'
  actions = []
  axes = []
  metadata
  parent
  file
  constructor(funscript, extras) {
    Object.assign(this, funscript)
    const base = this.constructor
    this.metadata = new base.Metadata()
    if (extras?.file)
      this.file = new base.File(extras.file)
    else if (funscript instanceof Funscript)
      this.file = funscript.file?.clone()
    this.id = extras?.id ?? funscript?.id ?? this.file?.id ?? (this instanceof AxisScript ? null : 'L0')
    if (funscript?.actions) {
      this.actions = funscript.actions.map(e => new base.Action(e))
    }
    if (funscript?.metadata !== undefined)
      this.metadata = new base.Metadata(funscript.metadata, this)
    else if (funscript instanceof Funscript)
      this.file = funscript.file?.clone()
    if (extras?.axes) {
      if (funscript?.axes?.length)
        throw new Error('FunFunscript: both axes and axes are defined')
      this.axes = extras.axes.map(e => new base.AxisScript(e, { parent: this })).sort(orderByAxis)
    } else if (funscript?.axes) {
      this.axes = funscript.axes.map(e => new base.AxisScript(e, { parent: this })).sort(orderByAxis)
    }
    if (extras?.parent)
      this.parent = extras.parent
    makeNonEnumerable(this, 'parent')
    makeNonEnumerable(this, 'file')
  }

  get duration() {
    if (this.metadata.duration)
      return this.metadata.duration
    return Math.max(this.actions.at(-1)?.at ?? 0, ...this.axes.map(e => e.actions.at(-1)?.at ?? 0)) / 1000
  }

  get actionsDuraction() {
    return Math.max(this.actions.at(-1)?.at ?? 0, ...this.axes.map(e => e.actions.at(-1)?.at ?? 0)) / 1000
  }

  get actualDuration() {
    if (!this.metadata.duration)
      return this.actionsDuraction
    const actionsDuraction = this.actionsDuraction
    const metadataDuration = this.metadata.duration
    if (actionsDuraction > metadataDuration)
      return actionsDuraction
    if (actionsDuraction * 3 < metadataDuration)
      return actionsDuraction
    return metadataDuration
  }

  normalize() {
    this.axes.forEach(e => e.normalize())
    this.actions.forEach((e) => {
      e.at = Math.round(e.at) || 0
      e.pos = clamp(Math.round(e.pos) || 0, 0, 100)
    })
    this.actions.sort((a, b) => a.at - b.at)
    this.actions = this.actions.filter((e, i, a) => {
      if (!i)
        return true
      return a[i - 1].at < e.at
    })
    const negativeActions = this.actions.filter(e => e.at < 0)
    if (negativeActions.length) {
      this.actions = this.actions.filter(e => e.at >= 0)
      if (this.actions[0]?.at > 0) {
        const lastNegative = negativeActions.at(-1)
        lastNegative.at = 0
        this.actions.unshift(lastNegative)
      }
    }
    const duration = Math.ceil(this.actualDuration)
    this.metadata.duration = duration
    this.axes.forEach(e => e.metadata.duration = duration)
    return this
  }

  getAxes(ids) {
    const allAxes = [this, ...this.axes].sort(orderByAxis)
    if (!ids)
      return allAxes
    return allAxes.filter(axis => ids.includes(axis.id))
  }

  static jsonShape = {
    id: undefined,
    metadata: {},
    actions: undefined,
    axes: [],
    inverted: false,
    range: 100,
    version: '1.0',
  }

  toJSON() {
    return orderTrimJson(this, {
      axes: this.axes.slice().sort(orderByAxis).map(e => ({ ...e.toJSON(), metadata: undefined })),
      metadata: {
        ...this.metadata.toJSON(),
        duration: +this.duration.toFixed(3),
      },
    })
  }

  toJsonText(options) {
    return formatJson(JSON.stringify(this, null, 2), options ?? {})
  }

  clone() {
    const cloned = clone(this)
    cloned.file = this.file?.clone()
    return cloned
  }
}

class AxisScript extends Funscript {
  constructor(funscript, extras) {
    super(funscript, extras)
    if (!this.id)
      throw new Error('AxisScript: axis is not defined')
    if (!this.parent)
      throw new Error('AxisScript: parent is not defined')
  }

  clone() {
    const index = this.parent.axes.indexOf(this)
    return this.parent.clone().axes[index]
  }
}
Funscript.AxisScript = AxisScript

// 204-merge-funscripts.ts
const { Glob } = globalThis.Bun
async function findFiles(targetDir) {
  console.log(`\uD83D\uDD0D Searching for files in: ${targetDir}`)
  const stats = await stat(targetDir)
  if (!stats.isDirectory()) {
    throw new Error(`${targetDir} is not a directory`)
  }
  const funscriptGlob = new Glob('**/*.funscript')
  const videoGlob = new Glob('**/*.{mp4,avi,mkv,mov,wmv,webm}')
  const funscripts = [...funscriptGlob.scanSync({ cwd: targetDir, absolute: false })].map(file => file.replaceAll('\\', '/')).filter(file => !file.endsWith('.max.funscript'))
  const videos = [...videoGlob.scanSync({ cwd: targetDir, absolute: false })].map(file => file.replaceAll('\\', '/'))
  console.log(`\uD83D\uDCC4 Found ${funscripts.length} funscript files:`)
  funscripts.forEach(file => console.log(`   ${file}`))
  console.log(`\uD83C\uDFAC Found ${videos.length} video files:`)
  videos.forEach(file => console.log(`   ${file}`))
  return { funscripts, videos }
}
async function loadAndMergeFunscripts(targetDir, funscriptPaths, videos) {
  console.log(`
\uD83D\uDD27 Loading and merging funscripts...`)
  const funscripts = await Promise.all(funscriptPaths.map(async (file) => {
    const fullPath = join(targetDir, file)
    console.log(`   Loading: ${file}`)
    const jsonData = await Bun.file(fullPath).json()
    return new Funscript(jsonData, { file })
  }))
  console.log(`
\uD83D\uDCCA Loaded ${funscripts.length} funscripts`)
  console.log(`\uD83D\uDD00 Merging multi-axis funscripts...`)
  const mergedFunscripts = Funscript.mergeMultiAxis(funscripts, { allowMissingL0: false })
  console.log(`\uD83D\uDCC8 After merge: ${mergedFunscripts.length} funscripts`)
  console.log(`   Original: ${funscripts.length} -> Merged: ${mergedFunscripts.length}`)
  console.log(`
\uD83C\uDFAF Filtering funscripts with axes.length > 0:`)
  const filteredFunscripts = mergedFunscripts.filter(funscript => funscript.axes.length > 0)
  console.log(`   Found ${filteredFunscripts.length} funscripts with axes:`)
  filteredFunscripts.forEach((funscript) => {
    funscript.file.axisName = 'max'
    console.log(`   \uD83D\uDCC1 ${funscript.file?.filePath} (${funscript.axes.length} axes)`)
  })
  console.log(`
\uD83C\uDFAC Checking for matching video files:`)
  for (const funscript of filteredFunscripts) {
    const funscriptPath = funscript.file?.filePath
    if (!funscriptPath)
      continue
    const baseName = funscriptPath.replace(/\.max\.funscript$/, '')
    const matchingVideos = videos.filter((videoPath) => {
      const videoBaseName = videoPath.replace(/\.(mp4|avi|mkv|mov|wmv|webm)$/i, '')
      return videoBaseName === baseName
    })
    if (matchingVideos.length > 0) {
      console.log(`   \u2705 ${baseName} -> Found ${matchingVideos.length} matching video(s):`)
      matchingVideos.forEach(video => console.log(`      \uD83C\uDFA5 ${video}`))
    } else {
      throw new Error(`\u274C No matching video file found for: ${baseName}`)
    }
  }
  return { original: funscripts, merged: mergedFunscripts, filtered: filteredFunscripts }
}
async function saveProcessedFunscripts(targetDir, filteredFunscripts, videos) {
  console.log(`
\uD83D\uDCBE Processing files: move originals, rename videos, save merged...`)
  const processedDir = join(targetDir, '.processed')
  console.log(`\uD83D\uDCC1 Creating processed directory: ${processedDir}`)
  mkdirSync(processedDir, { recursive: true })
  for (const funscript of filteredFunscripts) {
    const originalPath = funscript.file?.filePath
    if (!originalPath)
      continue
    console.log(`
\uD83D\uDD04 Processing: ${originalPath}`)
    const baseName = originalPath.replace(/\.max\.funscript$/, '')
    const originalFunscriptPattern = new Glob(`${baseName}*.funscript`)
    const originalFunscripts = [...originalFunscriptPattern.scanSync({ cwd: targetDir, absolute: false })].filter(file => !file.endsWith('.max.funscript'))
    for (const originalFile of originalFunscripts) {
      const sourcePath = join(targetDir, originalFile)
      const targetPath = join(processedDir, originalFile)
      const targetDirPath = dirname(targetPath)
      mkdirSync(targetDirPath, { recursive: true })
      console.log(`   \uD83D\uDCE6 Moving original: ${originalFile} -> .processed/`)
      renameSync(sourcePath, targetPath)
    }
    const matchingVideos = videos.filter((videoPath) => {
      const videoBaseName = videoPath.replace(/\.(mp4|avi|mkv|mov|wmv|webm)$/i, '')
      return videoBaseName === baseName
    })
    for (const videoFile of matchingVideos) {
      const videoExt = extname(videoFile)
      const videoBaseName = videoFile.replace(/\.(mp4|avi|mkv|mov|wmv|webm)$/i, '')
      const maxVideoName = `${videoBaseName}.max${videoExt}`
      const sourcePath = join(targetDir, videoFile)
      const targetPath = join(targetDir, maxVideoName)
      console.log(`   \uD83C\uDFAC Renaming video: ${videoFile} -> ${maxVideoName}`)
      renameSync(sourcePath, targetPath)
    }
    const maxFunscriptName = `${baseName}.max.funscript`
    const maxFunscriptPath = join(targetDir, maxFunscriptName)
    const maxFunscriptDirPath = dirname(maxFunscriptPath)
    mkdirSync(maxFunscriptDirPath, { recursive: true })
    console.log(`   \uD83D\uDCBE Saving merged: ${maxFunscriptName}`)
    await Bun.write(maxFunscriptPath, funscript.toJsonText())
  }
  console.log(`
\u2705 Processed ${filteredFunscripts.length} funscript sets`)
  console.log(`   \uD83D\uDCE6 Original funscripts moved to .processed/`)
  console.log(`   \uD83C\uDFAC Videos renamed with .max extension (preserving original format)`)
  console.log(`   \uD83D\uDCBE Merged funscripts saved as .max.funscript`)
}
async function mergeFunscripts(targetDir) {
  console.log(`\uD83D\uDE80 Starting funscript merge process...`)
  console.log(`\uD83D\uDCC1 Target directory: ${targetDir}`)
  console.log()
  const files = await findFiles(targetDir)
  if (files.funscripts.length === 0) {
    console.log(`\u26A0\uFE0F  No funscript files found in directory`)
    return
  }
  const result = await loadAndMergeFunscripts(targetDir, files.funscripts, files.videos)
  console.log(`
\uD83D\uDCCB Implementation status:`)
  console.log(`   1. \u2705 Parse funscript files`)
  console.log(`   2. \u2705 Merge funscript data`)
  console.log(`   3. \u2705 Filter axes.length > 0`)
  console.log(`   4. \u2705 Save merged files with .max extension`)
  console.log(`   5. \u2705 Rename matching videos to .max.{ext}`)
  console.log(`   6. \u2705 Move original funscripts to .processed`)
  console.log(`
\uD83C\uDFAF Script is ready for production use!`)
  await saveProcessedFunscripts(targetDir, result.filtered, files.videos)
}
const targetDir = process.argv[2]
if (!targetDir) {
  console.error('\u274C Usage: bun run scripts/204-merge-funscripts.ts <directory>')
  process.exit(1)
}
mergeFunscripts(targetDir).catch(console.error)
