import { z } from 'zod'
import type { Bbox } from '../../types/ridgeline'

// Mirrors the frontend's own copy of these limits (composables/useRidgelineApi.ts)
export const MAX_LON_SPAN = 2.0 // degrees; keeps the tile budget meaningful
export const MAX_LAT_SPAN = 1.4
const MIN_SPAN = 0.005

const frameSchema = z.object({
  west: z.coerce.number().min(-180).max(180),
  south: z.coerce.number().min(-85).max(85),
  east: z.coerce.number().min(-180).max(180),
  north: z.coerce.number().min(-85).max(85),
})

/** Validated bounding box, rounded so nearly identical frames (~10 m apart) share cache entries. */
export function parseFrame(query: Record<string, unknown>): Bbox {
  const parsed = frameSchema.safeParse(query)
  if (!parsed.success) {
    throw createError({ statusCode: 422, statusMessage: 'Expected numeric west/south/east/north' })
  }
  const { west, south, east, north } = parsed.data
  if (west >= east || south >= north) {
    throw createError({ statusCode: 422, statusMessage: 'Expected west < east and south < north' })
  }
  if (east - west > MAX_LON_SPAN || north - south > MAX_LAT_SPAN) {
    throw createError({
      statusCode: 422,
      statusMessage: `Area too large (max ${MAX_LON_SPAN}° x ${MAX_LAT_SPAN}°) — zoom in`,
    })
  }
  if (Math.min(east - west, north - south) < MIN_SPAN) {
    throw createError({ statusCode: 422, statusMessage: 'Area too small — zoom out' })
  }
  return [west, south, east, north].map((v) => Math.round(v * 1e4) / 1e4) as Bbox
}
