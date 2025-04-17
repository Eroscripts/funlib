import type { Funscript } from '.'
import { FunAction } from '.'
import { axisToName, speedToHex } from './converter'
import { actionsToLines, actionsToZigzag, mergeLinesSpeed } from './manipulations'

export interface SvgOptions {
  title?: string
  lineWidth?: number
  midBorderX?: number
  midBorderY?: number
  outerBorder?: number

  bgOpacity?: number
  headerOpacity?: number
  mergeLimit?: number
  axisCells?: number
  normalize?: boolean

  scriptSpacing?: number
}

export const svgDefaultOptions: Required<SvgOptions> = {
  title: '',
  lineWidth: 0.5,
  midBorderX: 0,
  midBorderY: 0,
  outerBorder: 0,
  bgOpacity: 0.2,
  headerOpacity: 0.7,
  mergeLimit: 500,
  axisCells: 1,
  scriptSpacing: 4,
  normalize: true,
}

const isBrowser = typeof document !== 'undefined'

export function textToSvgLength(text: string, font: string) {
  if (!isBrowser) return 0

  const canvas = document.createElement('canvas')
  const context = canvas.getContext('2d')!
  context.font = font
  const width = context.measureText(text).width
  console.log({ width }, text)
  return width
}

export function textToSvgText(text: string) {
  if (!isBrowser) return text

  const span = document.createElement('span')
  span.textContent = text
  return span.innerHTML
}

export function toSvgLines(script: Funscript, width: number, height: number, w = 2, mergeLimit = 500) {
  const duration = script.actualDuration
  function lineToStroke(a: FunAction, b: FunAction) {
    const at = (a: FunAction) => (a.time / duration * (width - 2 * w)) + w
    const pos = (a: FunAction) => (100 - a.pos) * (height - 2 * w) / 100 + w
    return `M ${at(a)} ${pos(a)} L ${at(b)} ${pos(b)}`
  }
  const lines = actionsToLines(script.actions)
  mergeLinesSpeed(lines, mergeLimit)

  lines.sort((a, b) => a[2] - b[2])
  // global styles: stroke-width="${w}" fill="none" stroke-linecap="round"
  return lines.map(([a, b, speed]) => `<path d="${lineToStroke(a, b)}" stroke="${speedToHex(speed)}"></path>`).join('\n')
}

export function toSvgBackgroundGradient(script: Funscript, id: string) {
  const duration = script.actualDuration
  const lines = actionsToLines(actionsToZigzag(script.actions))
    .flatMap((e) => {
      const [a, b, s] = e
      const len = b.at - a.at
      if (len <= 0) return []
      if (len < 2000) return [e]
      // split into len/1000-1 periods
      const N = ~~((len - 500) / 1000)
      const ra = Array.from({ length: N }, (_, i) => {
        return [
          new FunAction({ at: lerp(a.at, b.at, i / N), pos: lerp(a.pos, b.pos, i / N) }),
          new FunAction({ at: lerp(a.at, b.at, (i + 1) / N), pos: lerp(a.pos, b.pos, (i + 1) / N) }),
          s,
        ] as const
      })
      return ra
    })
  // merge lines so they are at least 500 long
  for (let i = 0; i < lines.length - 1; i++) {
    const [a, b, ab] = lines[i], [c, d, cd] = lines[i + 1]
    if (d.at - a.at < 1000) {
      const speed = (ab * (b.at - a.at) + cd * (d.at - c.at)) / ((b.at - a.at) + (d.at - c.at))
      lines.splice(i, 2, [a, d, speed])
      i--
    }
  }
  let stops = lines
    .filter((e, i, a) => {
      const p = a[i - 1], n = a[i + 1]
      if (!p || !n) return true
      if (p[2] === e[2] && e[2] === n[2]) return false
      return true
    })
    .map(([a, b, speed]) => {
      const time = (a.time + b.time) / 2
      return { time, speed }
    })
  // add start, first, last, end stops
  if (lines.length) {
    const first = lines[0], last = lines.at(-1)!
    stops.unshift({ time: first[0].time, speed: first[2] })
    if (first[0].time > 0.1) {
      stops.unshift({ time: first[0].time - 0.1, speed: 0 })
    }
    stops.push({ time: last[1].time, speed: last[2] })
    if (last[1].time < duration - 0.1) {
      stops.push({ time: last[1].time + 0.1, speed: 0 })
    }
  }
  // remove duplicates
  stops = stops.filter((e, i, a) => {
    const p = a[i - 1], n = a[i + 1]
    if (!p || !n) return true
    if (p.speed === e.speed && e.speed === n.speed) return false
    return true
  })

  return `
      <linearGradient id="${id}">
        ${stops.map(s => `<stop offset="${Math.max(0, Math.min(1, s.time / duration))}" stop-color="${speedToHex(s.speed)}"${(
            s.speed >= 100 ? '' : ` stop-opacity="${s.speed / 100}"`
          )}></stop>`).join('\n          ')
        }
      </linearGradient>`
}

export function toSvgBackground(script: Funscript, width: number, height: number, _w = 2, bgOpacity = 0.2) {
  const id = `grad_${Math.random().toString(26).slice(2)}`

  return `
    <defs>${toSvgBackgroundGradient(script, id)}</defs>
    <rect id="rect1" width="${width}" height="${height}" fill="url(#${id})" opacity="${bgOpacity}"></rect>`
}

export function toSvgElement(scripts: Funscript[], ops: SvgOptions) {
  const fullOps = { ...svgDefaultOptions, ...ops }
  const pieces: string[] = []
  let y = 2
  for (const s of scripts) {
    pieces.push(toSvgG(s, {
      ...fullOps,
      transform: `translate(${2}, ${y})`,
    }))
    y += 52 + fullOps.midBorderY + fullOps.outerBorder
    for (const a of s.axes) {
      pieces.push(toSvgG(a, {
        ...fullOps,
        transform: `translate(${2}, ${y})`,
      }))
      y += 52 + fullOps.midBorderY + fullOps.outerBorder
    }
    y += fullOps.scriptSpacing
  }
  y -= fullOps.scriptSpacing
  y += 2

  return `<svg width="690" height="${y}" xmlns="http://www.w3.org/2000/svg"
    font-size="14px" font-family="Consolas"
  >
    ${pieces.join('\n')}
  </svg>`
}

export function toSvgG(script: Funscript, ops: Required<SvgOptions> & { transform: string }) {
  let {
    title,
    lineWidth: w,
    midBorderX: dw,
    midBorderY: dh,
    outerBorder: sw = 0,
    bgOpacity,
    headerOpacity,
    mergeLimit,
    axisCells,
    normalize = true,
  } = ops
  script = script.clone()
  if (normalize) script.normalize()

  const isForHandy = '_isForHandy' in script && script._isForHandy
  if (!title) {
    title = script.filePath || script.parent?.filePath || '[no parent]'
    if (script.parent) {
      if (isForHandy) title += '::handy'
      else if (!script.axes.length) title += `::${axisToName(script.id ?? 'L0')}`
    }
  }
  let axis = script.axis ?? 'L0'
  if (isForHandy) axis = '☞'

  // repair:
  const badActions = script.actions.filter(e => !Number.isFinite(e.pos))
  if (badActions.length) {
    console.log('badActions', badActions)
    badActions.map(e => e.pos = 120)
    title += '::bad'
    axis = '!!!'
  }

  const stats = script.toStats()
  const xx = [0, 46 - dw, 46, 640]
  const yy = [0, 20, 20 + dh, 20 + 32 + dh]
  const bgGradientId = `grad_${Math.random().toString(26).slice(2)}`

  const axisTitleTop = axisCells === 1 ? yy[0] : yy[2]
  const color = 'transparent'

  return `
    <g transform="${ops.transform}">

      <rect x="0" y="${axisTitleTop}" width="${xx[1]}" height="${yy[3] - axisTitleTop}" fill="${speedToHex(stats.AvgSpeed)}" opacity="${headerOpacity * Math.min(1, stats.AvgSpeed / 100)}"></rect>
      ${(
          axisTitleTop === yy[0]
            ? ''
            : `<rect x="0" y="0" width="${xx[1]}" height="20" stroke="${color}" stroke-width="0.2" fill="none"></rect>`
        )}
      <rect x="0" y="${axisTitleTop}" width="${xx[1]}" height="${yy[3] - axisTitleTop}" stroke="${color}" stroke-width="0.2" fill="none"></rect>
      <rect x="${xx[2]}" y="0" width="${xx[3]}" height="20" stroke="${color}" stroke-width="0.2" fill="none"></rect>
      <rect x="${xx[2]}" y="${yy[2]}" width="${xx[3]}" height="32" stroke="${color}" stroke-width="0.2" fill="none"></rect>

      <g transform="translate(${xx[2]}, 0)">
        <defs>${toSvgBackgroundGradient(script, bgGradientId)}</defs>
        <rect id="rect1" width="${xx[3]}" height="${yy[1]}" fill="#ccc" opacity="${bgOpacity * 1.5}"></rect>
        <rect id="rect1" width="${xx[3]}" height="${yy[1]}" fill="url(#${bgGradientId})" opacity="${headerOpacity}"></rect>
        <rect id="rect1" width="${xx[3]}" y="${yy[1]}" height="${yy[3] - yy[1]}" fill="url(#${bgGradientId})" opacity="${bgOpacity}"></rect>
      </g>
      <g transform="translate(${xx[2]}, ${yy[2]})" stroke-width="${w}" fill="none" stroke-linecap="round">
        ${toSvgLines(script, xx[3], 32, w, mergeLimit)}
      </g>
      
      <text x="${xx[1] / 2}" y="${(axisTitleTop + yy[3]) / 2 + (axisTitleTop === yy[2] ? 2 : 4)}" font-size="250%" text-anchor="middle" dominant-baseline="middle"> ${axis} </text>
      <text x="49" y="15" lengthAdjust="spacingAndGlyphs" ${textToSvgLength(title, '14px Consolas') > 450 ? 'textLength="450"' : ''
      }> ${textToSvgText(title)} </text>

      ${Object.entries(stats).reverse().map(([k, v], i) => `
          <text x="${683 - i * 46}" y="7" font-weight="bold" font-size="50%" text-anchor="end"> ${k} </text>
          <text x="${683 - i * 46}" y="17" font-weight="bold" font-size="90%" text-anchor="end"> ${v} </text>
        `).join('\n')
      } 

      <rect x="${-sw / 2}" y="${-sw / 2}" width="${686 + sw}" height="${yy[3] + sw}" stroke="${'#eee'}" stroke-width="${sw}" fill="none"></rect>
    </g>
  `
}

function lerp(min: number, max: number, t: number) {
  return min + t * (max - min)
}
