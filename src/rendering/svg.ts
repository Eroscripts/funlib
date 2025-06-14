import type { Funscript, ms } from '..'
import { FunAction } from '..'
import { speedToHexCached } from '../converter'
import { actionsToLines, actionsToZigzag, mergeLinesSpeed } from '../manipulations'
import { lerp } from '../misc'

export interface SvgOptions {
  // rendering
  /** width of graph lines */
  lineWidth?: number
  /** text to display in the header */
  title?: ((script: Funscript) => string) | string | null
  /** font to use for text */
  font?: string
  /** font to use for axis text */
  axisFont?: string
  /** halo around text */
  halo?: boolean
  /** replace header heatmap with solid color */
  solidHeaderBackground?: boolean
  /** opacity of the graph background (heatmap) */
  graphOpacity?: number
  /** opacity of the header background (heatmap) */
  headerOpacity?: number
  /** heatmap precition */
  mergeLimit?: number
  /** normalize actions before rendering */
  normalize?: boolean
  /** truncate title with ellipsis if too long */
  titleEllipsis?: boolean
  /** move title to separate line, doubling header height */
  titleSeparateLine?: boolean | 'auto'

  // sizing
  /** width of funscript axis */
  width?: number
  /** height of funscript axis */
  height?: number
  /** height of header */
  headerHeight?: number
  /** spacing between header and graph */
  headerSpacing?: number
  /** width of funscript axis */
  axisWidth?: number
  /** margin between funscript axis and graph */
  axisSpacing?: number
  /** duration in milliseconds. Set to 0 to use script.actualDuration */
  durationMs?: ms | 0
}
/** y between one axis G and the next */
const SPACING_BETWEEN_AXES = 0
/** y between one funscript and the next */
const SPACING_BETWEEN_FUNSCRIPTS = 4
/** padding around the svg, reduces width and adds to y */
const SVG_PADDING = 0

export const svgDefaultOptions: Required<SvgOptions> = {
  title: null,
  lineWidth: 0.5,
  font: 'Arial, sans-serif',
  axisFont: 'Consolas, monospace',
  halo: true,
  solidHeaderBackground: false,
  graphOpacity: 0.2,
  headerOpacity: 0.7,
  mergeLimit: 500,
  normalize: true,
  titleEllipsis: true,
  titleSeparateLine: 'auto',
  width: 690,
  height: 52,
  headerHeight: 20,
  headerSpacing: 0,
  axisWidth: 46,
  axisSpacing: 0,
  durationMs: 0,
}

export type SvgSubOptions<K extends keyof SvgOptions> = {
  [P in K]-?: Required<SvgOptions>[P]
}

const isBrowser = typeof document !== 'undefined'

export function textToSvgLength(text: string, font: string) {
  if (!isBrowser) return 0

  const canvas = document.createElement('canvas')
  const context = canvas.getContext('2d')!
  context.font = font
  const width = context.measureText(text).width
  return width
}

/**
 * Escapes text for safe usage in SVG by converting special characters to HTML entities.
 * Works in both browser and non-browser environments without DOM manipulation.
 */
export function textToSvgText(text: string): string {
  if (!text) return text

  // Define HTML entity mappings for characters that need escaping in SVG
  const entityMap: Record<string, string> = {
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    '"': '&quot;',
    '\'': '&#39;',
    '/': '&#x2F;',
  }

  return text.replace(/[&<>"'/]/g, char => entityMap[char] || char)
}

/**
 * Truncates text with ellipsis to fit within the specified width.
 * Uses a simple while loop to iteratively remove characters until the text fits.
 */
export function truncateTextWithEllipsis(text: string, maxWidth: number, font: string): string {
  if (!text) return text
  if (textToSvgLength(text, font) <= maxWidth) return text

  while (text && textToSvgLength(text + '…', font) > maxWidth) {
    text = text.slice(0, -1)
  }
  return text + '…'
}

/**
 * Converts a Funscript to SVG path elements representing the motion lines.
 * Each line is colored based on speed and positioned within the specified dimensions.
 */
export function toSvgLines(
  script: Funscript,
  ops: SvgSubOptions<'durationMs' | 'mergeLimit' | 'lineWidth'>,
  ctx: { width: number, height: number },
) {
  const { lineWidth, mergeLimit, durationMs } = ops
  const { width, height } = ctx
  function lineToStroke(a: FunAction, b: FunAction) {
    const at = (a: FunAction) => ((a.at / 1000) / (durationMs / 1000) * (width - 2 * lineWidth)) + lineWidth
    const pos = (a: FunAction) => (100 - a.pos) * (height - 2 * lineWidth) / 100 + lineWidth
    return `M ${at(a)} ${pos(a)} L ${at(b)} ${pos(b)}`
  }
  const lines = actionsToLines(script.actions)
  mergeLinesSpeed(lines, mergeLimit)

  lines.sort((a, b) => a[2] - b[2])
  // global styles: stroke-width="${w}" fill="none" stroke-linecap="round"
  return lines.map(([a, b, speed]) => `<path d="${lineToStroke(a, b)}" stroke="${speedToHexCached(speed)}"></path>`).join('\n')
}

/**
 * Creates an SVG linear gradient definition based on a Funscript's speed variations over time.
 * The gradient represents speed changes throughout the script duration with color transitions.
 */
export function toSvgBackgroundGradient(
  script: Funscript,
  { durationMs }: SvgSubOptions<'durationMs'>,
  linearGradientId: string,
) {
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
      const at = (a.at + b.at) / 2
      return { at, speed }
    })
  // add start, first, last, end stops
  if (lines.length) {
    const first = lines[0], last = lines.at(-1)!
    stops.unshift({ at: first[0].at, speed: first[2] })
    if (first[0].at > 100) {
      stops.unshift({ at: first[0].at - 100, speed: 0 })
    }
    stops.push({ at: last[1].at, speed: last[2] })
    if (last[1].at < durationMs - 100) {
      stops.push({ at: last[1].at + 100, speed: 0 })
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
      <linearGradient id="${linearGradientId}">
        ${stops.map(s => `<stop offset="${Math.max(0, Math.min(1, s.at / durationMs))}" stop-color="${speedToHexCached(s.speed)}"${(
            s.speed >= 100 ? '' : ` stop-opacity="${s.speed / 100}"`
          )}></stop>`).join('\n          ')
        }
      </linearGradient>`
}

/**
 * Creates a complete SVG background with gradient fill based on a Funscript's speed patterns.
 * Includes both the gradient definition and the rectangle that uses it.
 */
export function toSvgBackground(
  script: Funscript,
  ops: SvgSubOptions<'width' | 'height' | 'durationMs'>,
  ctx?: { bgOpacity?: number, rectId?: string },
) {
  const { width, height, durationMs } = ops
  const { bgOpacity, rectId } = ctx ?? {}
  const id = `grad_${Math.random().toString(26).slice(2)}`

  return `
    <defs>${toSvgBackgroundGradient(script, { durationMs }, id)}</defs>
    <rect${rectId ? ` id="${rectId}"` : ''} width="${width}" height="${height}" fill="url(#${id})" opacity="${bgOpacity ?? svgDefaultOptions.graphOpacity}"></rect>`
}

/**
 * Creates a complete SVG document containing multiple Funscripts arranged vertically.
 * Each script and its axes are rendered as separate visual blocks with proper spacing.
 */
export function toSvgElement(scripts: Funscript | Funscript[], ops: SvgOptions): string {
  scripts = Array.isArray(scripts) ? scripts : [scripts]
  const fullOps = { ...svgDefaultOptions, ...ops }
  fullOps.width -= SVG_PADDING * 2

  const pieces: string[] = []
  let y = SVG_PADDING
  for (const s of scripts) {
    const durationMs = fullOps.durationMs || s.actualDuration * 1000
    // Only show title for the first script
    pieces.push(toSvgG(s, { ...fullOps, durationMs, title: fullOps.title }, {
      transform: `translate(${SVG_PADDING}, ${y})`,
      onDoubleTitle: () => y += fullOps.headerHeight,
    }))
    y += fullOps.height + SPACING_BETWEEN_AXES
    for (const a of s.axes) {
      // Axes never show title
      pieces.push(toSvgG(a, { ...fullOps, durationMs, title: fullOps.title ?? '' }, {
        transform: `translate(${SVG_PADDING}, ${y})`,
        isSecondaryAxis: true,
        onDoubleTitle: () => y += fullOps.headerHeight,
      }))
      y += fullOps.height + SPACING_BETWEEN_AXES
    }
    y += SPACING_BETWEEN_FUNSCRIPTS - SPACING_BETWEEN_AXES
  }
  y -= SPACING_BETWEEN_FUNSCRIPTS
  y += SVG_PADDING

  return `<svg class="funsvg" width="${fullOps.width}" height="${y}" xmlns="http://www.w3.org/2000/svg"
    font-size="14px" font-family="${fullOps.font}"
  >
    ${pieces.join('\n')}
  </svg>`
}

/**
 * Creates an SVG group (g) element for a single Funscript with complete visualization.
 * Includes background, graph lines, titles, statistics, axis labels, and borders.
 * This is the core rendering function for individual script visualization.
 */
export function toSvgG(
  script: Funscript,
  ops: SvgSubOptions<keyof SvgOptions>,
  ctx: { transform: string, onDoubleTitle: () => void, isSecondaryAxis?: boolean },
) {
  const {
    title: rawTitle,
    lineWidth: w,
    graphOpacity,
    headerOpacity,
    headerHeight,
    headerSpacing,
    height,
    axisWidth,
    axisSpacing,
    axisFont,
    normalize,
    width,
    solidHeaderBackground,
    titleEllipsis,
    titleSeparateLine,
    font,
    durationMs,
  } = ops
  const { isSecondaryAxis } = ctx

  // Resolve title to string once
  let title: string = ''
  if (rawTitle !== null) {
    title = typeof rawTitle === 'function' ? rawTitle(script) : rawTitle
  } else {
    if (script.file?.filePath) {
      title = script.file.filePath
    } else if (script.parent?.file) {
      // title = '<' + axisToName(script.id) + '>'
      title = ''
    }
  }
  const stats = script.toStats({ durationMs })
  if (isSecondaryAxis) delete (stats as Partial<typeof stats>).Duration

  const statCount = Object.keys(stats).length

  let useSeparateLine = false

  // Define x positions for key SVG elements
  const xx = {
    axisStart: 0, // Start of axis area
    axisEnd: axisWidth, // End of axis area
    titleStart: axisWidth + axisSpacing, // Start of title/graph area (after axis + spacing)
    svgEnd: width, // End of SVG (full width)
    graphWidth: width - axisWidth - axisSpacing, // Width of the graph area
    statText: (i: number) => width - 7 - i * 46, // X position for stat labels/values
    get axisText() { return this.axisEnd / 2 }, // X position for axis text (centered)
    get headerText() { return this.titleStart + 3 }, // X position for header text
    get textWidth() { return this.statText(useSeparateLine ? 0 : statCount) - this.headerText },
  }

  if (title && titleSeparateLine !== false
    && textToSvgLength(title, `14px ${font}`) > xx.textWidth) {
    useSeparateLine = true
  }
  if (title && titleEllipsis
    && textToSvgLength(title, `14px ${font}`) > xx.textWidth) {
    title = truncateTextWithEllipsis(title, xx.textWidth, `14px ${font}`)
  }
  if (useSeparateLine) {
    ctx.onDoubleTitle()
  }

  // Calculate the actual graph height from total height
  const graphHeight = height - headerHeight - headerSpacing

  script = script.clone()
  if (normalize) script.normalize()

  const isForHandy = '_isForHandy' in script && script._isForHandy
  let axis: string = script.id ?? 'L0'
  if (isForHandy) axis = '☞'

  // repair:
  const badActions = script.actions.filter(e => !Number.isFinite(e.pos))
  if (badActions.length) {
    console.log('badActions', badActions)
    badActions.map(e => e.pos = 120)
    title += '::bad'
    axis = '!!!'
  }
  const round = (x: number) => +x.toFixed(2)

  // Define y positions for key SVG elements
  const yy = {
    top: 0, // Top of SVG
    get headerExtra() { return useSeparateLine ? headerHeight : 0 },
    get titleBottom() { return headerHeight + this.headerExtra }, // Bottom of title area
    get graphTop() { return this.titleBottom + headerSpacing }, // Top of graph area
    get svgBottom() { return height + this.headerExtra }, // Bottom of SVG (total block height)
    get axisText() { return (this.top + this.svgBottom) / 2 + 4 + this.headerExtra / 2 }, // Y position for axis text (centered)
    headerText: headerHeight / 2 + 5, // Y position for header text
    get statLabelText() { return this.headerText - 8 + this.headerExtra }, // Y position for stat labels
    get statValueText() { return this.headerText + 2 + this.headerExtra }, // Y position for stat values
  }
  const bgGradientId = `funsvg-grad-${Math.random().toString(26).slice(2)}`

  const axisColor = speedToHexCached(stats.AvgSpeed)
  const axisOpacity = round(headerOpacity * Math.max(0.5, Math.min(1, stats.AvgSpeed / 100)))

  return `
    <g transform="${ctx.transform}">
      
      <g class="funsvg-bgs">
        <defs>${toSvgBackgroundGradient(script, { durationMs }, bgGradientId)}</defs>
        <rect class="funsvg-bg-axis-drop" x="0" y="${yy.top}" width="${xx.axisEnd}" height="${yy.svgBottom - yy.top}" fill="#ccc" opacity="${round(graphOpacity * 1.5)}"></rect>
        <rect class="funsvg-bg-title-drop" x="${xx.titleStart}" width="${xx.graphWidth}" height="${yy.titleBottom}" fill="#ccc" opacity="${round(graphOpacity * 1.5)}"></rect>
        <rect class="funsvg-bg-axis" x="0" y="${yy.top}" width="${xx.axisEnd}" height="${yy.svgBottom - yy.top}" fill="${axisColor}" opacity="${axisOpacity}"></rect>
        <rect class="funsvg-bg-title" x="${xx.titleStart}" width="${xx.graphWidth}" height="${yy.titleBottom}" fill="${solidHeaderBackground ? axisColor : `url(#${bgGradientId})`}" opacity="${round(solidHeaderBackground ? axisOpacity * headerOpacity : headerOpacity)}"></rect>
        <rect class="funsvg-bg-graph" x="${xx.titleStart}" width="${xx.graphWidth}" y="${yy.graphTop}" height="${graphHeight}" fill="url(#${bgGradientId})" opacity="${round(graphOpacity)}"></rect>
      </g>


      <g class="funsvg-lines" transform="translate(${xx.titleStart}, ${yy.graphTop})" stroke-width="${w}" fill="none" stroke-linecap="round">
        ${toSvgLines(script, ops, { width: xx.graphWidth, height: graphHeight })}
      </g>
      
      <g class="funsvg-titles">
        ${!ops.halo
          ? ''
          : ` <g class="funsvg-titles-halo" stroke="white" opacity="0.5" paint-order="stroke fill markers" stroke-width="3" stroke-dasharray="none" stroke-linejoin="round" fill="transparent">
                <text class="funsvg-title-halo" x="${xx.headerText}" y="${yy.headerText}"> ${textToSvgText(title)} </text>
                ${Object.entries(stats).reverse().map(([k, v], i) => `
                    <text class="funsvg-stat-label-halo" x="${xx.statText(i)}" y="${yy.statLabelText}" font-weight="bold" font-size="50%" text-anchor="end"> ${k} </text>
                    <text class="funsvg-stat-value-halo" x="${xx.statText(i)}" y="${yy.statValueText}" font-weight="bold" font-size="90%" text-anchor="end"> ${v} </text>
                  `).reverse().join('\n')
                } 
              </g>`}
        <text class="funsvg-axis" x="${xx.axisText}" y="${yy.axisText}" font-size="250%" font-family="${axisFont}" text-anchor="middle" dominant-baseline="middle"> ${axis} </text>
        <text class="funsvg-title" x="${xx.headerText}" y="${yy.headerText}"> ${textToSvgText(title)} </text>
        ${Object.entries(stats).reverse().map(([k, v], i) => `
            <text class="funsvg-stat-label" x="${xx.statText(i)}" y="${yy.statLabelText}" font-weight="bold" font-size="50%" text-anchor="end"> ${k} </text>
            <text class="funsvg-stat-value" x="${xx.statText(i)}" y="${yy.statValueText}" font-weight="bold" font-size="90%" text-anchor="end"> ${v} </text>
          `).reverse().join('\n')
        } 
      </g>
    </g>
    `
  //  lengthAdjust="spacingAndGlyphs" ${textToSvgLength(title, `14px ${ops.font}`) > xx.graphWidth - 6 ? `textLength="${xx.graphWidth - 6}"` : ''
  //             }
  // <g class="funsvg-borders">
  //   ${(
  //       axisTitleTop === yy[0]
  //         ? ''
  //         : `<rect x="0" y="0" width="${xx[1]}" height="20" stroke="${color}" stroke-width="0.2" fill="none"></rect>`
  //     )}
  //   <rect x="0" y="${axisTitleTop}" width="${xx[1]}" height="${yy[3] - axisTitleTop}" stroke="${color}" stroke-width="0.2" fill="none"></rect>
  //   <rect x="${xx[2]}" y="0" width="${graphWidth}" height="20" stroke="${color}" stroke-width="0.2" fill="none"></rect>
  //   <rect x="${xx[2]}" y="${yy[2]}" width="${graphWidth}" height="32" stroke="${color}" stroke-width="0.2" fill="none"></rect>
  //   <rect x="${-sw / 2}" y="${-sw / 2}" width="${xx[3] - 4 + sw}" height="${yy[3] + sw}" stroke="${'#eee'}" stroke-width="${sw}" fill="none"></rect>
  // </g>
}

/**
 * Creates a blob URL for downloading or displaying Funscript(s) as an SVG file.
 * Useful for generating downloadable SVG files or creating object URLs for display.
 */
export function toSvgBlobUrl(script: Funscript | Funscript[], ops: SvgOptions) {
  const svg = toSvgElement(script, ops)
  const blob = new Blob([svg], { type: 'image/svg+xml' })
  return URL.createObjectURL(blob)
}
