import { forwardRef, useEffect, useImperativeHandle, useRef } from 'react'
import * as Plot from '@observablehq/plot'
import type {
  Direction,
  PlacedSummit,
  RidgelinesResponse,
  Summit,
} from '@/types'

const SVG_NS = 'http://www.w3.org/2000/svg'
const FONT = 'Helvetica Neue, Helvetica, Arial, sans-serif'
const EXPORT_SCALE = 3 // rasterize at 3x the on-screen size for a decent print resolution
const JPEG_QUALITY = 0.92

// Frame fractions (down from north, across from west) → fractions in the viewer's orientation
const ORIENT: Record<
  Direction,
  (down: number, across: number) => [down: number, across: number]
> = {
  north: (down, across) => [down, across],
  south: (down, across) => [1 - down, 1 - across],
  east: (down, across) => [1 - across, down],
  west: (down, across) => [across, 1 - down],
}

// Put each summit on the highest drawn point near its position
function placeSummits(
  rows: number[][],
  direction: Direction,
  summits: Summit[],
): PlacedSummit[] {
  const n = rows.length
  const m = rows[0]!.length
  return summits.map((summit) => {
    const [down, across] = ORIENT[direction](summit.down, summit.across)
    const r = Math.min(Math.floor(down * n), n - 1)
    const c = Math.min(Math.floor(across * m), m - 1)
    let best = { row: r, col: c }
    for (let i = Math.max(r - 1, 0); i <= Math.min(r + 1, n - 1); i++) {
      for (let j = Math.max(c - 3, 0); j <= Math.min(c + 3, m - 1); j++) {
        if (rows[i]![j]! > rows[best.row]![best.col]!) best = { row: i, col: j }
      }
    }
    return { ...summit, ...best }
  })
}

function svgEl<K extends keyof SVGElementTagNameMap>(
  tag: K,
  attrs: Record<string, string | number> = {},
  text?: string,
): SVGElementTagNameMap[K] {
  const el = document.createElementNS(SVG_NS, tag) as SVGElementTagNameMap[K]
  for (const [k, v] of Object.entries(attrs)) el.setAttribute(k, String(v))
  if (text != null) el.textContent = text
  return el
}

function draw(
  container: HTMLDivElement,
  data: RidgelinesResponse,
  summits: Summit[],
  relief: number,
  labels: boolean,
  width: number,
  plotHeight: number,
) {
  const { rows, min, max, direction } = data
  const n = rows.length
  // Reserve label space up front so the chart doesn't jump when summits arrive
  const marginTop = labels ? 32 : 4
  const marginBottom = 4
  // Peak height stays fixed in pixels (a share of plotHeight, not of the row spacing),
  // so more lines don't flatten the relief
  const peakPx = relief * (plotHeight / 64)
  // Solve row spacing so marginTop + rowHeight*(n-1) + peakPx + marginBottom lands exactly on
  // plotHeight — the chart's rendered (and exported) aspect ratio must equal width:plotHeight,
  // not just approximate it, or the poster JPG comes out a different shape than the frame drawn
  // on the map.
  const rowHeight =
    n > 1
      ? (plotHeight - marginTop - marginBottom - peakPx) / (n - 1)
      : plotHeight - marginTop - marginBottom - peakPx
  const reliefRows = rowHeight > 0 ? peakPx / rowHeight : 0
  const span = max - min || 1
  // y is measured in "lines": line r sits on baseline -r; the highest point rises `reliefRows` lines above it
  const lift = (elev: number, row: number) =>
    ((elev - min) / span) * reliefRows - row

  const chart = Plot.plot({
    width,
    height: plotHeight,
    margin: 0,
    marginTop,
    marginBottom,
    style: { background: 'black' },
    x: { axis: null, domain: [0, rows[0]!.length - 1] },
    y: { axis: null, domain: [-(n - 1), reliefRows] },
    // One area + line pair per row, far → near, so nearer ridges occlude the ones behind
    marks: rows.flatMap((line, row) => [
      // Plot.areaY(line, {
      //   x: (_d: number, i: number) => i,
      //   y1: -row,
      //   y2: (d: number) => lift(d, row),
      //   fill: 'black',
      // }),
      Plot.lineY(line, {
        x: (_d: number, i: number) => i,
        y: (d: number) => lift(d, row),
        stroke: 'white',
        strokeWidth: Math.min(1.1, rowHeight * 0.17),
      }),
    ]),
  }) as unknown as SVGSVGElement & {
    scale: (name: string) => { apply: (v: number) => number }
  }

  if (labels && summits.length) {
    // Labels go on top of every ridge so nearer ones can't hide them
    const x = chart.scale('x')
    const y = chart.scale('y')
    const g = svgEl('g', {
      'font-size': 10,
      'letter-spacing': '0.08em',
      fill: 'white',
      'font-family': FONT,
    })
    for (const peak of placeSummits(rows, direction, summits)) {
      const px = x.apply(peak.col)
      const py = y.apply(lift(rows[peak.row]![peak.col]!, peak.row))
      const anchor = px < 70 ? 'start' : px > width - 70 ? 'end' : 'middle'
      g.append(
        svgEl('line', {
          x1: px,
          x2: px,
          y1: py - 4,
          y2: py - 16,
          stroke: 'white',
          'stroke-width': 0.75,
        }),
      )
      g.append(
        svgEl(
          'text',
          {
            x: px,
            y: py - 21,
            'text-anchor': anchor,
            stroke: 'black',
            'stroke-width': 4,
            'paint-order': 'stroke',
          },
          `${peak.name} ${peak.ele.toLocaleString('en')} m`,
        ),
      )
    }
    chart.append(g)
  }

  container.replaceChildren(chart)
}

function loadImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image()
    img.onload = () => resolve(img)
    img.onerror = () => reject(new Error('Failed to rasterize the poster'))
    img.src = src
  })
}

export type ExportFormat = 'jpg' | 'png' | 'svg'

const RASTER_MIME: Record<'jpg' | 'png', string> = {
  jpg: 'image/jpeg',
  png: 'image/png',
}

function triggerDownload(url: string, filename: string) {
  Object.assign(document.createElement('a'), {
    href: url,
    download: filename,
  }).click()
}

// Poster = chart + title block on a black page, built as SVG then, for jpg/png, rasterized
async function download(
  container: HTMLDivElement | null,
  title: string,
  subtitle: string,
  format: ExportFormat,
) {
  const chart = container?.querySelector('svg')
  if (!chart) return
  const w = +chart.getAttribute('width')!
  const h = +chart.getAttribute('height')!
  const pad = 64
  const W = w + pad * 2
  const H = h + pad * 2 + 96

  const poster = svgEl('svg', { width: W, height: H, viewBox: `0 0 ${W} ${H}` })
  poster.append(svgEl('rect', { width: W, height: H, fill: 'black' }))
  const inner = chart.cloneNode(true) as SVGElement
  inner.setAttribute('x', String(pad))
  inner.setAttribute('y', String(pad))
  poster.append(inner)
  const caption = { x: W / 2, 'text-anchor': 'middle', 'font-family': FONT }
  poster.append(
    svgEl(
      'text',
      {
        ...caption,
        y: pad + h + 56,
        fill: 'white',
        'font-size': 24,
        'letter-spacing': '0.35em',
      },
      title.toUpperCase(),
    ),
  )
  poster.append(
    svgEl(
      'text',
      {
        ...caption,
        y: pad + h + 84,
        fill: '#8a8a8a',
        'font-size': 11,
        'letter-spacing': '0.2em',
      },
      subtitle,
    ),
  )

  const slug =
    title
      .toLowerCase()
      .normalize('NFKD')
      .replace(/[^\w]+/g, '-')
      .replace(/^-|-$/g, '') || 'ridgelines'
  const svgMarkup = new XMLSerializer().serializeToString(poster)

  if (format === 'svg') {
    const svgUrl = URL.createObjectURL(
      new Blob([svgMarkup], { type: 'image/svg+xml' }),
    )
    triggerDownload(svgUrl, `${slug}.svg`)
    setTimeout(() => URL.revokeObjectURL(svgUrl), 1000)
    return
  }

  const svgUrl = URL.createObjectURL(
    new Blob([svgMarkup], { type: 'image/svg+xml' }),
  )
  try {
    const image = await loadImage(svgUrl)
    const canvas = document.createElement('canvas')
    canvas.width = W * EXPORT_SCALE
    canvas.height = H * EXPORT_SCALE
    const ctx = canvas.getContext('2d')
    if (!ctx) return
    // JPEG has no alpha channel; fill black first in case rounding leaves a sliver outside the SVG's own background
    ctx.fillStyle = 'black'
    ctx.fillRect(0, 0, canvas.width, canvas.height)
    ctx.drawImage(image, 0, 0, canvas.width, canvas.height)

    const rasterBlob = await new Promise<Blob | null>((resolve) =>
      canvas.toBlob(
        resolve,
        RASTER_MIME[format],
        format === 'jpg' ? JPEG_QUALITY : undefined,
      ),
    )
    if (!rasterBlob) return
    const rasterUrl = URL.createObjectURL(rasterBlob)
    triggerDownload(rasterUrl, `${slug}.${format}`)
    setTimeout(() => URL.revokeObjectURL(rasterUrl), 1000)
  } catch (e) {
    console.error('Poster export failed:', e)
  } finally {
    URL.revokeObjectURL(svgUrl)
  }
}

export interface RidgelineChartHandle {
  download: (title: string, subtitle: string, format: ExportFormat) => void
}

export const RidgelineChart = forwardRef<
  RidgelineChartHandle,
  {
    data: RidgelinesResponse // response of GET /api/ridgelines
    summits?: Summit[] // response of GET /api/summits (positions as frame fractions)
    relief?: number // peak height, in multiples of a 64-line spacing
    labels?: boolean
    width?: number
    plotHeight?: number
  }
>(function RidgelineChart(
  {
    data,
    summits = [],
    relief = 7,
    labels = false,
    width = 800,
    plotHeight = 640,
  },
  ref,
) {
  const containerRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (containerRef.current)
      draw(
        containerRef.current,
        data,
        summits,
        relief,
        labels,
        width,
        plotHeight,
      )
  }, [data, summits, relief, labels, width, plotHeight])

  useImperativeHandle(
    ref,
    () => ({
      download: (title, subtitle, format) =>
        void download(containerRef.current, title, subtitle, format),
    }),
    [],
  )

  return <div ref={containerRef} className='ridgeline-chart' />
})
