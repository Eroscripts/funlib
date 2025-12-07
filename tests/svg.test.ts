import type { JsonChapter } from '../src'
import { describe, expect, it } from 'bun:test'
import { Funscript } from '../src'
import { toSvgElement } from '../src/rendering/svg'
import { msToTimeSpan } from '../src/utils/converter'
import { createSine, createZigzag, writeSnapshotFile } from './utils/test-data'

describe('SVG Generation', () => {
  it('should generate SVG element for a funscript', () => {
    const script = new Funscript({
      actions: createZigzag({ }),
    })

    const svgElement = toSvgElement(script, {})
    expect(svgElement).toMatchSnapshot()

    writeSnapshotFile(svgElement, 'single-script.svg')
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

    writeSnapshotFile(svgElement, 'multiple-scripts.svg')
  })

  it('should render chapter bar when chapters are provided', () => {
    const script = new Funscript({
      actions: createZigzag({ timeStep: 400, points: 12 }),
      metadata: {
        title: 'Chaptered Script',
        chapters: [
          { name: 'Intro', startTime: '00:00:00.000', endTime: '00:00:02.000' },
          { name: 'Middle', startTime: '00:00:02.000', endTime: '00:00:03.600' },
          { name: 'Finale', startTime: '00:00:03.600', endTime: '00:00:05.000' },
        ],
        duration: 5,
      },
    })

    const svgElement = toSvgElement(script, {})
    expect(svgElement).toMatchSnapshot()

    writeSnapshotFile(svgElement, 'chaptered-script.svg')
  })

  it('should render chapter bar when a chapter is very short', () => {
    const chapters: JsonChapter[] = []
    let t = 0
    const add = (name: string, len: number): void => {
      chapters.push({
        name,
        startTime: msToTimeSpan(t * 1000),
        endTime: msToTimeSpan((t + len) * 1000),
      })
      t += len
    }
    // Base increasing chapters (~1-9%)
    ;[1, 2, 3, 4, 5, 6, 7, 8, 9].forEach((len, i) => add(`Ch${i + 1}`, len))
    // Three small 1% chapters to test palette and truncation labels
    ;['Ch11', 'Ch12', 'Ch13'].forEach(name => add(name, 1))
    const gapLength = 1
    add(`Gap`, gapLength)
    add(
      `This is a very very very long chapter name that should definitely be truncated in the bar because it is enormous`,
      100 - (t - gapLength),
    )
    // Drop gap
    chapters.splice(-2, 1)

    const script = new Funscript({
      actions: createZigzag({ timeStep: 2500, points: 41 }),
      metadata: {
        title: 'Short Chapter Script',
        chapters,
        duration: 100,
      },
    })

    const svgElement = toSvgElement(script, {})
    expect(svgElement).toMatchSnapshot()

    writeSnapshotFile(svgElement, 'chaptered-short.svg')
  })

  it('should render chapter bar when chapters overlap', () => {
    const script = new Funscript({
      actions: createZigzag({ timeStep: 300, points: 10 }),
      metadata: {
        title: 'Overlapping Chapters',
        chapters: [
          { name: 'Overlap A', startTime: '00:00:00.000', endTime: '00:00:03.000' },
          { name: 'Overlap B', startTime: '00:00:02.000', endTime: '00:00:05.000' },
          { name: 'Overlap C', startTime: '00:00:04.000', endTime: '00:00:06.000' },
        ],
        duration: 6,
      },
    })

    const svgElement = toSvgElement(script, {})
    expect(svgElement).toMatchSnapshot()

    writeSnapshotFile(svgElement, 'chaptered-overlap.svg')
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

    writeSnapshotFile(svgElement, 'custom-options.svg')
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
