// Shared between the Nitro server routes (server/api/*) and the Vue app — one source of truth.

export type Direction = 'north' | 'east' | 'south' | 'west'

/** [west, south, east, north] in degrees (WGS84). */
export type Bbox = [west: number, south: number, east: number, north: number]

export interface RidgelinesResponse {
  bbox: Bbox
  direction: Direction
  min: number
  max: number
  /** rows[0] is the far edge; each row runs left → right as the viewer sees it. */
  rows: number[][]
  meta: {
    zoom: number
    tiles: number
    metres_per_px: number
    elapsed_ms: number
  }
}

/** A named summit, positioned as fractions of the frame from its north and west edges. */
export interface Summit {
  name: string
  ele: number
  down: number
  across: number
}

export interface SummitsResponse {
  summits: Summit[]
  /** Present when the lookup failed; the list is then empty and the caller should retry later. */
  error?: string
}

/** A summit placed on a specific rendering: which drawn point it snapped to. */
export interface PlacedSummit extends Summit {
  row: number
  col: number
}

/** A quick-jump target for the map; lat/lon here (not [lon, lat]) to match how presets read. */
export interface Preset {
  name: string
  lat: number
  lon: number
  zoom: number
}

/** One of a country's top-10-by-elevation peaks, in the mountain drill-down menu. */
export interface Peak extends Preset {
  elevation: number
}

export interface CountryPeaks {
  country: string
  /** ISO 3166-1 alpha-2, used to render a flag emoji — see countryFlag() in data/mountains.ts. */
  code: string
  peaks: Peak[]
}

/** A free-text search match from the server's Nominatim-backed geocoder. */
export interface PeakSearchResult {
  name: string
  lat: number
  lon: number
  /** Missing when OSM has no `ele` tag for this summit. */
  elevation: number | null
  /** Missing when Nominatim's address lookup didn't resolve one. */
  country: string | null
}

export interface SearchPeaksResponse {
  results: PeakSearchResult[]
}

/** Internal server-side shape for a summit found via Overpass, before DEM placement. */
export interface RawSummit {
  name: string
  ele: number
  lat: number
  lon: number
}
