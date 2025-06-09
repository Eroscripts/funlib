import type { Funscript } from '.'
import type { axis, axisLike, axisName, axisPairs, ms, pos, seconds, speed, TCodeTuple, timeSpan } from './types'
import { oklch2hex } from 'colorizr'
import { clamp, clamplerp, compareWithOrder } from './misc'

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
  return copy
}

function fromEntries<A extends [any, any][]>(a: A): { [K in A[number] as K[0]]: K[1] } {
  return Object.fromEntries(a)
}

const axisPairs: axisPairs = [
  ['L0', 'stroke'],
  ['L1', 'surge'],
  ['L2', 'sway'],
  ['R0', 'twist'],
  ['R1', 'roll'],
  ['R2', 'pitch'],
  ['A1', 'suck'],
]

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

export function fileNameToInfo(filePath?: string) {
  const parts = filePath?.split('.') ?? []
  if (parts.at(-1) === 'funscript') parts.pop()
  let axisLike = parts.at(-1)
  if (axisLikes.includes(axisLike as any)) {
    parts.pop()
  }
  else if (axisLike === 'singleaxis') {
    parts.pop()
  }
  else {
    axisLike = undefined
  }
  const fileName = parts.join('.')

  return {
    filePath,
    fileName,
    primary: !axisLike || axisLike === 'singleaxis',
    title: fileName.split(/[\\/]/).pop()!,
    id: axisLike ? axisLikeToAxis(axisLike as any) : undefined,
  }
}

export function formatJson(
  json: string,
  { lineLength = 100, maxPrecision = 1, compress = false }:
  { lineLength?: number, maxPrecision?: number, compress?: boolean } = {},
): string {
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

    let actionsPerLine1 = 10
    while (6 + (actionLength + 1) * actionsPerLine1 - 1 > lineLength)
      actionsPerLine1--
    let i = 0
    s = s.replaceAll(/\n(?!\s*$)\s*/g, s => (i++ % actionsPerLine1 === 0) ? s : ' ')

    if (compress) {
      const [, start, , end] = s.match(/^(\s*(?=$|\S))([\s\S]+)((?<=^|\S)\s*)$/) ?? ['', '', '', '']
      s = start + JSON.stringify(JSON.parse(`[${s}]`)).slice(1, -1) + end
    }

    return s
  })

  return json
}

export const speedToOklchParams = {
  l: { left: 500, right: 600, from: 0.8, to: 0.4 },
  c: { left: 800, right: 900, from: 0.4, to: 0.1 },
  h: { speed: -2.4, offset: 210 },
  a: { left: 0, right: 100, from: 0, to: 1 },
}

export function speedToOklch(speed: speed, useAlpha = false) {
  function roll(value: number, cap: number) {
    return (value % cap + cap) % cap
  }
  const l = clamplerp(speed, speedToOklchParams.l.left, speedToOklchParams.l.right, speedToOklchParams.l.from, speedToOklchParams.l.to)
  const c = clamplerp(speed, speedToOklchParams.c.left, speedToOklchParams.c.right, speedToOklchParams.c.from, speedToOklchParams.c.to)
  const h = roll(speedToOklchParams.h.offset + speed / speedToOklchParams.h.speed, 360)
  const a = useAlpha ? clamplerp(speed, speedToOklchParams.a.left, speedToOklchParams.a.right, speedToOklchParams.a.from, speedToOklchParams.a.to) : 1

  return [l, c, h, a]
}
/**
 * in css:
 * oklch(
    max(40%, min(80%, calc(80% + (var(--speed) - 500) / 250 * -40%)))
    max(10%, min(40%, calc(40% + (var(--speed) - 500) / 300 * -30%)))
    calc(210 - var(--speed) / 2.4))
 */

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

const hexCache = new Map<speed, string>()
export function speedToHexCached(speed: speed) {
  if (hexCache.has(speed)) return hexCache.get(speed)!
  const hex = speedToHex(Math.abs(speed))
  hexCache.set(speed, hex)
  return hex
}

export function formatTCode(tcode: string, format = true) {
  if (!format) return tcode
  return tcode.replaceAll(
    /\b([LR])(\d)(\d+)(?:([IS])(\d+))?/g,
    (s, a, b, c, d, e) =>
      `${a}${b}${c.padStart(4, '_')}${d ? '_' + d : ''}${e ? e.padStart(4, '_') : ''}`,
  )
}

export class TCodeAction extends
  (Array<number | string> as any as (new(...a: any[]) => readonly [axis: axis, pos: pos, type?: 'I' | 'S', target?: ms | speed])) {
  static from(a: TCodeTuple | [TCodeTuple]) {
    return new TCodeAction(...a)
  }

  constructor(...a: TCodeTuple | [TCodeTuple]) {
    super()
    ;(this as any as any[]).push(...(Array.isArray(a[0]) ? a[0] : a))
  }

  toString(ops?: { precision?: number, format?: boolean }) {
    const d = ops?.format ? '_' : ''

    let mantissa = clamp(this[1] / 100, 0, 1).toFixed(ops?.precision ?? 4)
    if (mantissa.startsWith('1')) mantissa = '0.999999999'
    mantissa = mantissa.slice(2).slice(0, ops?.precision ?? 4)
    if (d) mantissa = mantissa.padStart(ops?.precision ?? 4, '_')
    else mantissa = mantissa.replace(/(?<=.)0+$/, '')

    const target = this[3] ?? 0
    const speedText = clamp(target, 0, 9999).toFixed(0)
    const intervalText = clamp(target, 0, 99999).toFixed(0)
    const postfix
     = this[2] === 'I'
       ? `${d}I${d}${intervalText.padStart(d ? 3 : 0, '_')}`
       : this[2] === 'S'
         ? `${d}S${d}${speedText.padStart(d ? 3 : 0, '_')}`
         : ''
    return `${this[0]}${d}${mantissa}${postfix}`
  }
}

export class TCodeList extends Array<TCodeAction> {
  static from(arrayLike: TCodeTuple[]): TCodeList {
    return new TCodeList(...arrayLike.map(e => new TCodeAction(e)))
  }

  toString(ops?: { precision?: number, format?: boolean }) {
    if (!this.length) return ''
    return this.map(e => e.toString(ops)).join(' ') + '\n'
  }
}
