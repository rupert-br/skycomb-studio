// ISO 216 A4 portrait (width:height = 1:sqrt(2)) — the frame on the map and the poster
// preview both use it, so what you compose is the shape you'd actually print.
export const A4_ASPECT = 1 / Math.SQRT2
export const POSTER_WIDTH = 300
export const POSTER_HEIGHT = Math.round(POSTER_WIDTH / A4_ASPECT)

// Mirrors the backend limits in server/utils/frame.ts
export const MAX_LON_SPAN = 2.0
export const MAX_LAT_SPAN = 1.4
