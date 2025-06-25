import type { FunAction, Funscript } from '..'
import type { axis, ms, pos, TCodeTuple } from '../types'
import { TCodeList } from '../converter'

// WeakMap to store search indices for optimization
const searchActionIndices = new WeakMap<Funscript, number>()

/**
 * Find an action after the given time using WeakMap-based optimization
 */
export function getActionAfter(script: Funscript, at: ms): FunAction | undefined {
  /* last action or action directly after at */
  const isTarget = (e?: FunAction) => e && ((!e.nextAction || e.at > at) && (!e.prevAction || e.prevAction.at <= at))
  const AROUND_LOOKUP = 5

  let searchIndex = searchActionIndices.get(script) ?? -1

  for (let di = -AROUND_LOOKUP; di <= AROUND_LOOKUP; di++) {
    const index = searchIndex + di
    if (!script.actions[index]) continue
    if (isTarget(script.actions[index])) {
      searchIndex = index
      break
    }
  }

  if (!isTarget(script.actions[searchIndex])) {
    searchIndex = script.actions.findIndex(isTarget)
  }

  searchActionIndices.set(script, searchIndex)
  return script.actions[searchIndex]
}

/**
 * Get interpolated position at a specific time
 */
export function getPosAt(script: Funscript, at: ms): pos {
  const action = getActionAfter(script, at)
  if (!action) return 50 as pos
  return action.clerpAt(at)
}

/**
 * Get positions across all axes at a specific time
 */
export function getAxesPosAt(script: Funscript, at: ms): Record<axis, pos> {
  return Object.fromEntries(script.getAxes().map(e => [e.id, getPosAt(e, at)]))
}

/**
 * Returns TCode at the given time
 */
export function getTCodeAt(script: Funscript, at: ms): TCodeList {
  const apos = getAxesPosAt(script, at)
  const tcode = Object.entries(apos)
    .map<TCodeTuple>(([axis, pos]) => [axis as axis, pos])
  return TCodeList.from(tcode)
}

/**
 * Returns TCode to move from the current point to the next point on every axis
 */
export function getTCodeFrom(script: Funscript, at: ms, since?: ms): TCodeList {
  at = ~~at; since = since && ~~since
  const tcode: TCodeTuple[] = []

  for (const a of script.getAxes()) {
    const nextAction = getActionAfter(a, at)
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
