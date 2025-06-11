import type { Funscript } from '..'
import type { SvgOptions } from './svg'
import { axisToName } from '../converter'
import { svgDefaultOptions, textToSvgText, toSvgBackgroundGradient, toSvgLines } from './svg'

export function toGraphSvg(script: Funscript, { width = 640, height = 32, lineWidth = 0.5, mergeLimit = 500 }: {
  width?: number
  height?: number
  lineWidth?: number
  mergeLimit?: number
}): string {
  const normalizedScript = script.clone()
  normalizedScript.normalize()

  return `<svg width="${width}" height="${height}" xmlns="http://www.w3.org/2000/svg">
    <g stroke-width="${lineWidth}" fill="none" stroke-linecap="round">
      ${toSvgLines(normalizedScript, { width, height, w: lineWidth, mergeLimit })}
    </g>
  </svg>`
}

export function toHeatmapDataUrl(script: Funscript, { width = 640, height = 32 }: {
  width?: number
  height?: number
}): string {
  const normalizedScript = script.clone()
  normalizedScript.normalize()

  const gradientId = 'heatmap'
  const svg = `<svg width="${width}" height="${height}" xmlns="http://www.w3.org/2000/svg">
    <defs>${toSvgBackgroundGradient(normalizedScript, gradientId)}</defs>
    <rect width="${width}" height="${height}" fill="url(#${gradientId})"></rect>
  </svg>`

  const blob = new Blob([svg], { type: 'image/svg+xml' })
  return URL.createObjectURL(blob)
}

export function toHtmlElement(scripts: Funscript[], options: SvgOptions): string {
  const opts = { ...svgDefaultOptions, ...options }
  const graphWidth = opts.width - 60 // space for axis

  const scriptElements = scripts.map((script) => {
    const stats = script.toStats()
    const title = getScriptTitle(script, opts.title)
    const axisLabel = getAxisLabel(script)
    const graphSvg = toGraphSvg(script, {
      width: graphWidth,
      height: 32,
      lineWidth: opts.lineWidth,
      mergeLimit: opts.mergeLimit,
    })
    const heatmapUrl = toHeatmapDataUrl(script, { width: graphWidth, height: 32 })

    return `
      <div class="funscript-container" data-script-id="${script.id || ''}">
        <div class="funscript-header">
          <div class="axis-area">
            <span class="axis-label">${axisLabel}</span>
          </div>
          <div class="title-area">
            <span class="title">${textToSvgText(title)}</span>
          </div>
          <div class="stats-area">
            ${Object.entries(stats).reverse().map(([k, v]) => `
              <div class="stat">
                <div class="stat-label">${k}</div>
                <div class="stat-value">${v}</div>
              </div>
            `).join('')}
          </div>
        </div>
        <div class="funscript-graph">
          <div class="axis-spacer"></div>
          <div class="graph-area" 
               style="background-image: url('${heatmapUrl}'); background-size: cover;">
            <div class="graph-overlay">${graphSvg}</div>
          </div>
        </div>
      </div>
    `
  }).join('')

  return `
    <div class="funlib-visualization" style="width: ${opts.width}px; font-family: ${opts.font};">
      <style>${generateCSS(opts)}</style>
      ${scriptElements}
    </div>
  `
}

function getScriptTitle(script: Funscript, optionTitle?: string): string {
  if (optionTitle) return optionTitle
  if (script.file?.filePath) return script.file.filePath
  if (script.parent?.file) return '<' + axisToName(script.id) + '>'
  return ''
}

function getAxisLabel(script: Funscript): string {
  const isForHandy = '_isForHandy' in script && script._isForHandy
  if (isForHandy) return '☞'
  return script.id ?? 'L0'
}

function generateCSS(opts: Required<SvgOptions>): string {
  return `
    .funlib-visualization {
      font-size: 14px;
      line-height: 1.2;
    }
    
    .funscript-container {
      margin-bottom: ${opts.scriptSpacing}px;
      border: ${opts.outerBorder}px solid #eee;
      overflow: hidden;
    }
    
    .funscript-header {
      display: flex;
      height: 20px;
      background: rgba(204, 204, 204, ${opts.headerOpacity});
    }
    
    .axis-area {
      width: 46px;
      display: flex;
      align-items: center;
      justify-content: center;
      background: rgba(204, 204, 204, ${opts.graphOpacity * 1.5});
      margin-right: ${opts.midBorderX}px;
    }
    
    .axis-label {
      font-size: 250%;
      font-weight: bold;
    }
    
    .title-area {
      flex: 1;
      padding: 0 8px;
      display: flex;
      align-items: center;
      overflow: hidden;
    }
    
    .title {
      white-space: nowrap;
      overflow: hidden;
      text-overflow: ellipsis;
    }
    
    .stats-area {
      display: flex;
      gap: 46px;
      padding-right: 8px;
      align-items: center;
    }
    
    .stat {
      text-align: right;
      min-width: 38px;
    }
    
    .stat-label {
      font-size: 50%;
      font-weight: bold;
      line-height: 1;
    }
    
    .stat-value {
      font-size: 90%;
      font-weight: bold;
      line-height: 1;
    }
    
    .funscript-graph {
      display: flex;
      height: 32px;
      margin-top: ${opts.midBorderY}px;
    }
    
    .axis-spacer {
      width: ${46 + opts.midBorderX}px;
      background: rgba(204, 204, 204, ${opts.graphOpacity * 1.5});
    }
    
    .graph-area {
      flex: 1;
      position: relative;
      background-position: center;
      background-repeat: no-repeat;
    }
    
    .graph-overlay {
      position: absolute;
      top: 0;
      left: 0;
      right: 0;
      bottom: 0;
    }
    
    .graph-overlay svg {
      width: 100%;
      height: 100%;
    }
    
    ${opts.halo
      ? `
    .title, .axis-label, .stat-label, .stat-value {
      text-shadow: 1px 1px 0 white, -1px -1px 0 white, 1px -1px 0 white, -1px 1px 0 white;
    }
    `
      : ''}
  `
}

export function toHtmlBlobUrl(scripts: Funscript[], options: SvgOptions): string {
  const html = `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <style>
    body { margin: 0; padding: 16px; background: white; }
  </style>
</head>
<body>
  ${toHtmlElement(scripts, options)}
</body>
</html>`

  const blob = new Blob([html], { type: 'text/html' })
  return URL.createObjectURL(blob)
}
