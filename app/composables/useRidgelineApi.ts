// Port of app/frontend/src/api.ts. Plain functions (no reactive state), auto-imported by Nuxt
// from composables/ like everything else here.
import type { Bbox, Direction, RidgelinesResponse, SearchPeaksResponse, SummitsResponse } from '~/types/ridgeline'

async function getJson<T>(
  path: string,
  params: Record<string, string | number | boolean>,
  signal?: AbortSignal,
): Promise<T> {
  const response = await fetch(`${path}?${new URLSearchParams(params as Record<string, string>)}`, { signal })
  if (!response.ok) {
    const body = await response.json().catch(() => ({}))
    const message = body.statusMessage ?? body.message
    throw new Error(typeof message === 'string' ? message : `Request failed (${response.status})`)
  }
  return response.json()
}

export const frameKey = (bbox: Bbox): string => bbox.map((v) => v.toFixed(4)).join(',')

function frameParams(bbox: Bbox) {
  const [west, south, east, north] = bbox
  return { west: west.toFixed(4), south: south.toFixed(4), east: east.toFixed(4), north: north.toFixed(4) }
}

export interface FetchRidgelinesOptions {
  bbox: Bbox
  lines: number
  samples: number
  direction: Direction
}

export function fetchRidgelines({ bbox, lines, samples, direction }: FetchRidgelinesOptions, signal?: AbortSignal) {
  return getJson<RidgelinesResponse>('/api/ridgelines', { ...frameParams(bbox), lines, samples, direction }, signal)
}

// Summits depend only on the frame, not on direction or line count
export function fetchSummits(bbox: Bbox, signal?: AbortSignal) {
  return getJson<SummitsResponse>('/api/summits', frameParams(bbox), signal)
}

export function searchPeaks(query: string, signal?: AbortSignal) {
  return getJson<SearchPeaksResponse>('/api/search-peaks', { q: query }, signal)
}
