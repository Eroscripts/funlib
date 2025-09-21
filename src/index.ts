import type { channel, chapterName, JsonAction, JsonChapter, JsonFunscript, JsonMetadata, ms, pos, seconds, timeSpan } from './types'
import { axisLikes, axisToChannelName, formatJson, msToTimeSpan, orderByChannel, orderTrimJson, timeSpanToMs } from './converter'
import { clamp, clone, isEmpty, makeNonEnumerable, mapObject } from './misc'

export class FunAction implements JsonAction {
  // --- Public Instance Properties ---
  at: ms = 0
  pos: pos = 0

  // --- Constructor ---
  constructor(action?: JsonAction) {
    Object.assign(this, action)
  }

  // --- JSON & Clone Section ---
  static jsonShape = { at: undefined, pos: undefined }

  toJSON() {
    return orderTrimJson(this, {
      at: +this.at.toFixed(1),
      pos: +this.pos.toFixed(1),
    })
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

  static jsonShape = { startTime: undefined, endTime: undefined, name: '' }
  toJSON() {
    return orderTrimJson(this)
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

  static jsonShape = { time: undefined, name: '' }
  toJSON() {
    return orderTrimJson(this)
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
    topic_url: '',
    script_url: '',
    tags: [],
    type: 'basic',
    video_url: '',
    durationTime: undefined,
  }

  toJSON() {
    return orderTrimJson(this, {
      duration: +this.duration.toFixed(3),
      durationTime: msToTimeSpan(this.duration * 1000),
    })
  }

  clone(): this {
    // Create a deep clone to avoid modifying the original's chapters/bookmarks
    const clonedData = JSON.parse(JSON.stringify(this.toJSON()))
    return clone(this, clonedData)
  }
}

export class FunscriptFile {
  channel: channel | '' = ''
  title: string = ''
  dir: string = ''
  mergedFiles?: FunscriptFile[]

  constructor(filePath: string | FunscriptFile) {
    if (filePath instanceof FunscriptFile) filePath = filePath.filePath
    let parts = filePath.split('.')
    if (parts.at(-1) === 'funscript') parts.pop()
    const channel = parts.at(-1)
    if (axisLikes.includes(channel as any)) {
      this.channel = parts.pop()! as any
    }
    filePath = parts.join('.')
    parts = filePath.split(/[\\/]/)
    this.title = parts.pop()!
    this.dir = filePath.slice(0, -this.title.length)
  }

  get filePath(): string {
    return `${this.dir}${this.title}${this.channel ? `.${this.channel}` : ''}.funscript`
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
  static mergeMultiAxis(scripts: Funscript[], options?: {
    allowMissingActions?: boolean
    combineSingleSecondaryChannel?: boolean
  }): Funscript[] {
    const allowMissingActions = options?.allowMissingActions ?? false
    const combineSingleSecondaryChannel = options?.combineSingleSecondaryChannel ?? false

    const multiaxisScripts = scripts.filter(e => e.listChannels.length)
    const singleaxisScripts = scripts.filter(e => !e.listChannels.length)

    const groups = Object.groupBy(
      singleaxisScripts,
      e => e.file ? e.file.dir + e.file.title : '[unnamed]',
    )
    const mergedSingleaxisScripts = Object.entries(groups).flatMap<Funscript>(([title, scripts]) => {
      if (!scripts) return []

      // base case: no duplicate axes
      // scripts already checked to have no channels
      const allScripts = scripts.sort(orderByChannel)
      const usedChannels = [...new Set(allScripts.map(e => e.channel))]
      if (usedChannels.length !== allScripts.length) {
        throw new Error(`Funscript.mergeMultiAxis: some of the ${
          JSON.stringify(title)
        } channels ${
          JSON.stringify(allScripts.map(e => e.channel))
        } are duplicate`)
      }
      if (allScripts.length === 1) {
        if (!allScripts[0].channel) return allScripts
        if (!combineSingleSecondaryChannel) return allScripts
        return [new Funscript({
          ...allScripts[0],
          actions: [],
          channels: { [allScripts[0].channel!]: allScripts[0] },
          channel: undefined,
        }, { isMerging: true })]
      }
      const mainScript = allScripts.find(e => !e.channel)
      const secondaryScripts = allScripts.filter(e => e.channel)
      if (!mainScript && !allowMissingActions) {
        throw new Error('Funscript.mergeMultiAxis: cannot merge scripts with no base script')
      }
      return [new Funscript(mainScript, { channels: secondaryScripts, isMerging: true })]
    })
    return [...multiaxisScripts, ...mergedSingleaxisScripts]
  }

  // --- Public Instance Properties ---
  channel?: channel
  actions: FunAction[] = []
  channels: Record<channel, AxisScript> = {}
  metadata!: FunMetadata

  // --- Non-enumerable Properties ---
  parent?: Funscript
  file?: FunscriptFile

  // --- Constructor ---
  constructor(
    funscript?: JsonFunscript,
    extras?: {
      channel?: channel
      file?: string
      channels?: Record<channel, JsonFunscript> | JsonFunscript[]
      parent?: Funscript
      isMerging?: boolean
    },
  ) {
    Object.assign(this, funscript)

    const base = this.constructor as typeof Funscript
    this.metadata = new base.Metadata()

    if (extras?.file) this.file = new base.File(extras.file)
    else if (funscript instanceof Funscript) this.file = funscript.file?.clone()
    // prefer file > funscript > extras
    this.channel = extras?.channel ?? funscript?.channel ?? this.file?.channel

    if (funscript?.actions) {
      this.actions = funscript.actions.map(e => new base.Action(e))
    }
    if (funscript?.metadata !== undefined) this.metadata = new base.Metadata(funscript.metadata, this)
    else if (funscript instanceof Funscript) this.file = funscript.file?.clone()

    if (extras?.channels && (!isEmpty(funscript?.channels ?? funscript?.axes))) {
      throw new Error('FunFunscript: channels are defined on both script and extras')
    }
    const channelsOrAxes = extras?.channels ?? funscript?.channels ?? funscript?.axes
    const channels = Array.isArray(channelsOrAxes)
      ? Object.fromEntries<JsonFunscript>(
          channelsOrAxes.map<[channel, JsonFunscript]>(e => ['channel' in e ? e.channel! : axisToChannelName(e.id), e] as const),
        )
      : channelsOrAxes
    this.channels = mapObject(channels ?? ({} as never), (e) => {
      return new base.AxisScript(e, { parent: this })
    })

    if (extras?.isMerging) {
      const baseFile = this.file ?? this.listChannels.map(e => e.file).find(e => e !== undefined)
      const newFile = new base.File(baseFile ?? '[unnamed]')
      newFile.mergedFiles = [this.file, ...this.listChannels.map(e => e.file)].filter(e => e !== undefined)
      if (newFile.mergedFiles.length)
        this.file = newFile
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
      ...this.listChannels.map(e => e.actions.at(-1)?.at ?? 0),
    ) / 1000
  }

  get actionsDuraction(): seconds {
    return Math.max(
      this.actions.at(-1)?.at ?? 0,
      ...this.listChannels.map(e => e.actions.at(-1)?.at ?? 0),
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

  get listChannels(): AxisScript[] {
    return Object.values(this.channels)
  }

  // --- Public Instance Methods ---

  normalize() {
    this.listChannels.forEach(e => e.normalize())

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
    this.listChannels.forEach(e => e.metadata.duration = duration)
    return this
  }

  // --- JSON & Clone Section ---
  static jsonShape = {
    id: undefined,
    channel: undefined,
    metadata: {},
    actions: undefined,
    axes: undefined,
    channels: {},
    inverted: false,
    range: 100,
    version: '1.0',
  }

  toJSON(): Record<string, any> {
    return orderTrimJson(this, {
      id: undefined,
      axes: undefined,
      channel: undefined,
      channels: mapObject(this.channels, e => e.toJSON()),
      metadata: {
        ...this.metadata.toJSON(),
        duration: +this.duration.toFixed(3),
      },
    })
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
  declare channel: channel
  declare channels: Record<channel, never>
  declare parent: Funscript

  constructor(
    funscript?: JsonFunscript,
    extras?: {
      channel?: channel
      file?: string
      channels?: never
      parent?: Funscript
    },
  ) {
    super(funscript, extras)

    if (!this.channel) throw new Error('AxisScript: axis is not defined')
    if (!this.parent) throw new Error('AxisScript: parent is not defined')
  }

  clone(): this {
    return this.parent.clone().channels[this.channel]! as any
  }

  toJSON(): Record<string, any> {
    let json = super.toJSON();
    if (JSON.stringify(json.metadata) === JSON.stringify(this.metadata))
      delete json.metadata
    return json
  }
}

// Set the AxisScript reference after it's declared
Funscript.AxisScript = AxisScript

// export general types that are always needed. This is not a barrel file.
export type * from './types'
