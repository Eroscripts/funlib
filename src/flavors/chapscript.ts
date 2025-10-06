import type { axis, channel, chapterName, JsonAction, JsonChapter, JsonFunscript, JsonMetadata, ms, pos, timeSpan } from '..'
import { FunAction, FunChapter, FunMetadata, Funscript } from '..'
import { sliceActions } from '../utils/chapters'
import { axisIds, orderByChannel, orderTrimJson } from '../utils/converter'
import { clerpAt } from '../utils/manipulations'
import { compareWithOrder, mapObject } from '../utils/misc'

export interface JsonChapChapter {
  channel?: channel
  startTime: timeSpan
  endTime: timeSpan
  name?: string
  actions?: JsonAction[]
  channels?: Record<channel, { actions: JsonAction[] }>
}

/**
 * Action in script.actions, converted from chap.actions
 */
export class ChapTimelineAction extends FunAction {
  chapter: chapterName = ''
  chapterAt: ms = 0

  constructor(action?: JsonAction & Partial<{ chapter: chapterName, chapterAt: ms }>) {
    super(action)
    if (action?.chapter) this.chapter = action.chapter
    if (action?.chapterAt !== undefined) this.chapterAt = action.chapterAt
  }

  toJSON() {
    return orderTrimJson(this, { chapter: undefined, chapterAt: undefined })
  }
}

/**
 * Chapter in script.chapters
 */
export class ChapChapter extends FunChapter {
  actions: FunAction[]
  channels: Record<channel, { actions: FunAction[] }>

  get durationMs() {
    return this.endAt - this.startAt
  }

  set durationMs(value) {
    this.endAt = this.startAt + value
  }

  constructor(chapter?: JsonChapChapter) {
    super(chapter as any)
    this.actions = chapter?.actions?.map(a => new FunAction(a)) ?? []
    this.channels = !chapter?.channels
      ? {}
      : mapObject(chapter.channels, channelData => ({
          actions: channelData.actions.map(a => new FunAction(a)),
        }))
  }

  into(timelineChapter: TimelineChapter, channel?: channel): ChapTimelineAction[] {
    const actions = !channel
      ? this.actions
      : this.channels?.[channel]?.actions ?? []

    if (!actions.length) return []
    const { startAt, endAt } = timelineChapter
    const chapterDuration = this.endAt - this.startAt
    const timelineDuration = endAt - startAt

    // Calculate how many complete loops we can fit if looping is enabled
    const maxLoops = !timelineChapter.loop
      ? 1
      : 1 + Math.ceil(timelineDuration / (chapterDuration / timelineChapter.speed))

    return Array.from({ length: maxLoops })
      .flatMap((_, loop) => {
        return actions.map((action) => {
          const at = action.at - timelineChapter.offset + loop * chapterDuration

          return new ChapTimelineAction({
            at: startAt + at / timelineChapter.speed,
            pos: action.pos,
            chapter: this.name,
            chapterAt: action.at,
          })
        })
      })
      .filter(action => startAt <= action.at && action.at <= endAt)
  }

  static override jsonShape = {
    id: '',
    startTime: undefined,
    endTime: undefined,
    name: '',
    actions: [],
    channels: {},
  }

  toJSON() {
    return orderTrimJson(this)
  }
}

export interface JsonTimelineChapter extends Partial<JsonChapter> {
  offset?: ms
  loop?: boolean
  speed?: number
  startAt?: ms
  endAt?: ms
}

/**
 * Chapter in script.metadata.chapters
 */
export class TimelineChapter extends FunChapter {
  /** shift relative to chapter start. Positive shift drops actions before the shift */
  offset: ms = 0
  /** If chap should be repeated to fill the duration */
  loop = true
  /** `at` divider */
  speed = 1

  constructor(chapter?: JsonTimelineChapter) {
    super(chapter as any)
    this.offset = chapter?.offset ?? 0
    this.loop = chapter?.loop ?? true
    this.speed = chapter?.speed ?? 1
  }

  static override jsonShape = {
    ...FunChapter.jsonShape,
    offset: 0,
    loop: true,
    speed: 1,
  }
}

export class ChapMetadata extends FunMetadata {
  static override Chapter = TimelineChapter
  declare chapters: TimelineChapter[]
}

export class ChapScript extends Funscript {
  static override Metadata = ChapMetadata
  static override Chapter = ChapChapter
  static override Action = ChapTimelineAction
  declare metadata: ChapMetadata

  chapters: Record<chapterName, ChapChapter>

  constructor(
    funscript?: Omit<JsonFunscript, 'metadata'> & {
      chapters?: Record<chapterName, JsonChapChapter>
      metadata?: Omit<JsonMetadata, 'chapters'> & {
        chapters?: JsonTimelineChapter[]
      }
    },
    extras?: { id?: axis, file?: string, axes?: JsonFunscript[], parent?: Funscript },
  ) {
    super(funscript as any, extras)
    this.chapters = mapObject(funscript?.chapters ?? {}, c => new ChapChapter(c as any))

    const base = this.constructor as typeof Funscript
    const allChapterAxes = new Set(Object.values(this.chapters).flatMap(c => Object.keys(c.channels) ?? []))
    for (const x of allChapterAxes) {
      this.channels[x] ??= new base.Channel({ actions: [] }, { channel: x, parent: this })
    }
    this.listChannels.sort(orderByChannel)
  }

  recalculateActions(): this {
    // Calculate L0 actions
    this.actions = this.metadata.chapters
      .flatMap(c => this.chapters[c.name]?.into(c) ?? [])
      .sort((a, b) => a.at - b.at)

    // Update existing axes actions only (assume all axes exist)
    this.listChannels.forEach((axisScript) => {
      const axisActions = this.metadata.chapters
        .flatMap(c => this.chapters[c.name]?.into(c, axisScript.channel) ?? [])
        .sort((a, b) => a.at - b.at)

      // Convert ChapActions to FunActions for the axis
      axisScript.actions = axisActions.map(chapAction => new FunAction({
        at: chapAction.at,
        pos: chapAction.pos,
      }))
    })

    return this
  }

  addTimelineChapter(timelineChapter: JsonTimelineChapter) {
    const chapter = new TimelineChapter(timelineChapter)
    this.metadata.chapters.push(chapter)
    // Sort chapters by start time
    this.metadata.chapters.sort((a, b) => a.startAt - b.startAt)
    return chapter
  }

  removeTimelineChapter(chapter: TimelineChapter): this {
    const index = this.metadata.chapters.findIndex(c => c.name === chapter.name)
    if (index !== -1) {
      this.metadata.chapters.splice(index, 1)
    }
    return this
  }

  clearTimeline(startAt: ms, endAt: ms): this {
    const newChapters = this.metadata.chapters
      .flatMap((chapter) => {
        // Chapter is completely outside the splice range - keep as is
        if (chapter.endAt <= startAt) return [chapter]
        if (chapter.startAt >= endAt) return [chapter]

        // Chapter is completely within the splice range - drop it
        if (startAt <= chapter.startAt && chapter.endAt <= endAt) return []

        const startChapter = chapter.clone()
        startChapter.endAt = startAt
        const endChapter = chapter.clone()
        endChapter.offset += (endAt - chapter.startAt) * (chapter.speed || 1)
        endChapter.startAt = endAt

        const chap = this.chapters[chapter.name]
        if ((chap as any)?.loop && endChapter.offset > chap.endAt) {
          endChapter.offset %= (chap.endAt - chap.startAt)
        }
        // if (endChapter.offset > )
        if (chapter.endAt < endAt) return [startChapter]
        if (chapter.startAt > startAt) return [endChapter]
        return [startChapter, endChapter]
      })

    this.metadata.chapters = newChapters.sort((a, b) => a.startAt - b.startAt)
    return this
  }

  /** Get all unique axes used across all chapters */
  getChapterAxes(): axis[] {
    // skip L0 for now
    return [...new Set(Object.values(this.chapters).flatMap(c => c.axes?.map(a => a.id) ?? []))]
      .sort((a, b) => compareWithOrder(a, b, axisIds))
  }

  static fromFunscript(
    funscript: Funscript,
    { chapters, sliceActionsMode }:
    { chapters: FunChapter[], sliceActionsMode: 'lerp' | 'empty' },
  ): ChapScript {
    const cs = new ChapScript(funscript)

    // If chapters are provided, slice the funscript into chapters
    if (!chapters?.length) return cs

    // Utility function to slice and convert actions for a specific axis
    const sliceAxisActions = (actions: FunAction[], chapter: ChapChapter) => {
      const slicedActions = sliceActions(
        actions,
        { startAt: chapter.startAt, endAt: chapter.endAt },
        sliceActionsMode,
      )

      return slicedActions.map(action => new ChapTimelineAction({
        at: action.at - chapter.startAt,
        pos: action.pos,
        chapter: chapter.name,
        chapterAt: action.at - chapter.startAt,
      }))
    }

    // Process chapters for L0 and multi-axis
    cs.chapters = Object.fromEntries(
      chapters.map((chapterJson) => {
        const chapter = new ChapChapter(JSON.parse(JSON.stringify(chapterJson)))

        // Process L0 actions
        chapter.actions = sliceAxisActions(funscript.actions, chapter)

        // Process multi-axis actions if present
        if (funscript.listChannels.length) {
          chapter.channels = funscript.axes.map(axisScript => ({
            id: axisScript.id,
            actions: sliceAxisActions(axisScript.actions, chapter),
          })).filter(axisData => axisData.actions.length)
        }

        return [chapter.name, chapter]
      }),
    )

    return cs
  }

  getPosAt(at: ms, axis?: axis): pos {
    const actions = !axis ? this.actions : this.axes.find(a => a.id === axis)?.actions
    return clerpAt(actions ?? [], at)
  }
}
ChapScript.Channel = ChapScript as never

/*
TODO: Multi-Axis ChapScript Implementation Checklist

COMPLETED:
[✓] Basic multi-axis ChapChapter structure with id and axes properties
[✓] Multi-axis into() method with axis parameter for timeline calculation
[✓] Multi-axis recalculateActions() that updates existing axes actions
[✓] getAllAxes() method to discover all axes across chapters
[✓] Updated fromFunscript() to handle multi-axis input with DRY utility function
[✓] Constructor auto-creates AxisScript instances from chapter data
[✓] Simplified axes structure to {id, actions[]} format
[✓] Multi-axis JSON serialization in ChapChapter.toJSON()

HIGH PRIORITY: None remaining!

MEDIUM PRIORITY:
[ ] Implement AxisChapScript class extending ChapScript (if needed)
[ ] Add multi-axis support to timeline methods:
    - addTimelineChapter() for specific axes
    - removeTimelineChapter() for specific axes
    - clearTimeline() for specific axes
[ ] Implement proper clone() methods for multi-axis data
[ ] Add validation for multi-axis consistency across chapters

LOW PRIORITY:
[ ] Add utility methods:
    - getActionsForAxis(axis: axis): ChapAction[]
    - getAxisChapter(chapterName: string, axis: axis): ChapChapter | undefined
    - getAllAxisActions(): Record<axis, ChapAction[]>
[ ] Implement action merging strategies for conflicting timestamps
[ ] Add advanced validation and error handling
[ ] Optimize performance for large multi-axis datasets

ARCHITECTURE DECISIONS RESOLVED:
[✓] ChapChapter has direct id property instead of intersection types
[✓] recalculateActions() assumes axes exist and only updates their actions
[✓] Axes share timeline timing (no independent chapter timing per axis)
[✓] Axes are auto-created from chapter data in constructor
[✓] Simplified axes structure: {id: axis, actions: ChapAction[]} instead of nested ChapChapter

ARCHITECTURE DECISIONS PENDING:
[ ] Should ChapAction include axis property for multi-axis tracking?
[ ] How to handle timeline synchronization across axes in edge cases?
[ ] How to resolve conflicts when multiple axes have different action counts?

TESTING:
[ ] Unit tests for multi-axis ChapChapter.into() with axis parameter
[ ] Integration tests for recalculateActions() with multiple axes
[ ] Round-trip serialization tests for multi-axis data
[ ] Performance benchmarks for large multi-axis scripts
[ ] Edge case tests (missing axes, empty chapters, invalid axis IDs)
*/
