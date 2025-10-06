import { describe, expect, it } from 'bun:test'
import { Funscript } from '../src'
import { createSine, createZigzag } from './utils/test-data'

describe('Script Merging', () => {
  it('should merge multi-axis scripts by filename', () => {
    const L0 = new Funscript({
      actions: createZigzag({ timeStep: 200 }),
    }, {
      file: 'test-video.funscript',
    })
    const R1 = new Funscript({
      actions: createSine({ timeStep: 75, period: 150 }),
    }, {
      file: 'test-video.roll.funscript',
    })
    const R2 = new Funscript({
      actions: createSine({ timeStep: 100, period: 200 }),
    }, {
      file: 'test-video.pitch.funscript',
    })
    const unrelatedL0 = new Funscript({
      actions: createSine({ timeStep: 40, period: 120 }),
    }, {
      file: 'unrelated.funscript',
    })

    const scripts = [L0, R1, R2, unrelatedL0]
    const merged = Funscript.mergeMultiAxis(scripts)
    expect(merged).toMatchSnapshot()

    expect(
      merged.map(e => e.clone()),
    ).toMatchSnapshot()

    expect(merged[0].toJsonText()).toMatchSnapshot()
    expect(merged[0].toJsonText({ version: '1.1' })).toMatchSnapshot()
    expect(merged[0].toJsonText({ version: '1.0' })).toMatchSnapshot()
  })
})
