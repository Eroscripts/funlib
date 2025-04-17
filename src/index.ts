import type { SvgOptions } from './svg'
import { axisLikeToAxis, fileNameToInfo, formatJson, msToTimeSpan, orderByAxis, orderTrimJson, rawToValue, secondsToDuration, timeSpanToMs, valueToRaw } from './converter'
import { actionsAverageSpeed, actionsRequiredMaxSpeed } from './manipulations'
import { defineValue, speedBetween } from './misc'
import { toSvgElement } from './svg'

export { speedToOklch } from './converter'
export { handySmooth } from './manipulations'

export interface JsonAction {
  at: ms
  pos: axisValue
}

interface ActionLike {
  axis?: axis
  at: ms
  pos: axisValue
}

export class FunAction implements ActionLike {
  axis?: axis
  prevAction?: FunAction
  nextAction?: FunAction
  at: ms = 0
  pos: axisValue = 0

  constructor(action?: ActionLike, extras?: { axis?: axis }) {
    Object.assign(this, action)
    defineValue(this, 'axis', extras?.axis ?? (action as FunAction)?.axis)
    defineValue(this, 'prevAction')
    defineValue(this, 'nextAction')
  }

  /** speed from prev to this */
  get speedTo(): speed {
    if (!this.prevAction) return 0 as speed
    return speedBetween(this.prevAction, this)
  }

  /** speed from this to next */
  get speedFrom(): speed {
    if (!this.nextAction) return 0 as speed
    return speedBetween(this, this.nextAction)
  }

  get isPeak(): -1 | 0 | 1 {
    const { speedTo, speedFrom } = this
    // if there is no prev or next action, it's a peak because we need peaks at corners
    if (!this.prevAction && !this.nextAction) return 1
    if (!this.prevAction) return speedFrom < 0 ? 1 : 1
    if (!this.nextAction) return speedTo > 0 ? -1 : -1

    if (Math.sign(speedTo) === Math.sign(speedFrom)) return 0

    if (speedTo > speedFrom) return 1
    if (speedTo < speedFrom) return -1
    return 0
  }

  /** Time difference to next action in milliseconds */
  get datNext(): ms {
    if (!this.nextAction) return 0 as ms
    return (this.nextAction.at - this.at) as ms
  }

  get dposNext(): axisValue {
    if (!this.nextAction) return 0 as axisValue
    return this.nextAction.pos - this.pos
  }

  get time(): seconds { return this.at / 1000 }
  set time(v: seconds) { this.at = v * 1000 }

  get value(): axisValue { return this.pos }
  set value(v: axisValue) { this.pos = v }

  get norm(): axisNorm { return this.value / 100 }
  set norm(v: axisNorm) { this.value = v * 100 }

  get raw(): axisRaw { return valueToRaw(this.value, this.axis) }
  set raw(v: axisRaw) { this.value = rawToValue(v, this.axis) }

  static jsonOrder = { at: undefined, pos: undefined }
  toJSON() {
    return orderTrimJson({
      ...this,
      at: +this.at.toFixed(1),
      pos: +this.pos.toFixed(1),
      axis: undefined,
    }, FunAction.jsonOrder, {})
  }

  static cloneList(list: ActionLike[], extras?: { axis?: axis }) {
    const newList = list.map(e => new FunAction(e, { axis: e.axis, ...extras }))
    FunAction.linkList(newList)
    return newList
  }

  static linkList(list: FunAction[]) {
    for (let i = 1; i < list.length; i++) {
      list[i].prevAction = list[i - 1]
      list[i - 1].nextAction = list[i]
    }
    return list
  }
}

export class FunChapter implements JsonChapter {
  name: chapterName = ''
  startTime: timeSpan = '00:00:00.000'
  endTime: timeSpan = '00:00:00.000'

  constructor(chapter?: JsonChapter) {
    this.name = chapter?.name ?? ''
    this.startTime = chapter?.startTime ?? '00:00:00.000'
    this.endTime = chapter?.endTime ?? '00:00:00.000'
  }

  get start(): seconds { return timeSpanToMs(this.startTime) / 1000 }
  set start(v: seconds) { this.startTime = msToTimeSpan(v * 1000) }
  get end(): seconds { return timeSpanToMs(this.endTime) / 1000 }
  set end(v: seconds) { this.endTime = msToTimeSpan(v * 1000) }

  get startMs(): ms { return timeSpanToMs(this.startTime) }
  set startMs(v: ms) { this.startTime = msToTimeSpan(v) }
  get endMs(): ms { return timeSpanToMs(this.endTime) }
  set endMs(v: ms) { this.endTime = msToTimeSpan(v) }

  static jsonOrder = { startTime: undefined, endTime: undefined, name: undefined }
  toJSON() {
    return orderTrimJson(this, FunChapter.jsonOrder, {
      name: '',
    })
  }
}

export class FunBookmark {
  name: string = ''
  time: timeSpan = '00:00:00.000'

  constructor(bookmark?: { name: string, time: timeSpan }) {
    this.name = bookmark?.name ?? ''
    this.time = bookmark?.time ?? '00:00:00.000'
  }

  get start(): seconds { return timeSpanToMs(this.time) / 1000 }
  set start(v: seconds) { this.time = msToTimeSpan(v * 1000) }
  get startMs(): ms { return timeSpanToMs(this.time) }
  set startMs(v: ms) { this.time = msToTimeSpan(v) }

  static jsonOrder = { time: undefined, name: undefined }
  toJSON() {
    return orderTrimJson(this, FunBookmark.jsonOrder, {
      name: '',
    })
  }
}

export class FunMetadata implements JsonMetadata {
  duration: seconds = 0
  chapters: FunChapter[] = []
  bookmarks: FunBookmark[] = []
  // declare durationIsExact: boolean

  constructor(metadata?: JsonMetadata) {
    Object.assign(this, metadata)
    if (metadata?.bookmarks) this.bookmarks = metadata.bookmarks.map(e => new FunBookmark(e))
    if (metadata?.chapters) this.chapters = metadata.chapters.map(e => new FunChapter(e))
    if (metadata?.duration) this.duration = metadata.duration
    if (this.duration > 36_000) // 10 hours
      this.duration /= 1000
    // defineValue(this, 'durationIsExact', !!((metadata as any)?.durationIsExact))
  }

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
  }

  static jsonOrder = {
    title: undefined,
    creator: undefined,
    description: undefined,
    duration: undefined,
    chapters: undefined,
    bookmarks: undefined,
  }

  toJSON() {
    return orderTrimJson({
      ...this,
      duration: +this.duration.toFixed(3),
    }, FunMetadata.jsonOrder, FunMetadata.emptyJson)
  }
}

export class Funscript implements JsonFunscript {
  axis?: axis
  actions: FunAction[] = []
  axes: FunSecondaryScript[] = []
  metadata: FunMetadata = new FunMetadata()
  filePath: string = ''
  declare parent?: Funscript

  declare _isForHandy?: string

  constructor(funscript?: JsonFunscript, extras?: { axis?: axisLike, filePath?: string, axes?: JsonFunscript[] }) {
    Object.assign(this, funscript)
    defineValue(this, 'parent')

    if (extras?.axis) this.axis = axisLikeToAxis(extras.axis)
    if (funscript?.actions) {
      this.actions = FunAction.cloneList(funscript.actions, { axis: this.axis })
    }
    if (funscript?.metadata) this.metadata = new FunMetadata(funscript.metadata)
    if (extras?.filePath) this.filePath = extras.filePath

    if (extras?.axes) {
      if (funscript?.axes?.length) throw new Error('FunFunscript: both axes and axes are defined')
      this.axes = extras.axes.map(e => new FunSecondaryScript(e, { parent: this }))
    }
    else if (funscript?.axes) {
      this.axes = funscript.axes.map(e => new FunSecondaryScript(e, { parent: this }))
    }
  }

  set id(v: axisLike) { this.axis = axisLikeToAxis(v) }
  get id(): axis { return this.axis ?? 'L0' }

  static emptyJson = {
    axes: [],
    metadata: {},
    inverted: false,
    range: 100,
    version: '1.0',
  }

  static jsonOrder = {
    metadata: undefined,
    actions: undefined,
    axes: undefined,
  }

  toJSON() {
    return orderTrimJson({
      ...this,
      axis: undefined,
      filePath: undefined,
      metadata: {
        title: this.filePath ? fileNameToInfo(this.filePath).title : '',
        ...this.metadata.toJSON(),
      },
      axes: this.axes.slice().sort(orderByAxis),
    }, Funscript.jsonOrder, Funscript.emptyJson)
  }

  toJsonText() {
    return formatJson(JSON.stringify(this, null, 2))
  }

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

  getAxis(axis?: axisLike): Funscript {
    if (!axis) return this
    if (axis === 'L0' && !this.axes.find(e => e.id === 'L0')) return this
    return this.axes.find(e => e.id === axis)!
  }

  toStats() {
    const MaxSpeed = actionsRequiredMaxSpeed(this.actions)
    const AvgSpeed = actionsAverageSpeed(this.actions)

    return {
      Duration: secondsToDuration(this.actualDuration),
      Actions: this.actions.filter(e => e.isPeak).length,
      MaxSpeed: Math.round(MaxSpeed),
      AvgSpeed: Math.round(AvgSpeed),
    }
  }

  toSvgElement(ops: SvgOptions = {}) {
    return toSvgElement([this], { ...ops })
  }

  static toSvgElement(scripts: Funscript[], ops: SvgOptions) {
    return toSvgElement(scripts, ops)
  }

  /** merge multi-axis scripts into one */
  static mergeMultiAxis(scripts: Funscript[]): Funscript[] {
    function scriptName(s: Funscript) {
      return fileNameToInfo(s.filePath!).fileName
    }
    const baseNames = [...new Set(scripts.map(scriptName))]
    return baseNames.flatMap((name) => {
      let ss = scripts.filter(s => scriptName(s) === name)
      const multiAxis = ss.filter(s => s.axes?.length)
      ss = ss.filter(s => !s.axes?.length)
      if (ss.length === 0) return multiAxis

      const primary = ss.find(s => fileNameToInfo(s.filePath).primary) ?? ss[0]
      ss.splice(ss.indexOf(primary), 1)
      ss.map(e => e.id = e.filePath!.split('.').at(-2)! as any)
      ss.map(e => e.parent = primary)
      ss.sort(orderByAxis)
      return [...multiAxis, new Funscript(primary, {
        axis: fileNameToInfo(primary.filePath).axis,
        axes: ss,
        filePath: primary.filePath,
      })]
    })
  }

  /**
   * Sets actions while ensuring they have proper prev/next references.
   */
  setActions(actions: ActionLike[]) {
    this.actions = FunAction.cloneList(actions, { axis: this.axis })
  }

  normalize() {
    this.axes.map(e => e.normalize())
    this.actions.forEach((e) => {
      e.at = Math.round(e.at) || 0
      e.pos = Math.round(e.pos) || 0
      e.pos = Math.max(0, Math.min(e.pos, 100))
    })
    this.actions.sort((a, b) => a.at - b.at)
    FunAction.linkList(this.actions)

    const duration = this.actualDuration
    this.metadata.duration = duration
    this.axes.forEach(e => e.metadata.duration = duration)
    return this
  }

  clone() {
    return new Funscript(this)
  }
}

export class FunSecondaryScript extends Funscript {
  declare axis: axis
  declare parent?: Funscript

  constructor(funscript?: JsonFunscript & { id?: axis }, extras?: { axis?: axisLike, filePath?: string, metadata?: FunMetadata, parent?: Funscript }) {
    super(funscript, extras)

    if (funscript && !this.axis && 'id' in funscript) this.id = axisLikeToAxis(funscript.id as any)
    if (!this.axis) throw new Error('FunSecondaryScript: axis is not defined')
    if (extras?.metadata) this.metadata = extras.metadata
    if (extras?.parent) this.parent = extras.parent
  }

  static jsonOrder = {
    id: undefined,
    axis: undefined,
    actions: undefined,
    axes: undefined,
    metadata: undefined,
  }

  toJSON(): Record<string, any> {
    return orderTrimJson({
      ...super.toJSON(),
      filePath: undefined,
      id: this.id,
      metadata: undefined,
    }, FunSecondaryScript.jsonOrder, FunSecondaryScript.emptyJson)
  }
}

export * from './types'
