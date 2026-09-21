<script setup lang="ts">
// The landing page's hero art — real terrain, not a placeholder. HERO_RIDGELINE is a frame
// over the Großglockner group baked once from the app's own pipeline (server/utils/dem.ts,
// see data/heroRidgeline.ts for how to regenerate it) rather than fetched live on every
// landing-page request: SSR-safe, no tile fetch or Mapbox dependency just to render a hero.
// The drawing itself mirrors RidgelineChart.vue's draw() — light smoothing, then nearest-row-
// first with a running skyline so a farther line only survives where it's genuinely visible —
// just rewritten as a pure computed (no DOM) so it can render on the server too.
import { HERO_RIDGELINE } from '~/data/heroRidgeline'

const props = withDefaults(
  defineProps<{
    width?: number
    height?: number
    relief?: number
    stroke?: string
  }>(),
  { width: 1200, height: 760, relief: 9, stroke: 'white' },
)

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

const paths = computed(() => {
  const { min, max, rows: rawRows } = HERO_RIDGELINE
  const rows = smoothRows(rawRows, 1)
  const n = rows.length
  const m = rows[0]!.length
  const w = props.width
  const h = props.height
  const marginTop = h * 0.02
  const marginBottom = h * 0.02
  const peakPx = props.relief * (h / 64)
  const rowHeight = (h - marginTop - marginBottom - peakPx) / (n - 1)
  const reliefRows = peakPx / rowHeight
  const span = max - min || 1

  const lift = (elev: number, row: number) => ((elev - min) / span) * reliefRows - row
  const yMin = -(n - 1)
  const yMax = reliefRows
  const x = (i: number) => (i / (m - 1)) * w
  const y = (v: number) => h - marginBottom - ((v - yMin) / (yMax - yMin)) * (h - marginTop - marginBottom)

  const strokeWidth = Math.min(1.4, rowHeight * 0.3)
  const lip = strokeWidth / 2
  const skyline = new Array<number>(m).fill(Infinity)
  const out: string[] = []

  for (let row = n - 1; row >= 0; row--) {
    const line = rows[row]!
    let segment: [number, number][] = []
    const flush = () => {
      if (segment.length > 1) {
        out.push(segment.map(([px, py], i) => `${i === 0 ? 'M' : 'L'}${px.toFixed(1)},${py.toFixed(1)}`).join(' '))
      }
      segment = []
    }
    for (let i = 0; i < m; i++) {
      const px = x(i)
      const py = y(lift(line[i]!, row))
      if (py < skyline[i]! - lip) segment.push([px, py])
      else flush()
      if (py < skyline[i]!) skyline[i] = py
    }
    flush()
  }

  return { d: out, strokeWidth }
})
</script>

<template>
  <svg :viewBox="`0 0 ${width} ${height}`" preserveAspectRatio="xMidYMax slice" class="block h-full w-full" aria-hidden="true">
    <path
      v-for="(d, i) in paths.d"
      :key="i"
      :d="d"
      fill="none"
      :stroke="stroke"
      :stroke-width="paths.strokeWidth"
      stroke-linejoin="round"
      stroke-linecap="round"
    />
  </svg>
</template>
