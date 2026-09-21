import { PNG } from 'pngjs'

/**
 * Decodes a Terrarium-encoded elevation tile (AWS Terrain Tiles) into a flat, row-major
 * Float32Array of elevations in metres. Terrarium packs elevation into RGB:
 * `R*256 + G + B/256 - 32768`. Port of the RGB math in app/backend/dem.py's fetch_tile.
 */
export function decodeTerrariumTile(buffer: Buffer): { data: Float32Array; size: number } {
  const png = PNG.sync.read(buffer)
  const { width, height, data } = png // RGBA, 4 bytes/pixel
  if (width !== height) throw new Error(`Expected a square tile, got ${width}x${height}`)

  const elevations = new Float32Array(width * height)
  for (let i = 0; i < elevations.length; i++) {
    const o = i * 4
    elevations[i] = data[o]! * 256 + data[o + 1]! + data[o + 2]! / 256 - 32768
  }
  return { data: elevations, size: width }
}
