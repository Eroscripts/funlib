import type { axis, ms } from '../src/types'
import { describe, expect, it } from 'bun:test'
import { FunAction } from '../src'
import { getAxisTCodeFrom, tcodeTupleToString } from '../src/utils/tcode'

describe('getAxisTCodeFrom', () => {
  const axis: axis = '' as any

  const testCases = [
    { name: 'empty actions', actions: [] },
    { name: 'single action', actions: [{ at: 0, pos: 0 }] },
    { name: 'two actions', actions: [{ at: 0, pos: 0 }, { at: 1000, pos: 100 }] },
    { name: 'three actions', actions: [{ at: 0, pos: 0 }, { at: 1000, pos: 100 }, { at: 2000, pos: 50 }] },
  ]

  for (const testCase of testCases) {
    it(`should handle ${testCase.name}`, () => {
      const actions = testCase.actions.map(a => new FunAction(a))
      const times = [-1000, -500, 0, ...testCase.actions.flatMap(a => [a.at + 500, a.at + 1000])]
      const pairs = [undefined, ...times].map(since => times.map(at => ({ at, since })))

      const resultMap: Record<string, string> = {}

      pairs.flat().forEach(({ at, since }, i) => {
        const result = getAxisTCodeFrom(axis, actions, at as ms, since as ms | undefined)
        const draw = [undefined, ...times].map(t => t === at
          ? (t === since ? 'X' : '▲')
          : t === since
            ? '△'
            : t === undefined || t % 1000
              ? '-'
              : t < 0 || t >= testCase.actions.length * 1000 ? '_' : Math.abs(t / 1000),
        ).join(' ')

        resultMap[`${i.toFixed().padStart(2, '0')} ${draw}`] = result ? result.join('') : '-'
      })

      console.log(resultMap)

      expect(resultMap).toMatchSnapshot()
    })
  }

  for (const testCase of testCases) {
    for (const dt of [1, 5, 7, 13, 700]) {
      it(`should return proper total tcode for dt ${dt} for ${testCase.name}`, () => {
        const actions = testCase.actions.map(a => new FunAction(a))
        const axis = 'L0' as axis
        let codes: string = ''
        let since: ms | undefined
        for (let t: ms = -1000; t < 5000; t += dt) {
          const tcode = getAxisTCodeFrom(axis, actions, t, since)
          if (tcode) {
            codes += tcodeTupleToString(tcode) + ' '
          }
          since = t
        }
        expect(codes).toMatchSnapshot()
      })
    }
  }
})
