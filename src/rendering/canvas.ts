import type { Funscript } from '..'
import type { ms } from '../types'
import { FunAction } from '..'
import { axisToName, speedToOklchText } from '../converter'
import { actionsToLines, actionsToZigzag, toStats } from '../manipulations'
import { lerp } from '../misc'

export function drawFunscriptGraph(
  ctx: HTMLCanvasElement | CanvasRenderingContext2D,
  funscript: Funscript,
  options: {
    width?: number
    height?: number
    atStart?: ms
    atEnd?: ms
    lineWidth?: number
    xScale?: number
    yScale?: number
    currentTime?: ms
  } = {},
) {
  ctx = ctx instanceof HTMLCanvasElement ? ctx.getContext('2d')! : ctx
  const { width = ctx.canvas.width, height = ctx.canvas.height } = options
  const { atStart = 0, atEnd = funscript.actualDuration * 1000, lineWidth = 1 } = options
  const { xScale = width / (atEnd - atStart), yScale = height / 100 } = options
  const { currentTime } = options

  // console.log({ width, height, atStart, atEnd, xScale, yScale });

  ctx.lineWidth = lineWidth

  const speedLines: FunAction[][] = []

  for (const a of funscript.actions) {
    (speedLines[~~Math.abs(a.speedFrom)] ??= []).push(a)
  }

  //   ctx.clearRect(0, 0, width, height)
  for (let speed = 0; speed < speedLines.length; speed++) {
    const lines = speedLines[speed]
    if (!lines)
      continue

    ctx.strokeStyle = speedToOklchText(speed)
    ctx.beginPath()
    for (const l of lines) {
      if (!l.nextAction)
        continue
      // console.log(l.datNext, l.dposNext);
      ctx.moveTo((l.at - atStart) * xScale, (100 - l.pos) * yScale)
      ctx.lineTo((l.nextAction.at - atStart) * xScale, (100 - l.nextAction.pos) * yScale)
    }
    ctx.stroke()
  }

  if (currentTime !== undefined) {
    const timeX = (currentTime - atStart) * xScale
    if (timeX >= 0 && timeX <= width) {
      ctx.strokeStyle = 'red'
      ctx.lineWidth = 2
      ctx.beginPath()
      ctx.moveTo(timeX, 0)
      ctx.lineTo(timeX, height)
      ctx.stroke()
    }
  }
}

export function makeGradient(
  ctx: CanvasRenderingContext2D,
  funscript: Funscript,
  options: { width?: number } = {},
): CanvasGradient {
  const { width = ctx.canvas.width } = options
  const durationMs = funscript.actualDuration * 1000

  // Create gradient object (horizontal from left to right)
  const gradient = ctx.createLinearGradient(0, 0, width, 0)

  if (durationMs <= 0 || funscript.actions.length === 0) {
    // Handle zero/negative duration or no actions: solid gradient with speed 0 color
    gradient.addColorStop(0, speedToOklchText(0))
    gradient.addColorStop(1, speedToOklchText(0))
    return gradient
  }

  // --- Logic adapted from toSvgBackgroundGradient ---

  // 1. Process actions into line segments with associated speed
  const lines = actionsToLines(actionsToZigzag(funscript.actions))
    .flatMap((e): Readonly<[FunAction, FunAction, number]>[] => {
      const [a, b, s] = e
      const len = b.at - a.at
      if (len <= 0) return []
      // Split long segments (>= 2s) into smaller parts (~1s)
      const N = Math.max(1, Math.floor((len - 500) / 1000))
      if (N === 1 || len < 2000) return [e]

      return Array.from({ length: N }, (_, i) => [
        new FunAction({ at: lerp(a.at, b.at, i / N), pos: lerp(a.pos, b.pos, i / N) }),
        new FunAction({ at: lerp(a.at, b.at, (i + 1) / N), pos: lerp(a.pos, b.pos, (i + 1) / N) }),
        s,
      ] as const)
    })

  // Merge segments if the combined length is < 1s (similar to SVG logic)
  for (let i = 0; i < lines.length - 1; i++) {
    const [a, b, ab_speed] = lines[i]
    const [c, d, cd_speed] = lines[i + 1]
    const combinedDuration = d.at - a.at

    if (combinedDuration < 1000 && combinedDuration > 0) {
      const duration1 = b.at - a.at
      const duration2 = d.at - c.at
      // Weighted average speed
      const mergedSpeed = (ab_speed * duration1 + cd_speed * duration2) / combinedDuration
      lines.splice(i, 2, [a, d, mergedSpeed])
      i-- // Re-evaluate the merged segment with the next one
    }
  }

  // 2. Calculate gradient stops from the processed line segments
  let stops: { at: ms, speed: number }[] = []
  if (lines.length > 0) {
    // Generate stops based on the midpoint of each segment
    stops = lines.map(([a, b, speed]) => ({
      at: (a.at + b.at) / 2,
      speed,
    }))

    // Add stops for the exact start/end times of the first/last segments
    const first = lines[0]
    const last = lines.at(-1)!
    stops.push({ at: first[0].at, speed: first[2] })
    stops.push({ at: last[1].at, speed: last[2] })

    // Add stops at time 0 and durationMs, using adjacent speeds or speed 0
    if (first[0].at > 0) {
      stops.push({ at: 0, speed: first[0].at > 100 ? 0 : first[2] })
    }
    if (last[1].at < durationMs) {
      stops.push({ at: durationMs, speed: durationMs - last[1].at > 100 ? 0 : last[2] })
    }
  } else {
    // Fallback if lines somehow become empty after processing
    stops = [{ at: 0, speed: 0 }, { at: durationMs, speed: 0 }]
  }

  // 3. Sort, filter, and normalize stops
  stops.sort((a, b) => a.at - b.at)

  // Remove consecutive stops with the same time (keep first)
  stops = stops.filter((stop, index, arr) => index === 0 || stop.at > arr[index - 1].at)

  // Filter based on speed changes (similar to SVG logic)
  stops = stops.filter((e, i, a) => {
    const p = a[i - 1]
    const n = a[i + 1]
    if (!p || !n) return true
    // Keep if speed is different from neighbors
    return p.speed !== e.speed || e.speed !== n.speed
  })

  // Ensure stops at 0 and durationMs exist after filtering
  if (!stops.some(s => s.at === 0)) {
    stops.push({ at: 0, speed: stops[0]?.speed ?? 0 })
  }
  if (!stops.some(s => s.at === durationMs)) {
    stops.push({ at: durationMs, speed: stops.at(-1)?.speed ?? 0 })
  }

  // Final sort and unique times
  stops.sort((a, b) => a.at - b.at)
  stops = stops.filter((stop, index, arr) => index === 0 || stop.at > arr[index - 1].at)

  // --- End of adapted logic ---

  // 4. Add color stops to the canvas gradient
  for (const stop of stops) {
    const offset = Math.max(0, Math.min(1, stop.at / durationMs))
    const color = speedToOklchText(stop.speed)
    if (!Number.isNaN(offset)) {
      gradient.addColorStop(offset, color)
    }
  }

  return gradient
}

// --- Options Interface (adapted from SvgOptions) ---
export interface CanvasFunscriptOptions {
  titleFont?: string
  statFont?: string
  axisFont?: string
  textColor?: string

  lineWidth?: number // For graph lines
  borderWidth?: number // For section borders
  borderColor?: string

  midBorderX?: number // Space between axis/stats and graph
  midBorderY?: number // Space between title and graph
  outerBorder?: number // Padding around each script block

  bgOpacity?: number
  headerOpacity?: number
  mergeLimit?: number // For line simplification in drawFunscriptGraph (if needed)

  normalize?: boolean // Whether to normalize script values before drawing

  scriptSpacing?: number // Vertical space between script blocks
}

export const canvasDefaultOptions: Required<Omit<CanvasFunscriptOptions, 'mergeLimit'>> = {
  titleFont: '14px Consolas',
  statFont: 'bold 12px Consolas',
  axisFont: 'bold 25px Consolas', // Made axis font larger
  textColor: 'black', // Default text color

  lineWidth: 0.5,
  borderWidth: 0.2,
  borderColor: '#ccc', // Light grey for borders

  midBorderX: 0,
  midBorderY: 0,
  outerBorder: 2, // Added small outer border

  bgOpacity: 0.2,
  headerOpacity: 0.7,
  // mergeLimit is handled within drawing functions if necessary

  scriptSpacing: 4,
  normalize: true,
}

// --- Main Drawing Function ---

/**
 * Draws multiple funscripts onto a canvas context, arranged vertically.
 * Similar in layout to `toSvgElement`.
 */
export function drawFunscriptsCanvas(
  target: HTMLCanvasElement | CanvasRenderingContext2D | null,
  scripts: Funscript[],
  options: CanvasFunscriptOptions = {},
): HTMLCanvasElement | null {
  const fullOps = { ...canvasDefaultOptions, ...options }
  const {
    lineWidth,
    borderWidth,
    borderColor,
    midBorderX,
    midBorderY,
    outerBorder,
    bgOpacity,
    headerOpacity,
    scriptSpacing,
    normalize,
    titleFont,
    statFont,
    axisFont,
    textColor,
  } = fullOps

  // Check if running in a browser environment
  if (typeof document === 'undefined') {
    console.error('Canvas creation/manipulation requires a browser environment.')
    return null
  }

  // Define layout constants
  const AXIS_WIDTH = 46 - midBorderX
  const TITLE_HEIGHT = 20
  const GRAPH_HEIGHT = 32
  const TOTAL_WIDTH = 686 + outerBorder * 2 // Include outer borders in total width
  const SCRIPT_BLOCK_HEIGHT = TITLE_HEIGHT + midBorderY + GRAPH_HEIGHT // Base height of one script/axis block

  // Calculate total required height
  let calculatedHeight = outerBorder // Start with top border
  for (const script of scripts) {
    const numBlocks = 1 + script.axes.length // Main script + axes
    calculatedHeight += numBlocks * (SCRIPT_BLOCK_HEIGHT + midBorderY + outerBorder * 2) // Height of blocks
    calculatedHeight += (numBlocks - 1) * scriptSpacing // Spacing between blocks within a script group
    calculatedHeight += scriptSpacing // Add spacing after the last block of the group
  }
  // Remove the last scriptSpacing and add the final bottom border
  calculatedHeight = calculatedHeight - scriptSpacing + outerBorder

  // Determine canvas and context
  let canvas: HTMLCanvasElement

  if (target instanceof HTMLCanvasElement) {
    canvas = target
  } else if (target instanceof CanvasRenderingContext2D) {
    canvas = target.canvas
  } else {
    canvas = document.createElement('canvas')
  }

  // Set canvas dimensions
  canvas.width = TOTAL_WIDTH
  canvas.height = calculatedHeight

  // Get context AFTER setting dimensions and assign to const
  const ctx = canvas.getContext('2d')
  if (!ctx) {
    console.error('Failed to get 2D context from canvas.')
    return canvas // Return the canvas even if context fails
  }

  // Clear canvas before drawing
  ctx.clearRect(0, 0, canvas.width, canvas.height)

  ctx.save() // Save initial context state (fonts, colors etc.)

  let currentY = outerBorder // Initialize currentY HERE

  for (const script of scripts) {
    const scriptsToDraw = [script, ...script.axes] // Include main script and its axes

    for (const s of scriptsToDraw) {
      const scriptToDraw = normalize ? s.clone().normalize() : s.clone()

      // --- Prepare script-specific details ---
      const isForHandy = '_isForHandy' in scriptToDraw && scriptToDraw._isForHandy
      let title = scriptToDraw.file?.filePath ?? ''
      if (!title && scriptToDraw.parent?.file) {
        title = `${scriptToDraw.parent.file.filePath}::${axisToName(scriptToDraw.id)}`
      } else if (!title) {
        title = `Script ${scriptToDraw.id ?? 'L0'}` // Fallback title
      }

      let axis = scriptToDraw.id ?? 'L0'
      if (isForHandy) axis = '☞' as any

      const stats = toStats(scriptToDraw.actions, { durationSeconds: scriptToDraw.actualDuration })

      // Define areas (relative to the current block's top-left)
      const axisArea = { x: 0, y: TITLE_HEIGHT + midBorderY, width: AXIS_WIDTH, height: GRAPH_HEIGHT }
      const titleArea = { x: AXIS_WIDTH + midBorderX, y: 0, width: TOTAL_WIDTH - axisArea.width - midBorderX, height: TITLE_HEIGHT }
      const graphArea = { x: titleArea.x, y: axisArea.y, width: titleArea.width, height: GRAPH_HEIGHT }
      const axisTitleArea = { x: 0, y: 0, width: AXIS_WIDTH, height: TITLE_HEIGHT + midBorderY + GRAPH_HEIGHT } // For the large axis symbol background/text

      // --- Start Drawing Block ---
      ctx.save()
      ctx.translate(outerBorder, currentY) // Position the drawing block

      // 1. Draw Backgrounds
      ctx.globalAlpha = bgOpacity
      // Axis BG (Solid color based on AvgSpeed)
      const avgSpeedColor = speedToOklchText(stats.AvgSpeed) // Need speedToOklchText
      ctx.fillStyle = avgSpeedColor
      ctx.globalAlpha = headerOpacity * Math.max(0.5, Math.min(1, stats.AvgSpeed / 100))
      ctx.fillRect(axisArea.x, axisArea.y, axisArea.width, axisArea.height)

      // Title & Graph BG (Gradient)
      const gradient = makeGradient(ctx, scriptToDraw, { width: graphArea.width }) // Need makeGradient
      ctx.fillStyle = gradient
      // Title BG
      ctx.globalAlpha = headerOpacity
      ctx.fillRect(titleArea.x, titleArea.y, titleArea.width, titleArea.height)
      // Graph BG
      ctx.globalAlpha = bgOpacity
      ctx.fillRect(graphArea.x, graphArea.y, graphArea.width, graphArea.height)

      ctx.globalAlpha = 1.0 // Reset alpha

      // 2. Draw Graph Lines
      ctx.save()
      ctx.translate(graphArea.x, graphArea.y)
      ctx.beginPath() // Clip drawing to the graph area
      ctx.rect(0, 0, graphArea.width, graphArea.height)
      ctx.clip()
      drawFunscriptGraph(ctx, scriptToDraw, { // Need drawFunscriptGraph
        width: graphArea.width,
        height: graphArea.height,
        lineWidth,
        // Assuming drawFunscriptGraph uses 0-duration internally
      })
      ctx.restore() // Remove clipping path

      // 3. Draw Titles and Stats
      ctx.fillStyle = textColor
      // Axis Text
      ctx.font = axisFont
      ctx.textAlign = 'center'
      ctx.textBaseline = 'middle'
      ctx.fillText(axis, axisTitleArea.x + axisTitleArea.width / 2, axisTitleArea.y + axisTitleArea.height / 2 + 2) // Adjust baseline slightly

      // Title Text
      ctx.font = titleFont
      ctx.textAlign = 'left'
      ctx.textBaseline = 'middle'
      // Basic truncation if title is too long (can be improved)
      const maxTitleWidth = titleArea.width - 5 // Add padding
      const truncatedTitle = ctx.measureText(title).width > maxTitleWidth
        ? title.substring(0, 50) + '...' // Simple truncation
        : title
      ctx.fillText(truncatedTitle, titleArea.x + 3, titleArea.y + titleArea.height / 2)

      // Stats Text
      ctx.font = statFont
      ctx.textAlign = 'right'
      ctx.textBaseline = 'bottom' // Align to bottom for label/value pairs
      const statEntries = Object.entries(stats).reverse()
      const statSpacing = 46 // Spacing from SVG
      for (let i = 0; i < statEntries.length; i++) {
        const [key, value] = statEntries[i]
        const statX = titleArea.x + titleArea.width - i * statSpacing - 3 // Position from right edge
        // Value
        ctx.fillText(String(value), statX, titleArea.y + titleArea.height - 2)
        // Label (slightly smaller/above) - Approximation
        ctx.save()
        ctx.font = 'bold 8px Consolas' // Smaller font for label
        ctx.textBaseline = 'top'
        ctx.fillText(key, statX, titleArea.y + 2)
        ctx.restore()
      }

      // 4. Draw Borders
      ctx.strokeStyle = borderColor
      ctx.lineWidth = borderWidth
      // Inner borders
      ctx.strokeRect(axisArea.x, axisArea.y, axisArea.width, axisArea.height)
      ctx.strokeRect(titleArea.x, titleArea.y, titleArea.width, titleArea.height)
      ctx.strokeRect(graphArea.x, graphArea.y, graphArea.width, graphArea.height)
      if (TITLE_HEIGHT > 0 && AXIS_WIDTH > 0) { // Draw top-left axis cell border if applicable
        ctx.strokeRect(axisTitleArea.x, axisTitleArea.y, axisTitleArea.width, TITLE_HEIGHT)
      }

      // Restore context for next block
      ctx.restore()

      // --- Update Y position ---
      currentY += SCRIPT_BLOCK_HEIGHT + midBorderY + outerBorder * 2 + scriptSpacing // Add spacing for the next block
    } // End loop for script + axes

    // Adjust Y after a script group (remove last spacing added inside the loop)
    currentY -= scriptSpacing
  } // End loop for scripts array

  ctx.restore() // Restore initial context state

  return canvas // Return the canvas element
}
