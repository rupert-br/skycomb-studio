<script lang="ts">
// Module-level (not per-instance) helpers — port of app/frontend/src/components/RidgelineChart.tsx.
// @observablehq/plot only touches the DOM inside Plot.plot()/draw(), never at import time, so a
// plain static import is SSR-safe (unlike mapbox-gl in MapFrame.vue).
import * as Plot from '@observablehq/plot'
import { DEFAULT_POSTER_COLOR_SCHEME_ID, posterColorScheme, type PosterColorScheme } from '~/lib/posterColors'
import type {
  Direction,
  PlacedSummit,
  RidgelinesResponse,
  Summit,
} from '~/types/ridgeline'

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

// Blends each row with its immediate neighbors before rendering. At a jagged summit, two
// physically-adjacent viewing bands can each pick up a different nearby pinnacle as their
// own column max, so which of the two reads "taller" flips every few columns — real sampling
// jitter, not real relief — and the occlusion (correctly) renders every one of those flips as
// a crossing. A light blur removes the jitter so only genuine relief differences survive.
function smoothRows(rows: number[][], radius: number): number[][] {
  const n = rows.length
  if (radius <= 0 || n < 3) return rows
  const m = rows[0]!.length
  const out: number[][] = []
  for (let r = 0; r < n; r++) {
    const lo = Math.max(0, r - radius)
    const hi = Math.min(n - 1, r + radius)
    const row = new Array<number>(m)
    for (let c = 0; c < m; c++) {
      let sum = 0
      for (let k = lo; k <= hi; k++) sum += rows[k]![c]!
      row[c] = sum / (hi - lo + 1)
    }
    out.push(row)
  }
  return out
}

// The title tracks the top visible summit's name (or whatever the user typed over it, see
// usePosterTitle) and can run much longer than a mountain's own name once OSM's name carries
// a slash-joined pair — a fixed font size would then overflow the poster width and get clipped
// at both edges (the root SVG's default overflow: hidden). Shrinks the font just enough to
// keep the caption inside the poster instead of hard-wrapping or truncating the text itself.
function fittedFontSize(text: string, maxWidth: number, baseSize: number, minSize: number, trackingEm: number): number {
  const ctx = document.createElement('canvas').getContext('2d')
  if (!ctx || !text) return baseSize
  const width = (size: number) => {
    ctx.font = `${size}px ${FONT}`
    return ctx.measureText(text).width + trackingEm * size * text.length
  }
  let size = baseSize
  while (size > minSize && width(size) > maxWidth) size -= 1
  return size
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
  colorScheme: PosterColorScheme,
) {
  const { min, max, direction } = data
  const rows = smoothRows(data.rows, 1)
  const n = rows.length
  const m = rows[0]!.length
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
  const strokeWidth = Math.min(1.1, rowHeight * 0.17)

  // Plot supplies the scales and the sized <svg>; the ridges themselves are drawn by hand
  // below, since occlusion means dropping points outright rather than painting a mark.
  const chart = Plot.plot({
    width,
    height: plotHeight,
    margin: 0,
    marginTop,
    marginBottom,
    style: { background: 'none' },
    x: { axis: null, domain: [0, m - 1] },
    y: { axis: null, domain: [-(n - 1), reliefRows] },
    marks: [],
  }) as unknown as SVGSVGElement & {
    scale: (name: string) => { apply: (v: number) => number }
  }

  // One line per row, processed nearest → farthest, against a running skyline: the topmost
  // point reached by every row placed so far (i.e. everything nearer). A point survives only
  // where it rises above that skyline — anything at or below it is dropped outright, not
  // painted over or clipped, so a farther line ends up as just the segments that are
  // genuinely visible in front of nothing nearer.
  const x = chart.scale('x')
  const y = chart.scale('y')
  const group = svgEl('g')
  const skyline = new Array<number>(m).fill(Infinity)
  for (let row = n - 1; row >= 0; row--) {
    const line = rows[row]!
    const pts: [number, number][] = line.map((d, i) => [
      x.apply(i),
      y.apply(lift(d, row)),
    ])
    // Half a stroke of slack: the row drawn here already covers that much on its own, so
    // without it two rows of near-equal height leave a hairline sliver of the farther one
    // visible right along the crest.
    const lip = strokeWidth / 2
    let segment: [number, number][] = []
    const flushSegment = () => {
      if (segment.length > 1) {
        const d = segment
          .map(([px, py], i) => `${i === 0 ? 'M' : 'L'}${px},${py}`)
          .join(' ')
        group.append(
          svgEl('path', {
            d,
            fill: 'none',
            stroke: colorScheme.line,
            'stroke-width': strokeWidth,
            'stroke-linejoin': 'round',
          }),
        )
      }
      segment = []
    }
    for (let i = 0; i < m; i++) {
      const [px, py] = pts[i]!
      if (py < skyline[i]! - lip) segment.push([px, py])
      else flushSegment()
      if (py < skyline[i]!) skyline[i] = py
    }
    flushSegment()
  }
  chart.append(group)

  if (labels && summits.length) {
    // Labels go on top of every ridge so nearer ones can't hide them
    const g = svgEl('g', {
      'font-size': 10,
      'letter-spacing': '0.08em',
      fill: colorScheme.line,
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
          stroke: colorScheme.line,
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
            stroke: colorScheme.outline,
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

// Builds the poster SVG (chart + title block) from the currently-drawn chart. Shared by
// download() (which rasterizes it at export resolution, or hands back the SVG as-is) and
// getPosterImage() (a lower-res PNG snapshot for the buy-flow mockups).
function buildPosterSvg(
  container: HTMLDivElement | null,
  title: string,
  subtitle: string,
  colorScheme: PosterColorScheme,
  showText: boolean,
  transparentBackground: boolean,
): { svgMarkup: string; W: number; H: number } | null {
  const chart = container?.querySelector('svg')
  if (!chart) return null
  const w = +chart.getAttribute('width')!
  const h = +chart.getAttribute('height')!
  const pad = 64
  const captionHeight = showText ? 96 : 0
  const W = w + pad * 2
  const H = h + pad * 2 + captionHeight

  const poster = svgEl('svg', { width: W, height: H, viewBox: `0 0 ${W} ${H}` })
  if (!transparentBackground) {
    poster.append(svgEl('rect', { x: 0, y: 0, width: W, height: H, fill: colorScheme.background }))
  }
  const inner = chart.cloneNode(true) as SVGElement
  inner.setAttribute('x', String(pad))
  inner.setAttribute('y', String(pad))
  poster.append(inner)

  if (showText) {
    const caption = { x: W / 2, 'text-anchor': 'middle', 'font-family': FONT }
    const maxTextWidth = W - 48
    const titleUpper = title.toUpperCase()
    const titleSize = fittedFontSize(titleUpper, maxTextWidth, 24, 11, 0.35)
    const subtitleSize = fittedFontSize(subtitle, maxTextWidth, 11, 8, 0.2)
    poster.append(
      svgEl(
        'text',
        {
          ...caption,
          y: pad + h + 56,
          fill: colorScheme.line,
          'font-size': titleSize,
          'letter-spacing': '0.35em',
        },
        titleUpper,
      ),
    )
    poster.append(
      svgEl(
        'text',
        {
          ...caption,
          y: pad + h + 84,
          fill: colorScheme.subtitleText,
          'font-size': subtitleSize,
          'letter-spacing': '0.2em',
        },
        subtitle,
      ),
    )
  }

  return { svgMarkup: new XMLSerializer().serializeToString(poster), W, H }
}

// Rasterizes a poster SVG onto a canvas at the given scale. The SVG itself now carries an
// opaque background rect (see buildPosterSvg) in the chosen color scheme, so the canvas needs
// no fill of its own — that's also what keeps a JPEG export (no alpha channel) from ever
// showing through to whatever's behind the page.
async function rasterizePoster(svgMarkup: string, W: number, H: number, scale: number): Promise<HTMLCanvasElement | null> {
  const svgUrl = URL.createObjectURL(new Blob([svgMarkup], { type: 'image/svg+xml' }))
  try {
    const image = await loadImage(svgUrl)
    const canvas = document.createElement('canvas')
    canvas.width = W * scale
    canvas.height = H * scale
    const ctx = canvas.getContext('2d')
    if (!ctx) return null
    ctx.drawImage(image, 0, 0, canvas.width, canvas.height)
    return canvas
  } finally {
    URL.revokeObjectURL(svgUrl)
  }
}

// A PNG snapshot of the current poster (chart + title block) for the buy-flow product
// mockups — same imagery as a download, just rasterized small and returned as a data URL
// instead of saved to disk.
async function getPosterImage(
  container: HTMLDivElement | null,
  title: string,
  subtitle: string,
  colorScheme: PosterColorScheme,
  showText: boolean,
  transparentBackground: boolean,
): Promise<string | null> {
  const built = buildPosterSvg(container, title, subtitle, colorScheme, showText, transparentBackground)
  if (!built) return null
  const canvas = await rasterizePoster(built.svgMarkup, built.W, built.H, 2)
  return canvas?.toDataURL('image/png') ?? null
}

// Poster = chart + title block, built as SVG then, for jpg/png, rasterized. JPEG has no alpha
// channel, so a transparent background is only honored for svg/png — jpg always falls back to
// a solid fill in the chosen color scheme rather than silently turning "transparent" black.
async function download(
  container: HTMLDivElement | null,
  title: string,
  subtitle: string,
  format: ExportFormat,
  colorScheme: PosterColorScheme,
  showText: boolean,
  transparentBackground: boolean,
) {
  const built = buildPosterSvg(
    container,
    title,
    subtitle,
    colorScheme,
    showText,
    transparentBackground && format !== 'jpg',
  )
  if (!built) return
  const { svgMarkup, W, H } = built

  const slug =
    title
      .toLowerCase()
      .normalize('NFKD')
      .replace(/[^\w]+/g, '-')
      .replace(/^-|-$/g, '') || 'ridgelines'

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
</script>

<script setup lang="ts">
const props = withDefaults(
  defineProps<{
    data: RidgelinesResponse // response of GET /api/ridgelines
    summits?: Summit[] // response of GET /api/summits (positions as frame fractions)
    relief?: number // peak height, in multiples of a 64-line spacing
    labels?: boolean
    width?: number
    plotHeight?: number
    colorScheme?: PosterColorScheme
    showText?: boolean // whether title/subtitle are baked into the downloaded poster
    transparentBackground?: boolean // omit the background fill (svg/png only — see download())
  }>(),
  {
    summits: () => [],
    relief: 7,
    labels: false,
    width: 800,
    plotHeight: 640,
    colorScheme: () => posterColorScheme(DEFAULT_POSTER_COLOR_SCHEME_ID),
    showText: true,
    transparentBackground: false,
  },
)

const containerEl = useTemplateRef<HTMLDivElement>('containerEl')

watchEffect(() => {
  if (containerEl.value) {
    draw(
      containerEl.value,
      props.data,
      props.summits,
      props.relief,
      props.labels,
      props.width,
      props.plotHeight,
      props.colorScheme,
    )
  }
})

defineExpose({
  download: (title: string, subtitle: string, format: ExportFormat) =>
    void download(containerEl.value, title, subtitle, format, props.colorScheme, props.showText, props.transparentBackground),
  getPosterImage: (title: string, subtitle: string) =>
    getPosterImage(containerEl.value, title, subtitle, props.colorScheme, props.showText, props.transparentBackground),
})
</script>

<template>
  <div ref="containerEl" class="ridgeline-chart" />
</template>
