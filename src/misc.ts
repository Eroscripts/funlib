import type { FunAction } from '.'

export function defineValue(obj: any, key: string, value: any = undefined) {
  Object.defineProperty(obj, key, { value, enumerable: false, configurable: true, writable: true })
}

export function defineValueGetter(obj: any, key: string, value: any) {
  Object.defineProperty(obj, key, { get: () => value, enumerable: false, configurable: true })
}

export { oklch2rgb } from 'colorizr'

export function lerp(a: number, b: number, l: number) {
  return a * (1 - l) + b * l
}

export function unlerp(a: number, b: number, v: number) {
  if (a === b) return 0.5
  return (v - a) / (b - a)
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
