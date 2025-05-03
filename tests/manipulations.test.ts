import { describe, expect, it } from 'bun:test'
import { FunAction } from '../src/index'
import { limitPeakSpeed } from '../src/manipulations'

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
    FunAction.linkList(actions, {})

    expect(actions.map(a => a.speedFrom)).toEqual([100, -100, 100, -100, 100, -100, 100, -100, 0])

    const MAX_SPEED = 50
    const limited = limitPeakSpeed(actions, MAX_SPEED)

    expect(limited.map(a => a.pos)).toEqual([25, 75, 25, 75, 25, 75, 25, 75, 25])
    expect(limited.map(a => a.speedFrom)).toEqual([50, -50, 50, -50, 50, -50, 50, -50, 0])

    const speeds = limited.map(a => Math.abs(a.speedFrom))
    console.log('Final speeds:', speeds)
    console.log('Max speed found:', Math.max(...speeds))
    console.log('Target max speed:', MAX_SPEED)
    expect(speeds.every(speed => speed <= MAX_SPEED + 1)).toBeTrue()
  })
})
