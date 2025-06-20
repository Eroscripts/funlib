import type { axis, axisLike, chapterName, JsonAction, JsonChapter, JsonFunscript, JsonMetadata, ms, pos, seconds, timeSpan } from './types'
import { axisLikes, axisLikeToAxis, formatJson, msToTimeSpan, orderByAxis, orderTrimJson, timeSpanToMs } from './converter'
import { clamp, clone, makeNonEnumerable } from './misc'

export class FunAction implements JsonAction {
  // --- Public Instance Properties ---
  at: ms = 0
  pos: pos = 0

  // --- Constructor ---
  constructor(action?: JsonAction) {
    Object.assign(this, action)
  }

  // --- JSON & Clone Section ---
  static jsonOrder = { at: undefined, pos: undefined }

  toJSON() {
    return orderTrimJson({
      ...this,
      at: +this.at.toFixed(1),
      pos: +this.pos.toFixed(1),
    }, FunAction.jsonOrder, {})
  }

  clone(): this {
    return clone(this)
  }
}

export class FunChapter implements JsonChapter {
  name: chapterName = ''
  startTime: timeSpan = '00:00:00.000'
  endTime: timeSpan = '00:00:00.000'

  constructor(chapter?: JsonChapter) {
    // this.startTime = chapter?.startTime ?? '00:00:00.000'
    // this.endTime = chapter?.endTime ?? '00:00:00.000'
    // this.name = chapter?.name ?? ''
    Object.assign(this, chapter)
  }

  get startAt(): ms { return timeSpanToMs(this.startTime) }
  set startAt(v: ms) { this.startTime = msToTimeSpan(v) }
  get endAt(): ms { return timeSpanToMs(this.endTime) }
  set endAt(v: ms) { this.endTime = msToTimeSpan(v) }

  static jsonOrder = { startTime: undefined, endTime: undefined, name: undefined }
  toJSON() {
    return orderTrimJson(this, FunChapter.jsonOrder, {
      name: '',
    })
  }

  clone(): this {
    return clone(this)
  }
}

export class FunBookmark {
  name: string = ''
  time: timeSpan = '00:00:00.000'

  constructor(bookmark?: { name: string, time: timeSpan }) {
    this.name = bookmark?.name ?? ''
    this.time = bookmark?.time ?? '00:00:00.000'
  }

  get startAt(): ms { return timeSpanToMs(this.time) }
  set startAt(v: ms) { this.time = msToTimeSpan(v) }

  static jsonOrder = { time: undefined, name: undefined }
  toJSON() {
    return orderTrimJson(this, FunBookmark.jsonOrder, {
      name: '',
    })
  }
}

export class FunMetadata implements JsonMetadata {
  // --- Static Class References (for extensibility) ---
  static Bookmark = FunBookmark
  static Chapter = FunChapter

  // --- Public Instance Properties ---
  duration: seconds = 0
  chapters: FunChapter[] = []
  bookmarks: FunBookmark[] = []
  // TODO: Add other metadata properties here if they should be public
  // declare durationIsExact: boolean

  // --- Constructor ---
  constructor(metadata?: JsonMetadata, parent?: Funscript) {
    Object.assign(this, metadata)
    const base = this.constructor as typeof FunMetadata
    if (metadata?.bookmarks) this.bookmarks = metadata.bookmarks.map(e => new base.Bookmark(e))
    if (metadata?.chapters) this.chapters = metadata.chapters.map(e => new base.Chapter(e))
    if (metadata?.duration) this.duration = metadata.duration
    if (this.duration > 3600) { // 1 hour
      const actionsDuration = parent?.actionsDuraction
      if (actionsDuration && actionsDuration < 500 * this.duration) {
        this.duration /= 1000
      }
    }
  }

  // --- JSON & Clone Section ---
  static emptyJson = {
    bookmarks: [],
    chapters: [],
    creator: '',
    description: '',
    license: '',
    notes: '',
    performers: [],
    script_url: '',
    tags: [],
    title: '',
    type: 'basic',
    video_url: '',
    // Need to list all potential metadata fields here
  }

  static jsonOrder = {
    title: undefined,
    creator: undefined,
    description: undefined,
    duration: undefined,
    chapters: undefined,
    bookmarks: undefined,
    // Need to list all potential metadata fields here in desired order
    // TODO: add the rest
  }

  toJSON() {
    return orderTrimJson({
      ...this,
      duration: +this.duration.toFixed(3),
    }, FunMetadata.jsonOrder, FunMetadata.emptyJson)
  }

  clone(): this {
    // Create a deep clone to avoid modifying the original's chapters/bookmarks
    const clonedData = JSON.parse(JSON.stringify(this.toJSON()))
    return clone(this, clonedData)
  }
}

export class FunscriptFile {
  axisName: axisLike = '' as never
  title: string = ''
  dir: string = ''
  mergedFiles?: FunscriptFile[]

  constructor(filePath: string | FunscriptFile) {
    if (filePath instanceof FunscriptFile) filePath = filePath.filePath
    let parts = filePath.split('.')
    if (parts.at(-1) === 'funscript') parts.pop()
    const axisLike = parts.at(-1)
    if (axisLikes.includes(axisLike as any)) {
      this.axisName = parts.pop()! as any
    }
    filePath = parts.join('.')
    parts = filePath.split(/[\\/]/)
    this.title = parts.pop()!
    this.dir = filePath.slice(0, -this.title.length)
  }

  get id(): axis | undefined {
    return !this.axisName ? undefined : axisLikeToAxis(this.axisName)
  }

  get filePath(): string {
    return `${this.dir}${this.title}${this.axisName ? `.${this.axisName}` : ''}.funscript`
  }

  clone(): this {
    return clone(this, this.filePath)
  }
}

export class Funscript implements JsonFunscript {
  // --- Static Class References (for extensibility) ---
  static Action = FunAction
  static Chapter = FunChapter
  static Bookmark = FunBookmark
  static Metadata = FunMetadata
  static File = FunscriptFile
  static AxisScript = null! as typeof AxisScript
  // AxisScript will be set after its declaration

  /** merge multi-axis scripts into one */
  static mergeMultiAxis(scripts: Funscript[]): Funscript[] {
    const multiaxisScripts = scripts.filter(e => e.axes.length)
    const singleaxisScripts = scripts.filter(e => !e.axes.length)

    const groups = Object.groupBy(singleaxisScripts, e => e.file?.title ?? '[unnamed]')
    const mergedSingleaxisScripts = Object.entries(groups).flatMap<Funscript>(([_title, scripts]) => {
      if (!scripts) return []

      // base case: no duplicate axes
      const allScripts = scripts.flatMap(e => [e, ...e.axes]).sort(orderByAxis)
      const axes = [...new Set(allScripts.map(e => e.id))]
      if (axes.length === allScripts.length) {
        // merge them all into a single script
        const L0 = allScripts.find(e => e.id === 'L0')
        if (!L0) throw new Error('Funscript.mergeMultiAxis: trying to merge multi-axis scripts without L0')
        const result = new this(L0, {
          axes: allScripts.filter(e => e !== L0),
        })
        if (L0.file) {
          result.file = L0.file.clone()
          result.file.mergedFiles = allScripts.map(e => e.file!)
        }
        return result
      }
      throw new Error('Funscript.mergeMultiAxis: multi-axis scripts are not implemented yet')
    })
    return [...multiaxisScripts, ...mergedSingleaxisScripts]
  }

  // --- Public Instance Properties ---
  id: axis = 'L0'
  actions: FunAction[] = []
  axes: AxisScript[] = []
  metadata!: FunMetadata

  // --- Non-enumerable Properties ---
  parent?: Funscript
  file?: FunscriptFile

  // --- Constructor ---
  constructor(
    funscript?: JsonFunscript,
    extras?: { id?: axis, file?: string, axes?: JsonFunscript[], parent?: Funscript },
  ) {
    Object.assign(this, funscript)

    const base = this.constructor as typeof Funscript
    this.metadata = new base.Metadata()

    if (extras?.file) this.file = new base.File(extras.file)
    else if (funscript instanceof Funscript) this.file = funscript.file?.clone()
    // prefer file > funscript > extras
    this.id = extras?.id ?? funscript?.id ?? this.file?.id ?? (this instanceof AxisScript ? null! : 'L0')

    if (funscript?.actions) {
      this.actions = funscript.actions.map(e => new base.Action(e))
    }
    if (funscript?.metadata !== undefined) this.metadata = new base.Metadata(funscript.metadata, this)
    else if (funscript instanceof Funscript) this.file = funscript.file?.clone()

    if (extras?.axes) {
      if (funscript?.axes?.length) throw new Error('FunFunscript: both axes and axes are defined')
      this.axes = extras.axes.map(e => new base.AxisScript(e, { parent: this })).sort(orderByAxis)
    }
    else if (funscript?.axes) {
      this.axes = funscript.axes.map(e => new base.AxisScript(e, { parent: this })).sort(orderByAxis)
    }
    if (extras?.parent) this.parent = extras.parent

    makeNonEnumerable(this, 'parent')
    makeNonEnumerable(this, 'file')
  }

  // --- Getters/Setters ---

  get duration(): seconds {
    if (this.metadata.duration) return this.metadata.duration
    return Math.max(
      this.actions.at(-1)?.at ?? 0,
      ...this.axes.map(e => e.actions.at(-1)?.at ?? 0),
    ) / 1000
  }

  get actionsDuraction(): seconds {
    return Math.max(
      this.actions.at(-1)?.at ?? 0,
      ...this.axes.map(e => e.actions.at(-1)?.at ?? 0),
    ) / 1000
  }

  get actualDuration(): seconds {
    if (!this.metadata.duration) return this.actionsDuraction
    const actionsDuraction = this.actionsDuraction
    const metadataDuration = this.metadata.duration
    if (actionsDuraction > metadataDuration) return actionsDuraction
    if (actionsDuraction * 3 < metadataDuration) return actionsDuraction
    return metadataDuration
  }

  // --- Public Instance Methods ---

  normalize() {
    this.axes.forEach(e => e.normalize())

    this.actions.forEach((e) => {
      e.at = Math.round(e.at) || 0
      e.pos = clamp(Math.round(e.pos) || 0, 0, 100)
    })
    this.actions.sort((a, b) => a.at - b.at)
    this.actions = this.actions.filter((e, i, a) => {
      if (!i) return true
      return a[i - 1].at < e.at
    })
    const negativeActions = this.actions.filter(e => e.at < 0)
    if (negativeActions.length) {
      this.actions = this.actions.filter(e => e.at >= 0)
      if (this.actions[0]?.at > 0) {
        const lastNegative = negativeActions.at(-1)!
        lastNegative.at = 0
        this.actions.unshift(lastNegative)
      }
    }

    const duration = Math.ceil(this.actualDuration)
    this.metadata.duration = duration
    this.axes.forEach(e => e.metadata.duration = duration)
    return this
  }

  getAxes(ids?: axis[]): Funscript[] {
    const allAxes = [this, ...this.axes].sort(orderByAxis)
    if (!ids) return allAxes
    return allAxes.filter(axis => ids.includes(axis.id))
  }

  // --- JSON & Clone Section ---
  static emptyJson = {
    axes: [],
    metadata: {},
    inverted: false,
    range: 100,
    version: '1.0',
  }

  static jsonOrder = {
    id: undefined,
    metadata: undefined,
    actions: undefined,
    axes: undefined,
  }

  toJSON(): Record<string, any> {
    return orderTrimJson({
      ...this,
      axes: this.axes.slice().sort(orderByAxis).map(e => ({ ...e.toJSON(), metadata: undefined })),
      metadata: {
        ...this.metadata.toJSON(),
        duration: +this.duration.toFixed(3),
      },
    }, Funscript.jsonOrder, Funscript.emptyJson)
  }

  toJsonText(options?: Parameters<typeof formatJson>[1]) {
    return formatJson(JSON.stringify(this, null, 2), options ?? {})
  }

  clone(): this {
    const cloned = clone(this)
    cloned.file = this.file?.clone()
    return cloned
  }
}

export class AxisScript extends Funscript {
  declare id: axis
  declare axes: []
  declare parent: Funscript

  constructor(
    funscript?: JsonFunscript,
    extras?: { id?: axis, filePath?: string, axes?: JsonFunscript[], parent?: Funscript },
  ) {
    super(funscript, extras)

    if (!this.id) throw new Error('AxisScript: axis is not defined')
    if (!this.parent) throw new Error('AxisScript: parent is not defined')
  }

  clone(): this {
    const index = this.parent.axes.indexOf(this)
    return this.parent.clone().axes[index]! as any
  }
}

// Set the AxisScript reference after it's declared
Funscript.AxisScript = AxisScript

// export general types that are always needed. This is not a barrel file.
export type * from './types'
