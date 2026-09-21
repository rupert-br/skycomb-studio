import { z } from 'zod'
import { buildRidgelines, TilesUnavailableError } from '../utils/dem'
import { parseFrame } from '../utils/frame'

const querySchema = z.object({
  lines: z.coerce.number().int().min(16).max(240).default(100), // Number of ridgelines, far -> near
  samples: z.coerce.number().int().min(64).max(2000).default(360), // Points per ridgeline
  direction: z.enum(['north', 'east', 'south', 'west']).default('north'),
})

export default defineEventHandler(async (event) => {
  const query = getQuery(event)
  const bbox = parseFrame(query)
  const parsed = querySchema.safeParse(query)
  if (!parsed.success) {
    throw createError({ statusCode: 422, statusMessage: 'Invalid lines/samples/direction' })
  }
  const { lines, samples, direction } = parsed.data

  try {
    const result = await buildRidgelines(bbox, lines, samples, direction)
    setResponseHeader(event, 'Cache-Control', 'public, max-age=86400')
    return result
  } catch (e) {
    if (e instanceof TilesUnavailableError) {
      throw createError({ statusCode: 502, statusMessage: e.message })
    }
    throw e
  }
})
