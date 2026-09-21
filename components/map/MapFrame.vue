<script setup lang="ts">
// Port of app/frontend/src/components/MapFrame.tsx. mapbox-gl is dynamically imported inside
// onMounted (never as a static top-level import) because it touches `window` at module-eval
// time — a well-known SSR footgun. /studio is routed with ssr:false (nuxt.config.ts), so this
// only ever runs in the browser anyway; the dynamic import keeps that true even if that
// changes later.
import { Eye, EyeOff } from '@lucide/vue'
import type { default as mapboxglType, ImageSource, LngLat, Map as MapboxMap, MapMouseEvent } from 'mapbox-gl'
import { peakFromFeature, peaksGeoJSON } from '~/data/mountains'
import { DEFAULT_POSTER_COLOR_SCHEME_ID, posterColorScheme, type PosterColorScheme } from '~/lib/posterColors'
import type { Bbox, Direction, Peak, Preset, RidgelinesResponse, Summit } from '~/types/ridgeline'

// Mapbox Standard, switched to its night preset: an "outdoors"-style dark basemap with
// built-in atmosphere/globe handling. Terrain is added once the style has loaded (below).
const STYLE_URL = 'mapbox://styles/rupert-brandst/cmu5exe5l003q01s7019f3no3'
const TERRAIN_SOURCE = 'mapbox-dem'
const PEAKS_SOURCE = 'predefined-peaks'
const PEAKS_ICON = 'predefined-peak-marker'
const PEAKS_ICON_LAYER = 'predefined-peaks-icon'
const PEAKS_LABEL_LAYER = 'predefined-peaks-label'

// "Preview on map" (3D drape mode, see toggleOverlay below) — the rendered poster is
// geo-referenced onto the frame's own bbox and handed to Mapbox as a raster image; Mapbox
// drapes raster/fill/line layers over terrain automatically once setTerrain() is active, so
// this rides the real elevation mesh for free instead of needing a custom WebGL layer.
const DRAPE_SOURCE = 'ridgeline-drape'
const DRAPE_LAYER = 'ridgeline-drape-layer'
const DRAPE_PITCH = 60
// Camera bearing that puts each direction's "far" edge away from the viewer, matching how
// RidgelineChart/placeSummits already orient rows/labels for that direction.
const DIRECTION_BEARING: Record<Direction, number> = { north: 0, east: 90, south: 180, west: 270 }
// image source `coordinates` must be [top-left, top-right, bottom-right, bottom-left]; which
// bbox corner lands in each slot depends on direction (RidgelineChart's ORIENT table encodes
// the same mapping for summit placement) — a rotation of the NW→NE→SE→SW ring by this index.
const DIRECTION_ORDER: Direction[] = ['north', 'east', 'south', 'west']

function drapeImageCoordinates(bbox: Bbox, direction: Direction): [[number, number], [number, number], [number, number], [number, number]] {
  const [west, south, east, north] = bbox
  const ring: [number, number][] = [[west, north], [east, north], [east, south], [west, south]] // NW, NE, SE, SW
  const k = DIRECTION_ORDER.indexOf(direction)
  const rotated = [...ring.slice(k), ...ring.slice(0, k)]
  return rotated as [[number, number], [number, number], [number, number], [number, number]]
}

// Serializes the given (already-drawn) chart SVG to a rasterized PNG data URL — Mapbox's
// ImageSource needs a bitmap, not live SVG markup.
async function svgToPngDataUrl(svg: SVGSVGElement, scale = 2): Promise<string> {
  const w = +svg.getAttribute('width')!
  const h = +svg.getAttribute('height')!
  const markup = new XMLSerializer().serializeToString(svg)
  const svgUrl = URL.createObjectURL(new Blob([markup], { type: 'image/svg+xml' }))
  try {
    const image = await new Promise<HTMLImageElement>((resolve, reject) => {
      const img = new Image()
      img.onload = () => resolve(img)
      img.onerror = () => reject(new Error('Failed to rasterize the drape image'))
      img.src = svgUrl
    })
    const canvas = document.createElement('canvas')
    canvas.width = w * scale
    canvas.height = h * scale
    const ctx = canvas.getContext('2d')
    if (!ctx) throw new Error('2D canvas context unavailable')
    ctx.drawImage(image, 0, 0, canvas.width, canvas.height)
    return canvas.toDataURL('image/png')
  } finally {
    URL.revokeObjectURL(svgUrl)
  }
}

const VIEW_STORAGE_KEY = 'mountains-austria:map-view'

function loadStoredView(): { center: [number, number]; zoom: number } | null {
  try {
    const raw = localStorage.getItem(VIEW_STORAGE_KEY)
    if (!raw) return null
    const parsed = JSON.parse(raw)
    const [lng, lat] = parsed.center
    if (![lng, lat, parsed.zoom].every(Number.isFinite)) return null
    return { center: [lng, lat], zoom: parsed.zoom }
  } catch {
    return null
  }
}

function storeView(center: { lng: number; lat: number }, zoom: number) {
  try {
    localStorage.setItem(VIEW_STORAGE_KEY, JSON.stringify({ center: [center.lng, center.lat], zoom }))
  } catch {
    // Storage can be unavailable (private mode, quota) — losing the saved view isn't fatal.
  }
}

// A small badge — brand-blue disc, white ring, two-peak glyph, soft drop shadow — rasterized
// once into the style's sprite via map.addImage below. Drawn at 2x (a 32px badge, @2 pixelRatio)
// so it stays crisp on retina displays.
const PEAKS_ICON_SVG = `
<svg xmlns="http://www.w3.org/2000/svg" width="64" height="64" viewBox="0 0 64 64">
  <defs>
    <filter id="shadow" x="-60%" y="-60%" width="220%" height="220%">
      <feDropShadow dx="0" dy="1.5" stdDeviation="2.25" flood-color="#0b1021" flood-opacity="0.45" />
    </filter>
  </defs>
  <circle cx="32" cy="30" r="19" fill="#1a73e8" stroke="#ffffff" stroke-width="3" filter="url(#shadow)" />
  <path d="M20 37 L27.5 23.5 L33 31.5 L37.5 24.5 L44 37 Z" fill="#ffffff" />
</svg>
`.trim()

const props = withDefaults(
  defineProps<{
    // The map flies there whenever this changes
    target?: Preset | null
    // Width / height of the selection frame; matches the poster's plot area
    aspect?: number
    // The last rendered ridgelines, if any — drawn as a toggleable overlay directly inside
    // the frame (see the "preview" chip below the frame) instead of only in the side panel.
    result?: RidgelinesResponse | null
    summits?: Summit[]
    relief?: number
    labels?: boolean
    colorScheme?: PosterColorScheme
  }>(),
  {
    target: null,
    aspect: 5 / 4,
    result: null,
    summits: () => [],
    relief: 7,
    labels: false,
    colorScheme: () => posterColorScheme(DEFAULT_POSTER_COLOR_SCHEME_ID),
  },
)

const emit = defineEmits<{
  'bbox-change': [bbox: Bbox]
  'peak-select': [country: string, peak: Peak]
}>()

const containerEl = useTemplateRef<HTMLDivElement>('containerEl')
const frameEl = useTemplateRef<HTMLDivElement>('frameEl')
// Off-screen host for a RidgelineChart instance that exists only to hand its drawn <svg> to
// svgToPngDataUrl — never shown itself (see the `.drape-source` rule in main.css).
const drapeChartEl = useTemplateRef<HTMLDivElement>('drapeChartEl')
const map = shallowRef<MapboxMap | undefined>(undefined)
let mapboxgl: typeof mapboxglType | undefined
let resizeObserver: ResizeObserver | undefined

// "Preview on map" — tilts the camera and drapes the last render over the real 3D terrain
// inside the frame's own bbox (see toggleOverlay). Off by default: it's a dramatic detour from
// framing, not something you'd want mid-drag.
const overlayOn = ref(false)
const overlayBusy = ref(false)
const frameSize = ref({ width: 0, height: 0 })
let savedView: { center: LngLat; zoom: number; bearing: number; pitch: number } | null = null

onMounted(async () => {
  const container = containerEl.value
  const frame = frameEl.value
  if (!container || !frame) return

  mapboxgl = (await import('mapbox-gl')).default

  const config = useRuntimeConfig()
  mapboxgl.accessToken = config.public.mapboxToken || ''
  if (!mapboxgl.accessToken) {
    console.error(
      'Missing NUXT_PUBLIC_MAPBOX_TOKEN — the map will not load. Put a Mapbox access token in .env (see .env.example).',
    )
  }

  // Whatever sits inside the fixed frame is the area to render. Skipped while pitched (the
  // camera tilted by "Preview on map", or the user free-tilting once maxPitch allows it): the
  // screen frame only maps to a true ground rectangle when looking straight down.
  function emitBbox() {
    const m = map.value
    if (!m || !container || !frame || m.getPitch() > 0.5) return
    const mapRect = container.getBoundingClientRect()
    const f = frame.getBoundingClientRect()
    if (f.width < 40 || f.height < 40) return // not laid out yet
    frameSize.value = { width: Math.round(f.width), height: Math.round(f.height) }

    const nw = m.unproject([f.left - mapRect.left, f.top - mapRect.top])
    const se = m.unproject([f.right - mapRect.left, f.bottom - mapRect.top])
    const bbox: Bbox = [nw.lng, se.lat, se.lng, nw.lat]
    // Near the globe's silhouette a screen point has no corresponding ground position
    if (bbox.some((v) => !Number.isFinite(v)) || bbox[0] >= bbox[2] || bbox[1] >= bbox[3]) return
    emit('bbox-change', bbox)
  }

  const storedView = loadStoredView()

  const m = new mapboxgl.Map({
    container,
    style: STYLE_URL,
    projection: 'globe',
    center: storedView?.center ?? [13.3, 46],
    zoom: storedView?.zoom ?? 2.3,
    // Starts top-down (framing needs the screen frame to map to a true ground rectangle,
    // see emitBbox), but pitch isn't locked to 0 any more — "Preview on map" tilts the camera
    // itself, and maxPitch stays high enough to let that read as real 3D relief.
    pitch: 0,
    maxPitch: 75,
  })
  map.value = m
  // top-left is reserved for the mountain-range nav card floating over the map (see studio/index.vue)
  m.addControl(new mapboxgl.NavigationControl(), 'top-right')

  m.on('load', () => {
    if (!m.getSource(TERRAIN_SOURCE)) {
      // Real 3D displacement of the globe's surface at mountains — most visible near the
      // sphere's silhouette and while rotating, since the camera itself never tilts
      m.addSource(TERRAIN_SOURCE, {
        type: 'raster-dem',
        url: 'mapbox://mapbox.mapbox-terrain-dem-v1',
        tileSize: 512,
        maxzoom: 14,
      })
    }
    m.setTerrain({ source: TERRAIN_SOURCE, exaggeration: 1.4 })

    // One marker per predefined mountain (the country picker's top-10 lists), so the
    // ranges are visible — and clickable — before anyone opens the search bar.
    if (m.getLayer(PEAKS_ICON_LAYER)) return
    m.addSource(PEAKS_SOURCE, { type: 'geojson', data: peaksGeoJSON() })
    m.addLayer({
      id: PEAKS_LABEL_LAYER,
      type: 'symbol',
      source: PEAKS_SOURCE,
      minzoom: 5,
      layout: {
        // Name at full size, elevation on its own line beneath in a smaller, softer weight
        'text-field': [
          'format',
          ['get', 'name'],
          {},
          '\n',
          {},
          ['concat', ['to-string', ['get', 'elevation']], ' m'],
          { 'font-scale': 0.82 },
        ],
        'text-size': 12,
        'text-offset': [0, 1.5],
        'text-anchor': 'top',
        'text-line-height': 1.25,
        'text-optional': true,
      },
      paint: {
        'text-color': '#ffffff',
        'text-halo-color': 'rgba(11, 16, 33, 0.75)',
        'text-halo-width': 1.3,
      },
    })

    // The badge icon is rasterized async (an <img> load, even for a data: URI) — the symbol
    // layer that references it is created once that's actually ready.
    const icon = new Image(64, 64)
    icon.onload = () => {
      if (!m.hasImage(PEAKS_ICON)) m.addImage(PEAKS_ICON, icon, { pixelRatio: 2 })
      if (m.getLayer(PEAKS_ICON_LAYER)) return
      m.addLayer(
        {
          id: PEAKS_ICON_LAYER,
          type: 'symbol',
          source: PEAKS_SOURCE,
          layout: {
            'icon-image': PEAKS_ICON,
            'icon-size': ['interpolate', ['linear'], ['zoom'], 2, 0.42, 6, 0.65, 12, 1],
            'icon-allow-overlap': true,
            'icon-anchor': 'center',
          },
        },
        PEAKS_LABEL_LAYER,
      )
      m.on('mouseenter', PEAKS_ICON_LAYER, () => {
        m.getCanvas().style.cursor = 'pointer'
      })
      m.on('mouseleave', PEAKS_ICON_LAYER, () => {
        m.getCanvas().style.cursor = ''
      })
      m.on('click', PEAKS_ICON_LAYER, (e: MapMouseEvent) => {
        const feature = e.features?.[0]
        const selection = feature && peakFromFeature(feature)
        if (selection) emit('peak-select', selection.country, selection.peak)
      })
    }
    icon.src = `data:image/svg+xml;charset=utf-8,${encodeURIComponent(PEAKS_ICON_SVG)}`
  })

  m.on('moveend', emitBbox)
  m.on('moveend', () => storeView(m.getCenter(), m.getZoom()))
  // Mapbox and the CSS-sized frame can settle after mount; re-measure whenever either changes size
  const observer = new ResizeObserver(() => {
    m.resize()
    emitBbox()
  })
  observer.observe(container)
  observer.observe(frame)
  resizeObserver = observer
  emitBbox()
})

onUnmounted(() => {
  resizeObserver?.disconnect()
  map.value?.remove()
  map.value = undefined
})

watch(
  () => props.target,
  (target) => {
    if (target) map.value?.flyTo({ center: [target.lon, target.lat], zoom: target.zoom, duration: 800 })
  },
)

// Rasterizes drapeChartEl's current <svg> and (re)creates or updates the drape source/layer
// from it. Called once when the preview turns on, and again whenever what it's drawing changes
// while it's already on, so relief/labels/color tweaks stay live on the terrain.
async function refreshDrape() {
  const m = map.value
  const data = props.result
  if (!m || !data) return
  await nextTick()
  const svg = drapeChartEl.value?.querySelector('svg')
  if (!svg) return
  const dataUrl = await svgToPngDataUrl(svg)
  const coordinates = drapeImageCoordinates(data.bbox, data.direction)
  const existing = m.getSource(DRAPE_SOURCE) as ImageSource | undefined
  if (existing) {
    existing.updateImage({ url: dataUrl, coordinates })
    return
  }
  m.addSource(DRAPE_SOURCE, { type: 'image', url: dataUrl, coordinates })
  m.addLayer({ id: DRAPE_LAYER, type: 'raster', source: DRAPE_SOURCE, paint: { 'raster-fade-duration': 0 } })
}

function removeDrape() {
  const m = map.value
  if (!m) return
  if (m.getLayer(DRAPE_LAYER)) m.removeLayer(DRAPE_LAYER)
  if (m.getSource(DRAPE_SOURCE)) m.removeSource(DRAPE_SOURCE)
}

// Redraw the draped image in place whenever its styling changes while the preview is showing
// (result itself only changes via a fresh "Render", which re-fits the camera separately below).
watch([() => props.relief, () => props.labels, () => props.colorScheme], () => {
  if (overlayOn.value) refreshDrape()
})

watch(
  () => props.result,
  (result) => {
    if (overlayOn.value && result) refreshDrape()
  },
)

async function toggleOverlay() {
  const m = map.value
  if (!m || !mapboxgl || overlayBusy.value) return

  if (overlayOn.value) {
    overlayOn.value = false
    removeDrape()
    if (savedView) m.easeTo({ ...savedView, duration: 900 })
    return
  }

  if (!props.result) return
  overlayBusy.value = true
  try {
    savedView = { center: m.getCenter(), zoom: m.getZoom(), bearing: m.getBearing(), pitch: m.getPitch() }
    overlayOn.value = true
    await refreshDrape()
    const [west, south, east, north] = props.result.bbox
    m.fitBounds([west, south, east, north], {
      pitch: DRAPE_PITCH,
      bearing: DIRECTION_BEARING[props.result.direction],
      padding: 80,
      duration: 1200,
    })
  } finally {
    overlayBusy.value = false
  }
}
</script>

<template>
  <div class="map-wrap">
    <!-- Sized by the `.map-wrap .mapboxgl-map` rule in assets/css/main.css, not a Tailwind
         class here — see the comment there for why (mapbox-gl.css's own unlayered CSS must be
         out-specificity'd). -->
    <div ref="containerEl" />
    <div class="frame-layer" :class="{ 'frame-layer--hidden': overlayOn }">
      <div ref="frameEl" class="frame" :style="{ '--aspect': aspect }" />
    </div>

    <!-- Never shown — exists only so refreshDrape() has a live <svg> to rasterize for the
         terrain drape. Mounted only while needed; a plain, unstyled RidgelineChart at the
         frame's own pixel size keeps it pixel-matched to the drape image. -->
    <div v-if="overlayOn && result" ref="drapeChartEl" class="drape-source" aria-hidden="true">
      <RidgelineChart
        :data="result"
        :summits="summits"
        :relief="relief"
        :labels="labels"
        :width="frameSize.width"
        :plot-height="frameSize.height"
        :color-scheme="colorScheme"
        :show-text="false"
        :transparent-background="true"
      />
    </div>

    <button
      v-if="result"
      type="button"
      class="frame-overlay-toggle z-[600] flex items-center gap-1.5 rounded-full bg-card px-3 py-2 text-xs font-medium text-foreground shadow-elevation-1 outline-none transition-shadow hover:shadow-elevation-2 focus-visible:ring-2 focus-visible:ring-ring/50 disabled:opacity-60"
      :aria-pressed="overlayOn"
      :disabled="overlayBusy"
      @click="toggleOverlay"
    >
      <component :is="overlayOn ? EyeOff : Eye" :size="14" />
      {{ overlayOn ? 'Hide 3D preview' : 'Preview on terrain' }}
    </button>
  </div>
</template>
