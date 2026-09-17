import { useEffect, useRef, type CSSProperties } from 'react'
import mapboxgl from 'mapbox-gl'
import type { Bbox, Peak, Preset } from '@/types'
import { peakFromFeature, peaksGeoJSON } from '@/data/mountains'

// Mapbox Standard, switched to its night preset: an "outdoors"-style dark basemap with
// built-in atmosphere/globe handling. Terrain is added once the style has loaded (below).
const STYLE_URL = 'mapbox://styles/rupert-brandst/cmu5exe5l003q01s7019f3no3'
const TERRAIN_SOURCE = 'mapbox-dem'
const FOOTPRINT_SOURCE = 'rendered-footprint'
const FOOTPRINT_LAYER = 'rendered-footprint'
const PEAKS_SOURCE = 'predefined-peaks'
const PEAKS_ICON = 'predefined-peak-marker'
const PEAKS_ICON_LAYER = 'predefined-peaks-icon'
const PEAKS_LABEL_LAYER = 'predefined-peaks-label'

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

mapboxgl.accessToken = import.meta.env.VITE_MAPBOX_TOKEN ?? ''
if (!mapboxgl.accessToken) {
  console.error(
    'Missing VITE_MAPBOX_TOKEN — the map will not load. Put a Mapbox access token in app/frontend/.env.local (see .env.local.example).',
  )
}

export function MapFrame({
  target = null,
  aspect = 5 / 4,
  onBboxChange,
  onPeakSelect,
  renderedFrame = null,
}: {
  // The map flies there whenever this changes
  target?: Preset | null
  // Width / height of the selection frame; matches the poster's plot area
  aspect?: number
  onBboxChange: (bbox: Bbox) => void
  // Fired when a predefined-mountain marker on the globe is clicked
  onPeakSelect?: (country: string, peak: Peak) => void
  // The bbox the ridgelines were last rendered from, outlined as real geometry on the globe's
  // surface (draped over terrain) — unlike the flat CSS `.frame` div, this square follows the
  // sphere's curvature. Null clears it.
  renderedFrame?: Bbox | null
}) {
  const containerRef = useRef<HTMLDivElement>(null)
  const frameRef = useRef<HTMLDivElement>(null)
  const mapRef = useRef<mapboxgl.Map | undefined>(undefined)
  // Always the latest callback, so the mount-only effect below never closes over a stale one
  const onBboxChangeRef = useRef(onBboxChange)
  useEffect(() => {
    onBboxChangeRef.current = onBboxChange
  }, [onBboxChange])
  const onPeakSelectRef = useRef(onPeakSelect)
  useEffect(() => {
    onPeakSelectRef.current = onPeakSelect
  }, [onPeakSelect])

  useEffect(() => {
    const container = containerRef.current
    const frame = frameRef.current
    if (!container || !frame) return

    // Whatever sits inside the fixed frame is the area to render
    function emitBbox() {
      const map = mapRef.current
      if (!map || !container || !frame) return
      const mapRect = container.getBoundingClientRect()
      const f = frame.getBoundingClientRect()
      if (f.width < 40 || f.height < 40) return // not laid out yet

      const nw = map.unproject([f.left - mapRect.left, f.top - mapRect.top])
      const se = map.unproject([f.right - mapRect.left, f.bottom - mapRect.top])
      const bbox: Bbox = [nw.lng, se.lat, se.lng, nw.lat]
      // Near the globe's silhouette a screen point has no corresponding ground position
      if (
        bbox.some((v) => !Number.isFinite(v)) ||
        bbox[0] >= bbox[2] ||
        bbox[1] >= bbox[3]
      )
        return
      onBboxChangeRef.current(bbox)
    }

    const map = new mapboxgl.Map({
      container,
      style: STYLE_URL,
      projection: 'globe',
      center: [13.3, 46],
      zoom: 2.3,
      // Locked to a top-down view: the frame → bbox math (above) assumes the screen frame
      // is a true rectangle on the ground, which only holds looking straight down.
      pitch: 0,
      maxPitch: 0,
    })
    mapRef.current = map
    // top-left is reserved for the mountain-range nav card floating over the map (see App.tsx)
    map.addControl(new mapboxgl.NavigationControl(), 'top-right')

    map.on('load', () => {
      // Standard style already provisions a "mapbox-dem" source internally once terrain is
      // requested, and React StrictMode's dev-only mount→cleanup→mount can also have this
      // handler fire twice — guard every add* call so a repeat run is a no-op instead of an
      // uncaught "already exists".
      if (!map.getSource(TERRAIN_SOURCE)) {
        // Real 3D displacement of the globe's surface at mountains — most visible near the
        // sphere's silhouette and while rotating, since the camera itself never tilts
        map.addSource(TERRAIN_SOURCE, {
          type: 'raster-dem',
          url: 'mapbox://mapbox.mapbox-terrain-dem-v1',
          tileSize: 512,
          maxzoom: 14,
        })
      }
      map.setTerrain({ source: TERRAIN_SOURCE, exaggeration: 1.4 })
      // Standard style's dark preset — the "outdoors" hillshade/contour look, at night.
      // NB: the guard above used to be missing, so this line was never actually reached
      // (an uncaught error on the addSource call above aborted the rest of this handler
      // on every load) — the map has always rendered in Standard's default light preset in
      // practice. Left disabled to keep that familiar look; flip it on to get the look the
      // surrounding comments/CONCEPT.md describe.
      // map.setConfigProperty('basemap', 'lightPreset', 'night')

      // One marker per predefined mountain (the country picker's top-10 lists), so the
      // ranges are visible — and clickable — before anyone opens the search bar.
      if (map.getLayer(PEAKS_ICON_LAYER)) return
      map.addSource(PEAKS_SOURCE, { type: 'geojson', data: peaksGeoJSON() })
      map.addLayer({
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

      // The badge icon is rasterized async (an <img> load, even for a data: URI) — the
      // symbol layer that references it is created once that's actually ready.
      const icon = new Image(64, 64)
      icon.onload = () => {
        if (!map.hasImage(PEAKS_ICON)) map.addImage(PEAKS_ICON, icon, { pixelRatio: 2 })
        if (map.getLayer(PEAKS_ICON_LAYER)) return
        map.addLayer(
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
        map.on('mouseenter', PEAKS_ICON_LAYER, () => {
          map.getCanvas().style.cursor = 'pointer'
        })
        map.on('mouseleave', PEAKS_ICON_LAYER, () => {
          map.getCanvas().style.cursor = ''
        })
        map.on('click', PEAKS_ICON_LAYER, (e) => {
          const feature = e.features?.[0]
          const selection = feature && peakFromFeature(feature)
          if (selection) onPeakSelectRef.current?.(selection.country, selection.peak)
        })
      }
      icon.src = `data:image/svg+xml;charset=utf-8,${encodeURIComponent(PEAKS_ICON_SVG)}`
    })

    map.on('moveend', emitBbox)
    // Mapbox and the CSS-sized frame can settle after mount; re-measure whenever either changes size
    const observer = new ResizeObserver(() => {
      map.resize()
      emitBbox()
    })
    observer.observe(container)
    observer.observe(frame)
    emitBbox()

    return () => {
      observer.disconnect()
      map.remove()
      mapRef.current = undefined
    }
  }, [])

  useEffect(() => {
    if (target)
      mapRef.current?.flyTo({
        center: [target.lon, target.lat],
        zoom: target.zoom,
        duration: 800,
      })
  }, [target])

  return (
    <div className='map-wrap'>
      {/* Sized by the `.map-wrap .mapboxgl-map` rule in globals.css, not a Tailwind class here —
          see the comment there for why (mapbox-gl.css's own unlayered CSS must be out-specificity'd). */}
      <div ref={containerRef} />
      <div className='frame-layer'>
        <div
          ref={frameRef}
          className='frame'
          style={{ '--aspect': aspect } as CSSProperties}
        />
      </div>
    </div>
  )
}
