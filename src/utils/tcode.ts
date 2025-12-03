import type { FunAction, Funscript } from '..'
import type { axis, channel, ms, pos, TCodeTuple } from '../types'
import { channelNameToAxis } from './converter'
import { binaryFindLeftBorder, clerpAt } from './manipulations'
import { toMantissa } from './misc'

export function isTCodeAxis(axis: axis): boolean {
  return !!axis && !!axis.match(/^[LRVA]\d$/)
}

export function isTCodeChannel(channel: channel): boolean {
  return isTCodeAxis(channelNameToAxis(channel, channel))
}

export function toTCodeAxis(axis: axis | channel | undefined): axis | undefined {
  if (!axis) return 'L0'
  if (isTCodeAxis(axis as axis)) return axis as axis
  axis = channelNameToAxis(axis as any, axis)
  if (isTCodeAxis(axis as axis)) return axis as axis
  return undefined
}

export function getAxisTCodeAt(axis: axis, actions: FunAction[], at: ms): TCodeTuple {
  const pos = clerpAt(actions, at)
  return [axis, pos]
}
export function getAxisTCodeFrom(axis: axis, actions: FunAction[], at: ms, since?: ms): TCodeTuple | undefined {
  at = ~~at; since = since && ~~since
  // index action is at current time or before, or 0 if before first action
  const index = binaryFindLeftBorder(actions, at)
  const action = actions[index]
  const next: FunAction | undefined = actions[index + 1]

  if (!action) {
    // no actions at all, return default position
    return since === undefined ? [axis, 50] : undefined
  } else if (action.at > at) {
    // action is not left border because if's first action
    return since === undefined ? [axis, action.pos] : undefined
  }
  // now action is left border
  else if (since === undefined) {
    // must return some move
    if (next) return [axis, next.pos, 'I', next.at - at]
    return [axis, action.pos]
  } else {
    // since is defined, so since <= at and action <= at < next?
    if (since >= action.at) {
      // since is after action, already moving to next action, do nothing
      return undefined
    } else {
      if (next) return [axis, next.pos, 'I', next.at - at]
      return [axis, action.pos]
    }
  }
}

export function getTCodeAt(script: Funscript, at: ms): TCodeTuple[] {
  return script.allChannels.map((channel) => {
    const axis = toTCodeAxis(channel.channel)
    if (!axis) return undefined
    return getAxisTCodeAt(axis, channel.actions, at)
  }).filter(t => t !== undefined)
}

export function getTCodeFrom(script: Funscript, at: ms, since?: ms): TCodeTuple[] {
  return script.allChannels.map((channel) => {
    const axis = toTCodeAxis(channel.channel)
    if (!axis) return undefined
    return getAxisTCodeFrom(axis, channel.actions, at, since)
  }).filter(t => t !== undefined)
}

export function tcodeTupleToString(tuple: TCodeTuple, limits?: Record<axis, { min: pos, max: pos, respect: 'clamp' | 'scale' | 'ignore' }>): string {
  let [axis, pos, tag, arg] = [...tuple]
  if (!isTCodeAxis(axis)) throw new Error(`Invalid axis: ${axis}`)
  axis = channelNameToAxis(axis as any, axis)

  const { min, max, respect } = limits?.[axis] ?? { min: 0, max: 100, respect: 'ignore' }
  if (respect === 'clamp') {
    pos = Math.min(Math.max(pos, min), max)
  } else if (respect === 'scale') {
    pos = min + pos * (max - min)
    if (tag === 'S') arg! *= (max - min) / 100
  }

  if (tag === 'I' || tag === 'S')
    return `${axis}${toMantissa(pos)}${tag}${Math.round(arg!)}`
  return `${axis}${toMantissa(pos)}`
}
