/**
 * Named summits from OpenStreetMap via the Overpass API, and free-text mountain search via
 * Nominatim. Port of app/backend/peaks.py — best effort: failures return null, not a thrown
 * error, so the route can decide how to degrade (empty labels, "unavailable" message, ...).
 */
import type { Bbox, PeakSearchResult, RawSummit } from '../../types/ridgeline'
import { SharedCache } from './sharedCache'

const USER_AGENT = 'skycomb-studio/0.1 (prototype)'
const PEAK_TYPES = new Set(['peak', 'volcano']) // OSM natural= values worth offering as a "mountain" search result

const summitsCache = new SharedCache<string, RawSummit[]>(512)
const searchCache = new SharedCache<string, PeakSearchResult[]>(256)

/** OSM `ele` tags are messy: "3798", "3798 m", "3.798" (German thousands separator). */
export function parseEle(value: string | null | undefined): number | null {
  if (!value) return null
  const match = /^\s*(-?\d+)(?:[.,](\d+))?/.exec(value)
  if (!match) return null
  const [, whole, fraction] = match
  if (fraction && fraction.length === 3 && Math.abs(Number(whole)) < 10) {
    return Number(whole + fraction)
  }
  return Math.round(Number(`${whole}.${fraction ?? 0}`))
}

function bboxKey(bbox: Bbox): string {
  return bbox.map((v) => v.toFixed(4)).join(',')
}

/** POST a query; the public instance often answers 429/5xx when busy and succeeds right after. */
async function queryOverpass(query: string, attempts = 2): Promise<any[]> {
  const config = useRuntimeConfig()
  for (let attempt = 0; attempt < attempts; attempt++) {
    // Can take ~8s even for a small frame; summits never block the lines, so wait generously
    const response = await fetch(config.overpassUrl, {
      method: 'POST',
      headers: { 'User-Agent': USER_AGENT, 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({ data: query }),
      signal: AbortSignal.timeout(30_000),
    })
    if (response.ok) return (await response.json()).elements
    if (![429, 502, 503, 504].includes(response.status) || attempt === attempts - 1) {
      throw new Error(`Overpass request failed: HTTP ${response.status}`)
    }
    await new Promise((resolve) => setTimeout(resolve, 1000))
  }
  throw new Error('Overpass request failed')
}

/** The highest named peaks in bbox, spread out so labels don't pile up. Null if the lookup fails. */
export async function summits(bbox: Bbox, limit = 6): Promise<RawSummit[] | null> {
  try {
    return await summitsCache.get(`${bboxKey(bbox)}|${limit}`, () => lookupSummits(bbox, limit))
  } catch {
    return null
  }
}

async function lookupSummits(bbox: Bbox, limit: number): Promise<RawSummit[]> {
  const [west, south, east, north] = bbox
  const query = `[out:json][timeout:25];node["natural"="peak"]["name"]["ele"](${south},${west},${north},${east});out body;`
  const elements = await queryOverpass(query)

  const candidates: RawSummit[] = []
  for (const el of elements) {
    const ele = parseEle(el.tags?.ele)
    if (ele !== null) candidates.push({ name: el.tags.name, ele, lat: el.lat, lon: el.lon })
  }
  candidates.sort((a, b) => b.ele - a.ele)

  // Greedy: highest first, skipping summits closer than 15% of the frame diagonal to one already chosen
  const cosLat = Math.cos((((south + north) / 2) * Math.PI) / 180)
  const minDistance = 0.15 * Math.hypot((east - west) * cosLat, north - south)
  const chosen: RawSummit[] = []
  for (const p of candidates) {
    const farEnough = chosen.every((q) => Math.hypot((p.lon - q.lon) * cosLat, p.lat - q.lat) >= minDistance)
    if (farEnough) {
      chosen.push(p)
      if (chosen.length === limit) break
    }
  }
  return chosen
}

/**
 * Free-text mountain search via Nominatim (OSM's geocoder), for the search bar's autocomplete.
 * Returns null if the lookup fails so the caller can distinguish "no results" from "unavailable".
 */
export async function searchPeaks(query: string, limit = 8): Promise<PeakSearchResult[] | null> {
  const trimmed = query.trim()
  if (!trimmed) return []
  try {
    return await searchCache.get(`${trimmed.toLowerCase()}|${limit}`, () => search(trimmed, limit))
  } catch {
    return null
  }
}

async function search(query: string, limit: number): Promise<PeakSearchResult[]> {
  const config = useRuntimeConfig()
  const params = new URLSearchParams({
    q: query,
    format: 'jsonv2',
    addressdetails: '1',
    extratags: '1',
    namedetails: '1',
    'accept-language': 'en', // otherwise country/address names come back in the local language
    limit: '20', // over-fetch: most matches for a free-text query aren't peaks, filtered out below
  })
  const response = await fetch(`${config.nominatimUrl}?${params}`, {
    headers: { 'User-Agent': USER_AGENT },
    signal: AbortSignal.timeout(10_000),
  })
  if (!response.ok) throw new Error(`Nominatim request failed: HTTP ${response.status}`)
  const elements = (await response.json()) as any[]

  const results: PeakSearchResult[] = []
  for (const el of elements) {
    // jsonv2 calls the OSM primary tag "category"; older Nominatim responses call it "class"
    const category = el.category ?? el.class
    if (category !== 'natural' || !PEAK_TYPES.has(el.type)) continue
    const name = el.namedetails?.name || el.display_name.split(',')[0]
    results.push({
      name,
      lat: Number(el.lat),
      lon: Number(el.lon),
      elevation: parseEle(el.extratags?.ele),
      country: el.address?.country ?? null,
    })
    if (results.length === limit) break
  }
  return results
}
