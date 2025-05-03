import type { Funscript } from '.'
import type { axis, axisLike, axisName, axisNorm, axisPairs, axisRaw, ms, pos, seconds, speed, timeSpan } from './types'
import { oklch2hex } from 'colorizr'
import { clamplerp, compareWithOrder } from './misc'

export function timeSpanToMs(timeSpan: timeSpan): ms {
  if (typeof timeSpan !== 'string') {
    throw new TypeError('timeSpanToMs: timeSpan must be a string')
  }
  const sign = timeSpan.startsWith('-') ? -1 : 1; if (sign < 0) timeSpan = timeSpan.slice(1)
  const split = timeSpan.split(':').map(e => Number.parseFloat(e))
  while (split.length < 3) split.unshift(0)
  const [hours, minutes, seconds] = split
  return Math.round(sign * (hours * 60 * 60 + minutes * 60 + seconds) * 1000)
}

export function msToTimeSpan(ms: ms): timeSpan {
  const sign = ms < 0 ? -1 : 1; ms *= sign
  const seconds = Math.floor(ms / 1000) % 60
  const minutes = Math.floor(ms / 1000 / 60) % 60
  const hours = Math.floor(ms / 1000 / 60 / 60)
  ms = ms % 1000
  return `${sign < 0 ? '-' : ''}${
    hours.toFixed(0).padStart(2, '0')}:${
    minutes.toFixed(0).padStart(2, '0')}:${
    seconds.toFixed(0).padStart(2, '0')}.${
    ms.toFixed(0).padStart(3, '0')}`
}

export function secondsToDuration(seconds: seconds): string {
  seconds = Math.round(seconds)
  if (seconds < 3600) {
    return `${Math.floor(seconds / 60)}:${
      Math.floor(seconds % 60).toFixed(0).padStart(2, '0')}`
  }
  return `${Math.floor(seconds / 60 / 60)}:${
    Math.floor(seconds / 60 % 60).toFixed(0).padStart(2, '0')}:${
    Math.floor(seconds % 60).toFixed(0).padStart(2, '0')}`
}

export function rawToValue(raw: axisRaw, axis?: axis): pos {
  if (raw === undefined || raw === null) {
    throw new Error('rawToValue: raw value is required')
  }
  // axisValue is [0, 100]
  // L0 is [0, 1]; R0 is [-60, 60]; R1, R2 is [-30, 30]; L1/L2 is throw
  let norm: axisNorm = -999
  if (axis === 'L0') norm = raw + 0
  if (axis === 'R0') norm = raw / 120 + 0.5
  if (axis === 'R1') norm = raw / 60 + 0.5
  if (axis === 'R2') norm = raw / 60 + 0.5

  if (norm === -999) throw new Error(`rawToValue: ${axis} is not supported`)
  return norm * 100
}

export function valueToRaw(value: pos, axis?: axis): axisRaw {
  // axisValue is [0, 100]
  // L0 is [0, 1]; R0 is [-60, 60]; R1, R2 is [-30, 30]; L1/L2 is throw
  const norm: axisNorm = value / 100
  if (axis === 'L0') return norm
  if (axis === 'R0') return (norm - 0.5) * 120
  if (axis === 'R1') return (norm - 0.5) * 60
  if (axis === 'R2') return (norm - 0.5) * 60
  throw new Error(`valueToRaw: ${axis} is not supported`)
}

export function roundAxisValue(value: pos): pos {
  return +value.toFixed(2)
}

export function orderTrimJson(that: Record<string, any>, order: Record<string, any>, empty: Record<string, any>): Record<string, any> {
  const copy: Record<string, any> = { ...order, ...that }
  for (const [k, v] of Object.entries(empty)) {
    if (!(k in copy)) continue
    const copyValue = (copy as any)[k]
    if (copyValue === v) delete (copy as any)[k]
    if (Array.isArray(v) && Array.isArray(copyValue) && copyValue.length === 0) {
      delete (copy as any)[k]
    }
    else if (
      typeof v === 'object' && v !== null && Object.keys(v).length === 0
      && typeof copyValue === 'object' && copyValue !== null && Object.keys(copyValue).length === 0
    ) {
      delete (copy as any)[k]
    }
  }
  for (const k of Object.keys(copy)) {
    if (k.startsWith('__')) {
      delete (copy as any)[k]
    }
  }
  return copy
}

function fromEntries<A extends [any, any][]>(a: A): { [K in A[number] as K[0]]: K[1] } {
  return Object.fromEntries(a)
}

// eslint-disable-next-line ts/no-redeclare
const axisPairs: axisPairs = [['L0', 'stroke'], ['L1', 'surge'], ['L2', 'sway'], ['R0', 'twist'], ['R1', 'roll'], ['R2', 'pitch']]

export const axisToNameMap: Record<axis, axisName> = fromEntries(axisPairs)
export const axisNameToAxisMap: Record<axisName, axis> = fromEntries(axisPairs.map(([a, b]) => [b, a]))
export const axisIds: axis[] = axisPairs.map(e => e[0])
export const axisNames: axisName[] = axisPairs.map(e => e[1])
export const axisLikes: axisLike[] = axisPairs.flat()

export function axisNameToAxis(name?: axisName): axis {
  if (name && name in axisNameToAxisMap) return axisNameToAxisMap[name]
  throw new Error(`axisNameToAxis: ${name} is not supported`)
}
export function axisToName(axis?: axis): axisName {
  if (axis && axis in axisToNameMap) return (axisToNameMap as any)[axis]
  throw new Error(`axisToName: ${axis} is not supported`)
}
export function axisLikeToAxis(axisLike?: axisLike | 'singleaxis'): axis {
  if (!axisLike) return 'L0'
  if (axisIds.includes(axisLike as any)) return axisLike as any
  if (axisNames.includes(axisLike as any)) return axisNameToAxisMap[axisLike as axisName]
  if (axisLike === 'singleaxis') return 'L0'
  throw new Error(`axisLikeToAxis: ${axisLike} is not supported`)
}

export function orderByAxis(a: Funscript, b: Funscript) {
  return compareWithOrder(a.id, b.id, axisIds)
}

export function formatJson(json: string, { lineLength = 100, maxPrecision = 1 }: { lineLength?: number, maxPrecision?: number } = {}): string {
  function removeNewlines(s: string) { return s.replaceAll(/ *\n\s*/g, ' ') }
  const inArrayRegex = /(?<=\[)([^[\]]+)(?=\])/g

  json = json.replaceAll(/\{\s*"(at|time|startTime)":[^{}]+\}/g, removeNewlines)

  // all `at` values in array should have same length
  json = json.replaceAll(inArrayRegex, (s) => {
    // Round numbers to maxPrecision
    s = s.replaceAll(/(?<="(at|pos)":\s*)(-?\d+\.?\d*)/g, num =>
      Number(num).toFixed(maxPrecision).replace(/\.?0+$/, ''))

    // "at": -123.456,
    const atValues = s.match(/(?<="at":\s*)(-?\d+\.?\d*)/g) ?? []
    if (atValues.length === 0) return s

    const maxAtLength = Math.max(0, ...atValues.map(e => e.length))
    s = s.replaceAll(/(?<="at":\s*)(-?\d+\.?\d*)/g, s => s.padStart(maxAtLength, ' '))

    const posValues = s.match(/(?<="pos":\s*)(-?\d+\.?\d*)/g) ?? []
    const posDot = Math.max(0, ...posValues.map(e => e.split('.')[1])
      .filter(e => e)
      .map(e => e.length + 1))
    s = s.replaceAll(/(?<="pos":\s*)(-?\d+\.?\d*)/g, (s) => {
      if (!s.includes('.')) return s.padStart(3) + ' '.repeat(posDot)
      const [a, b] = s.split('.')
      return `${a.padStart(3)}.${b.padEnd(posDot - 1, ' ')}`
    })
    const actionLength = '{ "at": , "pos": 100 },'.length + maxAtLength + posDot

    let actionsPerLine = 10
    while (6 + (actionLength + 1) * actionsPerLine - 1 > lineLength)
      actionsPerLine--
    let i = 0
    s = s.replaceAll(/\n(?!\s*$)\s*/g, s => (i++ % actionsPerLine === 0) ? s : ' ')

    return s
  })

  return json
}

export const oklchParams = {
  l: { left: 500, right: 600, from: 0.8, to: 0.4 },
  c: { left: 800, right: 900, from: 0.4, to: 0.1 },
  h: { speed: -2.4, offset: 210 },
  a: { left: 0, right: 100, from: 0, to: 1 },
}

/**
 * in css:
 * `oklch(
 *    clamp(40%, calc(80% - 0.4% * (var(--speed) - 500)), 80%)
 *    clamp(10%, calc(40% - 0.3% * (var(--speed) - 800)), 40%)
 *    calc(210 - var(--speed) / 2.4))`
 */
export function speedToOklch(speed: speed, useAlpha = false, params = oklchParams) {
  function roll(value: number, cap: number) {
    return (value % cap + cap) % cap
  }
  const l = clamplerp(speed, params.l.left, params.l.right, params.l.from, params.l.to)
  const c = clamplerp(speed, params.c.left, params.c.right, params.c.from, params.c.to)
  const h = roll(params.h.offset + speed / params.h.speed, 360)
  const a = useAlpha ? clamplerp(speed, params.a.left, params.a.right, params.a.from, params.a.to) : 1

  return [l, c, h, a]
}

export function speedToOklchText(speed: speed, useAlpha = false) {
  const [l, c, h, a] = speedToOklch(speed, useAlpha)
  function toFixed(value: number, precision: number) {
    return value.toFixed(precision).replace(/\.?0+$/, '')
  }
  return `oklch(${toFixed(l * 100, 3)}% ${toFixed(c, 3)} ${toFixed(h, 1)}${useAlpha ? ` / ${toFixed(a, 3)}` : ''})`
}

export function speedToHex(speed: speed) {
  const [l, c, h] = speedToOklch(speed)
  return oklch2hex({ l, c, h })
}
