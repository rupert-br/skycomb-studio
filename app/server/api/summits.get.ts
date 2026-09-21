import { locateSummits, TilesUnavailableError } from '../utils/dem'
import { parseFrame } from '../utils/frame'
import { summits as lookupSummits } from '../utils/peaks'

/** Named summits for the frame. Separate from /api/ridgelines so a slow Overpass never delays the lines. */
export default defineEventHandler(async (event) => {
  const bbox = parseFrame(getQuery(event))

  const named = await lookupSummits(bbox)
  if (named === null) {
    // Nothing is cached, so the next request retries the lookup
    setResponseHeader(event, 'Cache-Control', 'no-store')
    return { summits: [], error: 'Summit names are unavailable right now' }
  }

  try {
    // Grid is shared with /api/ridgelines for the same frame
    const placed = await locateSummits(bbox, named)
    setResponseHeader(event, 'Cache-Control', 'public, max-age=86400')
    return { summits: placed }
  } catch (e) {
    if (e instanceof TilesUnavailableError) {
      throw createError({ statusCode: 502, statusMessage: e.message })
    }
    throw e
  }
})
