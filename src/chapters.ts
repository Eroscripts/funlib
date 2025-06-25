import type { FunChapter } from './index'
import type { chapterName, ms } from './types'
import { FunAction, Funscript } from './index'
import { clerpAt } from './manipulations'

export function sliceActions(
  actions: FunAction[],
  chapter: { startAt: ms, endAt: ms },
  lerpBorders: 'lerp' | 'empty',
) {
  if (!actions.length) return []
  if (!lerpBorders) throw new Error('sliceActions: lerpBorders is required')

  const newActions = actions.filter(action => action.at >= chapter.startAt && action.at <= chapter.endAt)
  if (lerpBorders === 'lerp') {
    if (!newActions[0] || newActions[0].at !== chapter.startAt) {
      newActions.unshift(new FunAction({
        at: chapter.startAt,
        pos: clerpAt(actions, chapter.startAt),
      }))
    }
    if (newActions.at(-1)!.at !== chapter.endAt) {
      newActions.push(new FunAction({
        at: chapter.endAt,
        pos: clerpAt(actions, chapter.endAt),
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
    chapters.slice().reverse().map(chapter => [chapter.name, extractChapter(funscript, chapter, lerpBorders)]),
  )
}
