import type { JsonAction } from '../../src/types'
import { clamp } from '../../src/utils/misc'

export function createSine(
  { points = 10, timeStep = 50, amplitude = 25, period = 1000 }: { points?: number, timeStep?: number, amplitude?: number, period?: number } = {},
): JsonAction[] {
  return Array.from({ length: points }, (_, i) => ({
    at: i * timeStep,
    pos: ~~clamp(50 + amplitude * Math.sin((i * timeStep) / period * 2 * Math.PI), 0, 100),
  }))
}

export function createZigzag(
  { points = 10, timeStep = 200, amplitude = 25 }: { points?: number, timeStep?: number, amplitude?: number } = {},
): JsonAction[] {
  return Array.from({ length: points }, (_, i) => ({
    at: i * timeStep,
    pos: ~~clamp(50 + amplitude * (i % 2 === 0 ? 1 : -1), 0, 100),
  }))
}
