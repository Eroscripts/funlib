import { describe, expect, it } from 'bun:test'
import { Funscript } from '../src/index'
import { toSvgElement } from '../src/rendering/svg'
import { createSine, createZigzag } from './utils/test-data'

describe('SVG Generation', () => {
  it('should generate SVG element for a funscript', () => {
    const script = new Funscript({
      actions: createZigzag({ }),
    })

    const svgElement = toSvgElement(script, {})
    expect(svgElement).toMatchSnapshot()
  })

  it('should generate SVG for multiple independent scripts', () => {
    const script1 = new Funscript({
      actions: createZigzag({ timeStep: 200, points: 6 }),
    }, {
      file: 'script1.funscript',
    })
    const script2 = new Funscript({
      actions: createSine({ timeStep: 40, period: 120, points: 15 }),
    }, {
      file: 'script2.funscript',
    })

    const scripts = [script1, script2]
    const svgElement = toSvgElement(scripts, {})
    expect(svgElement).toMatchSnapshot()
  })

  it('should generate SVG with all options overridden', () => {
    const script = new Funscript({
      actions: createSine({ points: 8, timeStep: 150, amplitude: 40, period: 300 }),
    }, {
      file: 'custom-script.funscript',
    })

    const svgElement = toSvgElement(script, {
      width: 800,
      height: 100,
      lineWidth: 2,
      title: 'Custom Title',
      font: 'Helvetica',
      iconFont: 'Arial',
      halo: false,
      solidTitleBackground: true,
      graphOpacity: 0.5,
      titleOpacity: 0.9,
      normalize: false,
      titleEllipsis: false,
      titleHeight: 30,
      iconWidth: 60,
    })
    expect(svgElement).toMatchSnapshot()
  })

  it('should clone merged script and match same snapshot', () => {
    const L0 = new Funscript({
      actions: createZigzag({ timeStep: 200, points: 8 }),
    }, {
      file: 'test-video.funscript',
    })
    const R1 = new Funscript({
      actions: createSine({ timeStep: 75, period: 150, points: 12 }),
    }, {
      file: 'test-video.roll.funscript',
    })
    const R2 = new Funscript({
      actions: createSine({ timeStep: 100, period: 200, points: 10 }),
    }, {
      file: 'test-video.pitch.funscript',
    })

    const scripts = [L0, R1, R2]
    const merged = Funscript.mergeMultiAxis(scripts)
    const mergedScript = merged[0]

    // Clone the merged script
    const clonedScript = mergedScript.clone()

    // Both should produce the same snapshot
    expect(mergedScript).toMatchSnapshot()
    expect(clonedScript).toMatchSnapshot()
  })
})
