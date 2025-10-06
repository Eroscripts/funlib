import { deepEquals } from 'bun'
import { describe, expect, it } from 'bun:test'
import { Funscript } from '../src'
import { createSine, createZigzag } from './utils/test-data'

function makeMultiAxis(): Funscript {
  const base = new Funscript({
    actions: createZigzag({ points: 6, timeStep: 200 }),
  }, { file: 'sample.funscript' })
  const surge = new Funscript({
    channel: 'surge' as any,
    actions: createSine({ points: 8, timeStep: 75, period: 150 }),
  }, { file: 'sample.surge.funscript' })
  const pitch = new Funscript({
    channel: 'pitch' as any,
    actions: createSine({ points: 7, timeStep: 100, period: 200 }),
  }, { file: 'sample.pitch.funscript' })

  const [merged] = Funscript.mergeMultiAxis([base, surge, pitch])
  return merged
}

describe('Multi-axis clone and versioned JSON roundtrip', () => {
  it('clones multi-axis scripts without breaking structure', () => {
    const merged = makeMultiAxis()
    const cloned = merged.clone()

    expect(deepEquals(merged, cloned)).toBe(true)
  })

  it.each(['1.0', '1.1', '2.0', '1.0-list'] as const)(
    'serialization-deserialization in %s produces identical text',
    (v) => {
      const merged = makeMultiAxis()
      const json = JSON.parse(merged.toJsonText({ version: v }))
      const copy = v !== '1.0-list'
        ? new Funscript(json)
        : Funscript.mergeMultiAxis(json.map((e: any) => new Funscript(e)))[0]
      expect(copy.toJsonText({ version: v })).toBe(merged.toJsonText({ version: v }))
    },
  )
  it.each(['1.0', '1.1', '2.0', '1.0-list'] as const)(
    'serialization-deserialization in %s produces identical script',
    (v) => {
      const merged = makeMultiAxis()
      const json = JSON.parse(merged.toJsonText({ version: v }))
      const copy = v !== '1.0-list'
        ? new Funscript(json)
        : Funscript.mergeMultiAxis(json.map((e: any) => new Funscript(e)))[0]
      if (v !== '1.0')
        expect(copy.toJsonText()).toBe(merged.toJsonText())
      else
        expect(copy.toJsonText()).not.toBe(merged.toJsonText())
    },
  )
})
