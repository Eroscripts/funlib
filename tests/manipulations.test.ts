import { describe, expect, it } from 'bun:test'
import { FunAction } from '../src/index'
import { limitPeakSpeed } from '../src/manipulations'
import { speedBetween } from '../src/misc'

describe('limitPeakSpeed', () => {
  it('should properly limit speed in a 0-100-0-100-0 pattern', () => {
    const actions = [
      new FunAction({ at: 0, pos: 0 }),
      new FunAction({ at: 1000, pos: 100 }),
      new FunAction({ at: 2000, pos: 0 }),
      new FunAction({ at: 3000, pos: 100 }),
      new FunAction({ at: 4000, pos: 0 }),
      new FunAction({ at: 5000, pos: 100 }),
      new FunAction({ at: 6000, pos: 0 }),
      new FunAction({ at: 7000, pos: 100 }),
      new FunAction({ at: 8000, pos: 0 }),
    ]

    const expectedSpeeds = [100, -100, 100, -100, 100, -100, 100, -100, 0]
    const actualSpeeds = actions.map((action, i) => speedBetween(action, actions[i + 1]))
    expect(actualSpeeds).toEqual(expectedSpeeds)

    const MAX_SPEED = 50
    const limited = limitPeakSpeed(actions, MAX_SPEED)

    expect(limited.map(a => a.pos)).toEqual([25, 75, 25, 75, 25, 75, 25, 75, 25])

    const limitedSpeeds = limited.map((action, i) => speedBetween(action, limited[i + 1]))
    expect(limitedSpeeds).toEqual([50, -50, 50, -50, 50, -50, 50, -50, 0])

    const speeds = limitedSpeeds.map(speed => Math.abs(speed))
    console.log('Final speeds:', speeds)
    console.log('Max speed found:', Math.max(...speeds))
    console.log('Target max speed:', MAX_SPEED)
    expect(speeds.every(speed => speed <= MAX_SPEED + 1)).toBeTrue()
  })
})
