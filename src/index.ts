import type { SvgOptions } from './svg'
import type { axis, axisLike, chapterName, JsonAction, JsonChapter, JsonFunscript, JsonMetadata, ms, pos, seconds, speed, TCodeTuple, timeSpan } from './types'
import { axisLikes, axisLikeToAxis, formatJson, msToTimeSpan, orderByAxis, orderTrimJson, secondsToDuration, TCodeList, timeSpanToMs } from './converter'
import { actionsAverageSpeed, actionsRequiredMaxSpeed } from './manipulations'
import { clamp, clamplerp, speedBetween } from './misc'
import { svgDefaultOptions, toSvgElement } from './svg'

export { speedToOklch } from './converter'
export { handySmooth } from './manipulations'
export * from './types'

export class FunAction implements JsonAction {
  // --- Static Methods ---
  static linkList(list: FunAction[], extras: { parent?: Funscript | true }) {
    if (extras?.parent === true) extras.parent = list[0]?.parent
    for (let i = 1; i < list.length; i++) {
      list[i].#prevAction = list[i - 1]
      list[i - 1].#nextAction = list[i]
      if (extras?.parent) list[i].#parent = extras.parent
    }
    return list
  }

  // --- Public Instance Properties ---
  at: ms = 0
  pos: pos = 0

  // --- Private Instance Properties ---
  #parent?: Funscript
  #prevAction?: FunAction
  #nextAction?: FunAction

  // --- Constructor ---
  constructor(action?: JsonAction, extras?: { parent?: Funscript }) {
    Object.assign(this, action)
    this.#parent = extras && 'parent' in extras
      ? extras.parent
      : (action instanceof FunAction ? action.#parent : undefined)
  }

  // --- Getters ---
  get nextAction(): FunAction | undefined { return this.#nextAction }
  get prevAction(): FunAction | undefined { return this.#prevAction }
  get parent(): Funscript | undefined { return this.#parent }

  /** speed from prev to this */
  get speedTo(): speed {
    return speedBetween(this.#prevAction, this)
  }

  /** speed from this to next */
  get speedFrom(): speed {
    return speedBetween(this, this.#nextAction)
  }

  get isPeak(): -1 | 0 | 1 {
    const { speedTo, speedFrom } = this
    // if there is no prev or next action, it's a peak because we need peaks at corners
    if (!this.#prevAction && !this.#nextAction) return 1
    if (!this.#prevAction) return speedFrom < 0 ? 1 : 1
    if (!this.#nextAction) return speedTo > 0 ? -1 : -1

    if (Math.sign(speedTo) === Math.sign(speedFrom)) return 0

    if (speedTo > speedFrom) return 1
    if (speedTo < speedFrom) return -1
    return 0
  }

  /** Time difference to next action in milliseconds */
  get datNext(): ms {
    if (!this.#nextAction) return 0 as ms
    return (this.#nextAction.at - this.at) as ms
  }

  get datPrev(): ms {
    if (!this.#prevAction) return 0 as ms
    return (this.at - this.#prevAction.at) as ms
  }

  get dposNext(): pos {
    if (!this.#nextAction) return 0 as pos
    return this.#nextAction.pos - this.pos
  }

  get dposPrev(): pos {
    if (!this.#prevAction) return 0 as pos
    return this.pos - this.#prevAction.pos
  }

  // get raw(): axisRaw { return valueToRaw(this.value, this.#parent?.id) }
  // set raw(v: axisRaw) { this.value = rawToValue(v, this.#parent?.id) }

  // --- Public Instance Methods ---
  clerpAt(at: ms): pos {
    if (at === this.at) return this.pos
    if (at < this.at) {
      if (!this.#prevAction) return this.pos
      return clamplerp(at, this.#prevAction.at, this.at, this.#prevAction.pos, this.pos)
    }
    if (at > this.at) {
      if (!this.#nextAction) return this.pos
      return clamplerp(at, this.at, this.#nextAction.at, this.pos, this.#nextAction.pos)
    }
    return this.pos
  }

  // --- JSON & Clone Section ---
  static jsonOrder = { at: undefined, pos: undefined }
  static cloneList(list: JsonAction[], extras: { parent?: Funscript | true }) {
    const parent = extras?.parent === true ? (list[0] as FunAction)?.parent : extras?.parent
    const newList = list.map(e => new FunAction(e, { parent }))
    return FunAction.linkList(newList, extras)
  }

  toJSON() {
    return orderTrimJson({
      ...this,
      at: +this.at.toFixed(1),
      pos: +this.pos.toFixed(1),
    }, FunAction.jsonOrder, {})
  }

  clone(): FunAction {
    // NOTE: This creates a shallow clone. The private #prevAction, #nextAction
    // will be undefined in the new clone. They need to be relinked if the clone
    // is part of a list (e.g., using FunAction.linkList).
    return new FunAction(this, { parent: this.#parent })
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
  // --- Public Instance Properties ---
  duration: seconds = 0
  chapters: FunChapter[] = []
  bookmarks: FunBookmark[] = []
  // TODO: Add other metadata properties here if they should be public
  // declare durationIsExact: boolean

  // --- Constructor ---
  constructor(metadata?: JsonMetadata, parent?: Funscript) {
    Object.assign(this, metadata)
    if (metadata?.bookmarks) this.bookmarks = metadata.bookmarks.map(e => new FunBookmark(e))
    if (metadata?.chapters) this.chapters = metadata.chapters.map(e => new FunChapter(e))
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

  clone(): FunMetadata {
    // Create a deep clone to avoid modifying the original's chapters/bookmarks
    const clonedData = JSON.parse(JSON.stringify(this.toJSON()))
    return new FunMetadata(clonedData)
  }
}

export class FunscriptFile {
  axisName: axisLike = '' as never
  title: string = ''
  dir: string = ''
  mergedFiles?: FunscriptFile[]

  constructor(filePath: string) {
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

  clone() {
    return new FunscriptFile(this.filePath)
  }
}

export class Funscript implements JsonFunscript {
  // --- Static Methods ---
  static svgDefaultOptions = svgDefaultOptions

  static toSvgElement(scripts: Funscript[], ops: SvgOptions): string {
    return toSvgElement(scripts, ops)
  }

  /** merge multi-axis scripts into one */
  static mergeMultiAxis(scripts: Funscript[]): Funscript[] {
    const multiaxisScripts = scripts.filter(e => e.axes.length)
    const singleaxisScripts = scripts.filter(e => !e.axes.length)

    const groups = Object.groupBy(singleaxisScripts, e => e.#file?.title ?? '[unnamed]')
    const mergedSingleaxisScripts = Object.entries(groups).flatMap<Funscript>(([_title, scripts]) => {
      if (!scripts) return []
      // base case: no duplicate axes
      const allScripts = scripts.flatMap(e => [e, ...e.axes]).sort(orderByAxis)
      const axes = [...new Set(allScripts.map(e => e.id))]
      if (axes.length === allScripts.length) {
        // merge them all into a single script
        const L0 = allScripts.find(e => e.id === 'L0')
        if (!L0) throw new Error('Funscript.mergeMultiAxis: L0 is not defined')
        const base = L0.clone()
        base.axes = allScripts.filter(e => e.id !== 'L0').map(e => new AxisScript(e, { parent: base })) as any[]
        if (base.#file) base.#file.mergedFiles = allScripts.map(e => e.#file!)
        return base
      }
      throw new Error('Funscript.mergeMultiAxis: multi-axis scripts are not implemented yet')
    })
    return [...multiaxisScripts, ...mergedSingleaxisScripts]
  }

  // --- Public Instance Properties ---
  id: axis = 'L0'
  actions: FunAction[] = []
  axes: AxisScript[] = []
  metadata: FunMetadata = new FunMetadata()

  // --- Private Instance Properties ---
  #parent?: Funscript
  #file?: FunscriptFile

  // --- Constructor ---
  constructor(
    funscript?: JsonFunscript,
    extras?: { id?: axis, file?: string, axes?: JsonFunscript[], parent?: Funscript },
  ) {
    Object.assign(this, funscript)

    if (extras?.file) this.#file = new FunscriptFile(extras.file)
    else if (funscript instanceof Funscript) this.#file = funscript.#file?.clone()
    // prefer file > funscript > extras
    this.id = extras?.id ?? funscript?.id ?? this.#file?.id ?? (this instanceof AxisScript ? null! : 'L0')

    if (funscript?.actions) {
      this.actions = FunAction.cloneList(funscript.actions, { parent: this })
    }
    if (funscript?.metadata !== undefined) this.metadata = new FunMetadata(funscript.metadata, this)
    else if (funscript instanceof Funscript) this.#file = funscript.#file?.clone()

    if (extras?.axes) {
      if (funscript?.axes?.length) throw new Error('FunFunscript: both axes and axes are defined')
      this.axes = extras.axes.map(e => new AxisScript(e, { parent: this })).sort(orderByAxis)
    }
    else if (funscript?.axes) {
      this.axes = funscript.axes.map(e => new AxisScript(e, { parent: this })).sort(orderByAxis)
    }
    if (extras?.parent) this.#parent = extras.parent
  }

  // --- Getters/Setters ---
  get parent(): Funscript | undefined { return this.#parent }
  set parent(v: Funscript | undefined) { this.#parent = v }
  get file(): FunscriptFile | undefined { return this.#file }

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

  toSvgElement(ops: SvgOptions = {}): string {
    return toSvgElement([this], { ...ops })
  }

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
    FunAction.linkList(this.actions, { parent: this })

    const duration = Math.ceil(this.actualDuration)
    this.metadata.duration = duration
    this.axes.forEach(e => e.metadata.duration = duration)
    return this
  }

  getAxes(): Funscript[] {
    return [this, ...this.axes].sort(orderByAxis)
  }

  #searchActionIndex = -1
  /** find an action after the given time */
  getActionAfter(at: ms) {
    /* last action or action directly after at */
    const isTarget = (e: FunAction) => ((!e.nextAction || e.at > at) && (!e.prevAction || e.prevAction.at <= at))
    const AROUND_LOOKUP = 5
    for (let di = -AROUND_LOOKUP; di <= AROUND_LOOKUP; di++) {
      const index = this.#searchActionIndex + di
      if (!this.actions[index]) continue
      if (isTarget(this.actions[index])) {
        this.#searchActionIndex = index
        break
      }
    }
    if (!isTarget(this.actions[this.#searchActionIndex])) {
      this.#searchActionIndex = this.actions.findIndex(isTarget)
    }
    return this.actions[this.#searchActionIndex]
  }

  getPosAt(at: ms): pos {
    const action = this.getActionAfter(at)
    if (!action) return 50
    return action.clerpAt(at)
  }

  getAxesPosAt(at: ms) {
    return Object.fromEntries(this.getAxes().map(e => [e.id, e.getPosAt(at)]))
  }

  /** Returns TCode at the given time */
  getTCodeAt(at: ms) {
    const apos = this.getAxesPosAt(at)
    const tcode = Object.entries(apos)
      .map<TCodeTuple>(([axis, pos]) => [axis as axis, pos])
    return TCodeList.from(tcode)
  }

  /** returns TCode to move from the current point to the next point on every axis */
  getTCodeFrom(at: ms, since?: ms) {
    at = ~~at; since = since && ~~since
    const tcode: TCodeTuple[] = []

    for (const a of this.getAxes()) {
      const nextAction = a.getActionAfter(at)
      if (!nextAction) continue
      if (since === undefined) {
        // action is in the past, move with default speed
        if (nextAction.at <= at) tcode.push([a.id, nextAction.pos])
        else tcode.push([a.id, nextAction.pos, 'I', nextAction.at - at])
        continue
      }
      // action is in the past, do nothing
      if (nextAction.at <= at) continue

      const prevAt = nextAction.prevAction?.at ?? 0
      // prev action is in the same prev-next interval, do nothing
      if (prevAt <= since) continue

      tcode.push([a.id, nextAction.pos, 'I', nextAction.at - at])
    }

    return TCodeList.from(tcode)
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

  clone() {
    const clone = new Funscript(this)
    // clone.#parent = this.#parent
    clone.#file = this.#file?.clone()
    return clone
  }
}

export class AxisScript extends Funscript {
  declare id: axis
  declare axes: []

  constructor(
    funscript?: JsonFunscript,
    extras?: { id?: axis, filePath?: string, axes?: JsonFunscript[], parent?: Funscript },
  ) {
    super(funscript, extras)

    if (!this.id) throw new Error('AxisScript: axis is not defined')
    if (!this.parent) throw new Error('AxisScript: parent is not defined')
  }
}
