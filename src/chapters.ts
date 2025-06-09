import type { FunChapter } from './index'
import type { chapterName, ms } from './types'
import { FunAction, Funscript } from './index'

export function sliceActions(
  actions: FunAction[],
  chapter: { startAt: ms, endAt: ms },
  lerpBorders: 'lerp' | 'empty',
) {
  if (!actions.length) return []
  if (!lerpBorders) throw new Error('sliceActions: lerpBorders is required')

  const newActions = actions.filter(action => action.at >= chapter.startAt && action.at <= chapter.endAt)
  if (lerpBorders === 'lerp') {
    // action just after startAt
    const actionNearStart = newActions[0]
      ?? actions.find(action => action.at >= chapter.startAt)
      ?? actions.at(-1)!

    // action just before endAt
    const actionNearEnd = newActions.at(-1)
      ?? actions.findLast(action => action.at <= chapter.endAt)
      ?? actions[0]

    if (!newActions[0] || newActions[0].at !== chapter.startAt) {
      newActions.unshift(new FunAction({
        at: chapter.startAt,
        pos: actionNearStart.clerpAt(chapter.startAt),
      }))
    }
    if (newActions.at(-1)!.at !== chapter.endAt) {
      newActions.push(new FunAction({
        at: chapter.endAt,
        pos: actionNearEnd.clerpAt(chapter.endAt),
      }))
    }
  }
  return newActions
}

export function extractChapter(funscript: Funscript, chapter: FunChapter, lerpBorders: 'lerp' | 'empty'): Funscript {
  const clonedChapter = chapter.clone()
  const startAt = clonedChapter.startAt
  clonedChapter.startAt = 0
  clonedChapter.endAt -= startAt

  const actions = sliceActions(funscript.actions, chapter, lerpBorders)
    .map(a => a.clone())

  actions.forEach(e => e.at -= startAt)

  return new Funscript({
    actions,
    axes: funscript.axes.map(axis => extractChapter(axis, chapter, lerpBorders)),
    metadata: {
      ...funscript.metadata.toJSON(),
      chapters: [clonedChapter],
      duration: (clonedChapter.endAt - clonedChapter.startAt) / 1000,
    },
  })
}

export function splitFunscriptByChapters(funscript: Funscript, lerpBorders: 'lerp' | 'empty'): Record<chapterName, Funscript> {
  const chapters = funscript.metadata.chapters
  return Object.fromEntries(
    chapters.map(chapter => [chapter.name, extractChapter(funscript, chapter, lerpBorders)]),
  )
}
