import type { Bbox, RidgelinesResponse, SummitsResponse, SearchPeaksResponse, Direction } from "./types"

async function getJson<T>(path: string, params: Record<string, string | number | boolean>, signal?: AbortSignal): Promise<T> {
  const response = await fetch(`${path}?${new URLSearchParams(params as Record<string, string>)}`, { signal })
  if (!response.ok) {
    const body = await response.json().catch(() => ({}))
    throw new Error(typeof body.detail === "string" ? body.detail : `Request failed (${response.status})`)
  }
  return response.json()
}

export const frameKey = (bbox: Bbox): string => bbox.map((v) => v.toFixed(4)).join(",")

function frameParams(bbox: Bbox) {
  const [west, south, east, north] = bbox.map((v) => v.toFixed(4))
  return { west, south, east, north }
}

export interface FetchRidgelinesOptions {
  bbox: Bbox
  lines: number
  samples: number
  direction: Direction
}

export function fetchRidgelines({ bbox, lines, samples, direction }: FetchRidgelinesOptions, signal?: AbortSignal) {
  return getJson<RidgelinesResponse>("/api/ridgelines", { ...frameParams(bbox), lines, samples, direction }, signal)
}

// Summits depend only on the frame, not on direction or line count
export function fetchSummits(bbox: Bbox, signal?: AbortSignal) {
  return getJson<SummitsResponse>("/api/summits", frameParams(bbox), signal)
}

export function searchPeaks(query: string, signal?: AbortSignal) {
  return getJson<SearchPeaksResponse>("/api/search-peaks", { q: query }, signal)
}
