import type { FunAction } from '..'
import type { mantissaText, pos, speed } from '../types'

export { oklch2rgb } from 'colorizr'

export function clamp(value: number, left: number, right: number) {
  return Math.max(left, Math.min(right, value))
}

export function lerp(left: number, right: number, t: number) {
  return left * (1 - t) + right * t
}

export function unlerp(left: number, right: number, value: number) {
  if (left === right) return 0.5
  return (value - left) / (right - left)
}

export function clamplerp(
  value: number,
  inMin: number,
  inMax: number,
  outMin: number,
  outMax: number,
): number {
  return lerp(outMin, outMax, clamp(unlerp(inMin, inMax, value), 0, 1))
}

export function listToSum(list: number[]) {
  return list.reduce((a, b) => a + b, 0)
}

export function speedBetween(a: FunAction | undefined, b: FunAction | undefined): speed {
  if (!a || !b) return 0 as speed
  if (a.at === b.at) return 0 as speed
  // Convert to u/s by multiplying by 1000 (ms to s)
  return ((b.pos - a.pos) / (b.at - a.at) * 1000) as speed
}

export function absSpeedBetween(a: FunAction | undefined, b: FunAction | undefined): speed {
  return Math.abs(speedBetween(a, b))
}

export function segmentSpeed(segment: FunAction[]): speed {
  return speedBetween(segment[0], segment.at(-1))
}

export function segmentAbsSpeed(segment: FunAction[]): speed {
  return Math.abs(segmentSpeed(segment))
}

export function minBy<T>(list: T[], fn: (item: T) => number): T {
  const values = list.map(fn)
  const minIndex = values.reduce((a, b, i) => b < values[a] ? i : a, 0)
  return list[minIndex]
}

/**
 * Compare two values with an order array
 * - If both are in the order array, return the indexOf difference
 * - Missing strings are compared lexicographically
 * - `undefined`s are placed in the very end
 */
export function compareWithOrder(a: string | undefined, b: string | undefined, order: (string | undefined)[]): number {
  const N = order.length
  let aIndex = order.indexOf(a)
  let bIndex = order.indexOf(b)
  aIndex = aIndex > -1 ? aIndex : a ? N : a === '' ? N + 1 : N + 2
  bIndex = bIndex > -1 ? bIndex : b ? N : b === '' ? N + 1 : N + 2
  if (aIndex !== bIndex) return aIndex - bIndex
  // both are strings
  if (aIndex === N) {
    return a === b ? 0 : a! < b! ? -1 : 1
  }
  return 0
}

export function toMantissa(value: pos, trim = false): mantissaText {
  let text = clamp(value / 100, 0, 0.9999).toFixed(4).slice(2)
  if (trim) text = text.replace(/(?<=.)0+$/, '')
  return text as mantissaText
}

export function makeNonEnumerable<T extends object, K extends keyof T>(
  target: T,
  key: K,
  value?: T[K],
): T {
  return Object.defineProperty(target, key, {
    value: value ?? target[key],
    writable: true,
    configurable: true,
    enumerable: false,
  })
}

/**
 * Generic clone utility that preserves the constructor type
 */
export function clone<T>(obj: T, ...args: any[]): T {
  return new ((obj as any).constructor)(obj, ...args) as T
}

export function mapObject<S extends object, R>(obj: S, fn: (value: S[keyof S], key: keyof S) => R): Record<keyof S, R> {
  return Object.fromEntries(Object.entries(obj).map(([key, value]) => [key, fn(value as S[keyof S], key as keyof S)])) as Record<keyof S, R>
}

export function isEmpty(o?: object) {
  if (!o) return true
  if (Array.isArray(o)) return o.length === 0
  return Object.keys(o).length === 0
}

export function toValues<T>(o?: Record<any, T> | T[]): T[] {
  if (!o) return []
  if (Array.isArray(o)) return [...o]
  return Object.values(o)
}
