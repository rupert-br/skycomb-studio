import { z } from 'zod'
import { searchPeaks } from '../utils/peaks'

const querySchema = z.object({ q: z.string().min(2).max(100) })

/** Free-text mountain search (any named peak worldwide, not just the built-in top-10 lists). */
export default defineEventHandler(async (event) => {
  const parsed = querySchema.safeParse(getQuery(event))
  if (!parsed.success) {
    throw createError({ statusCode: 422, statusMessage: 'q must be 2-100 characters' })
  }

  const results = await searchPeaks(parsed.data.q)
  if (results === null) {
    throw createError({ statusCode: 502, statusMessage: 'Mountain search is unavailable right now' })
  }
  setResponseHeader(event, 'Cache-Control', 'public, max-age=3600')
  return { results }
})
