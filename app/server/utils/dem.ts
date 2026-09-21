/**
 * Elevation tiles → ridgeline profiles for an arbitrary bounding box.
 * Port of app/backend/dem.py. Tiles: AWS Terrain Tiles (Terrarium encoding),
 * https://registry.opendata.aws/terrain-tiles/
 */
import { promises as fs } from 'node:fs'
import path from 'node:path'
import type { Bbox, Direction, RawSummit, Summit } from '../../types/ridgeline'
import { SharedCache } from './sharedCache'
import { decodeTerrariumTile } from './terrarium'

const TILE_URL = 'https://s3.amazonaws.com/elevation-tiles-prod/terrarium/{z}/{x}/{y}.png'
const CACHE_DIR = process.env.TILE_CACHE_DIR ?? path.join(process.cwd(), '.cache', 'tiles')
const MAX_ZOOM = 13 // ~12 m/px in the Alps; plenty for a few hundred samples per line
const MAX_TILES = 64 // per request; bounds memory (~64 x 256^2 px) and load on the tile source
const EARTH_CIRCUMFERENCE = 40075016.686
const USER_AGENT = 'skycomb-studio/0.1 (prototype)'
const TILE_FETCH_CONCURRENCY = 16

export class TilesUnavailableError extends Error {}

export interface Grid {
  data: Float32Array
  width: number
  height: number
}

interface GridResult {
  grid: Grid
  zoom: number
  tileCount: number
  /** World pixel coordinates (at `zoom`) of the grid's top-left corner. */
  origin: [number, number]
}

// Stitched rasters per bbox (<= ~16 MB each); direction/line changes reuse them
const grids = new SharedCache<string, GridResult>(6)
// Decoded tiles, keyed "z/x/y"
const tileCache = new SharedCache<string, Grid>(256)

export function lonlatToPx(lon: number, lat: number, z: number): [number, number] {
  const n = 256 * 2 ** z
  const x = ((lon + 180) / 360) * n
  const y = ((1 - Math.asinh(Math.tan((lat * Math.PI) / 180)) / Math.PI) / 2) * n
  return [x, y]
}

export function metresPerPx(z: number, south: number, north: number): number {
  return (EARTH_CIRCUMFERENCE * Math.cos((((south + north) / 2) * Math.PI) / 180)) / (256 * 2 ** z)
}

async function mapLimit<T, R>(items: T[], limit: number, fn: (item: T) => Promise<R>): Promise<R[]> {
  const results = new Array<R>(items.length)
  let next = 0
  async function worker() {
    for (let i = next++; i < items.length; i = next++) {
      results[i] = await fn(items[i]!)
    }
  }
  await Promise.all(Array.from({ length: Math.min(limit, items.length) }, worker))
  return results
}

async function fetchTile(z: number, x: number, y: number): Promise<Grid> {
  return tileCache.get(`${z}/${x}/${y}`, async () => {
    const filePath = path.join(CACHE_DIR, String(z), String(x), `${y}.png`)
    let buffer: Buffer
    try {
      buffer = await fs.readFile(filePath)
    } catch {
      const url = TILE_URL.replace('{z}', String(z)).replace('{x}', String(x)).replace('{y}', String(y))
      let response: Response
      try {
        response = await fetch(url, { headers: { 'User-Agent': USER_AGENT } })
      } catch (e) {
        throw new TilesUnavailableError(`Elevation tiles unreachable: ${(e as Error).message}`)
      }
      if (!response.ok) {
        throw new TilesUnavailableError(`Elevation tiles unavailable: HTTP ${response.status}`)
      }
      buffer = Buffer.from(await response.arrayBuffer())
      await fs.mkdir(path.dirname(filePath), { recursive: true })
      const tmp = `${filePath}.${process.pid}.${Math.random().toString(36).slice(2)}.tmp`
      await fs.writeFile(tmp, buffer)
      await fs.rename(tmp, filePath)
    }
    const { data, size } = decodeTerrariumTile(buffer)
    return { data, width: size, height: size }
  })
}

function tileSpan(bbox: Bbox, z: number) {
  const [west, south, east, north] = bbox
  const [x0, y0] = lonlatToPx(west, north, z)
  const [x1, y1] = lonlatToPx(east, south, z)
  return {
    px: [x0, y0, x1, y1] as const,
    tiles: [Math.floor(x0 / 256), Math.floor(y0 / 256), Math.floor(x1 / 256), Math.floor(y1 / 256)] as const,
  }
}

/** Highest zoom whose tile count fits the per-request budget. */
function pickZoom(bbox: Bbox): number {
  for (let z = MAX_ZOOM; z > 0; z--) {
    const [tx0, ty0, tx1, ty1] = tileSpan(bbox, z).tiles
    if ((tx1 - tx0 + 1) * (ty1 - ty0 + 1) <= MAX_TILES) return z
  }
  return 0
}

/** Flattens single-pixel spikes and pits (bad DEM values) to the range of their 8 neighbours. */
function despike(grid: Grid, tolerance = 200): Grid {
  const { data, width, height } = grid
  const out = new Float32Array(data.length)
  const clampX = (x: number) => (x < 0 ? 0 : x >= width ? width - 1 : x)
  const clampY = (y: number) => (y < 0 ? 0 : y >= height ? height - 1 : y)
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      let hi = -Infinity
      let lo = Infinity
      for (let dy = -1; dy <= 1; dy++) {
        for (let dx = -1; dx <= 1; dx++) {
          if (dx === 0 && dy === 0) continue
          const v = data[clampY(y + dy) * width + clampX(x + dx)]!
          if (v > hi) hi = v
          if (v < lo) lo = v
        }
      }
      const v = data[y * width + x]!
      out[y * width + x] = v > hi + tolerance ? hi : v < lo - tolerance ? lo : v
    }
  }
  return { data: out, width, height }
}

/** Stitch, crop and clean the elevation raster for bbox. */
async function elevationGrid(bbox: Bbox): Promise<GridResult> {
  const z = pickZoom(bbox)
  const {
    px: [x0, y0, x1, y1],
    tiles: [tx0, ty0, tx1, ty1],
  } = tileSpan(bbox, z)

  const coords: Array<[number, number]> = []
  for (let ty = ty0; ty <= ty1; ty++) for (let tx = tx0; tx <= tx1; tx++) coords.push([tx, ty])
  const fetched = await mapLimit(coords, TILE_FETCH_CONCURRENCY, ([tx, ty]) => fetchTile(z, tx, ty))

  const mosaicWidth = (tx1 - tx0 + 1) * 256
  const mosaicHeight = (ty1 - ty0 + 1) * 256
  const mosaic = new Float32Array(mosaicWidth * mosaicHeight)
  coords.forEach(([tx, ty], i) => {
    const tile = fetched[i]!
    const ox = (tx - tx0) * 256
    const oy = (ty - ty0) * 256
    for (let row = 0; row < 256; row++) {
      mosaic.set(tile.data.subarray(row * 256, (row + 1) * 256), (oy + row) * mosaicWidth + ox)
    }
  })

  const originX = tx0 * 256
  const originY = ty0 * 256
  const cropX0 = Math.floor(x0 - originX)
  const cropY0 = Math.floor(y0 - originY)
  const cropX1 = Math.ceil(x1 - originX)
  const cropY1 = Math.ceil(y1 - originY)
  const cropWidth = cropX1 - cropX0
  const cropHeight = cropY1 - cropY0
  const cropped = new Float32Array(cropWidth * cropHeight)
  for (let row = 0; row < cropHeight; row++) {
    const srcOffset = (cropY0 + row) * mosaicWidth + cropX0
    cropped.set(mosaic.subarray(srcOffset, srcOffset + cropWidth), row * cropWidth)
  }

  return {
    grid: despike({ data: cropped, width: cropWidth, height: cropHeight }),
    zoom: z,
    tileCount: coords.length,
    origin: [x0, y0],
  }
}

function bboxKey(bbox: Bbox): string {
  return bbox.map((v) => v.toFixed(4)).join(',')
}

/** elevationGrid, cached per bbox; concurrent requests for the same area share one computation. */
function gridFor(bbox: Bbox): Promise<GridResult> {
  return grids.get(bboxKey(bbox), () => elevationGrid(bbox))
}

function transpose(grid: Grid): Grid {
  const { data, width, height } = grid
  const out = new Float32Array(width * height)
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) out[x * height + y] = data[y * width + x]!
  }
  return { data: out, width: height, height: width }
}

function flipRows(grid: Grid): Grid {
  const { data, width, height } = grid
  const out = new Float32Array(width * height)
  for (let y = 0; y < height; y++) out.set(data.subarray(y * width, (y + 1) * width), (height - 1 - y) * width)
  return { data: out, width, height }
}

function flipCols(grid: Grid): Grid {
  const { data, width, height } = grid
  const out = new Float32Array(width * height)
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) out[y * width + (width - 1 - x)] = data[y * width + x]!
  }
  return { data: out, width, height }
}

/** Turn the grid so row 0 is the far edge and columns run left -> right as the viewer sees them. */
function orient(grid: Grid, direction: Direction): Grid {
  switch (direction) {
    case 'north':
      return grid
    case 'south':
      return flipCols(flipRows(grid))
    case 'east':
      return flipRows(transpose(grid))
    case 'west':
      return flipCols(transpose(grid))
  }
}

/** Cuts grid into nLines horizontal bands; each line = per-column maxima of the band, averaged over its rows. */
function computeProfiles(grid: Grid, nLines: number, nSamples: number): number[][] {
  const { data, width: w, height: h } = grid
  const bandEdges = Array.from({ length: nLines + 1 }, (_, i) => Math.floor((i * h) / nLines))
  const colStarts = Array.from({ length: nSamples }, (_, j) => Math.min(Math.floor((j * w) / nSamples), w - 1))

  const rows: number[][] = []
  for (let i = 0; i < nLines; i++) {
    const bandStart = bandEdges[i]!
    const bandEnd = Math.max(bandEdges[i + 1]!, bandStart + 1)
    const sums = new Float64Array(nSamples)
    for (let r = bandStart; r < bandEnd; r++) {
      const rowOffset = r * w
      for (let j = 0; j < nSamples; j++) {
        const c0 = colStarts[j]!
        const c1 = j + 1 < nSamples ? colStarts[j + 1]! : w
        let max = data[rowOffset + c0]!
        for (let c = c0 + 1; c < c1; c++) {
          const v = data[rowOffset + c]!
          if (v > max) max = v
        }
        sums[j] = sums[j]! + max
      }
    }
    const bandRowCount = bandEnd - bandStart
    rows.push(Array.from(sums, (s) => Math.round(s / bandRowCount)))
  }
  return rows
}

export interface RidgelinesResult {
  bbox: Bbox
  direction: Direction
  min: number
  max: number
  rows: number[][]
  meta: { zoom: number; tiles: number; metres_per_px: number; elapsed_ms: number }
}

export async function buildRidgelines(
  bbox: Bbox,
  nLines: number,
  nSamples: number,
  direction: Direction,
): Promise<RidgelinesResult> {
  const started = performance.now()
  const { grid, zoom, tileCount } = await gridFor(bbox)
  const rows = computeProfiles(orient(grid, direction), nLines, nSamples)

  let min = Infinity
  let max = -Infinity
  for (const row of rows) for (const v of row) {
    if (v < min) min = v
    if (v > max) max = v
  }

  return {
    bbox,
    direction,
    min,
    max,
    rows,
    meta: {
      zoom,
      tiles: tileCount,
      metres_per_px: Math.round(metresPerPx(zoom, bbox[1], bbox[3]) * 10) / 10,
      elapsed_ms: Math.round(performance.now() - started),
    },
  }
}

/**
 * Places summits as fractions of the frame (down from the north edge, across from the west
 * edge), each moved to the highest DEM pixel within 500 m. Fractions don't depend on direction
 * or line count, so the client maps them onto whatever lines it is showing.
 */
export async function locateSummits(bbox: Bbox, summits: RawSummit[]): Promise<Summit[]> {
  const { grid, zoom, origin } = await gridFor(bbox)
  const { data, width: w, height: h } = grid
  const [x0, y0] = origin
  const radius = Math.max(Math.floor(500 / metresPerPx(zoom, bbox[1], bbox[3])), 1)

  const placed: Summit[] = []
  for (const summit of summits) {
    const [px, py] = lonlatToPx(summit.lon, summit.lat, zoom)
    const cx = Math.floor(px - x0)
    const cy = Math.floor(py - y0)
    if (!(cx >= 0 && cx < w && cy >= 0 && cy < h)) continue

    const xs = Math.max(cx - radius, 0)
    const ys = Math.max(cy - radius, 0)
    const xe = Math.min(cx + radius + 1, w)
    const ye = Math.min(cy + radius + 1, h)

    let bestVal = -Infinity
    let bestX = xs
    let bestY = ys
    for (let y = ys; y < ye; y++) {
      for (let x = xs; x < xe; x++) {
        const v = data[y * w + x]!
        if (v > bestVal) {
          bestVal = v
          bestX = x
          bestY = y
        }
      }
    }

    placed.push({
      name: summit.name,
      ele: summit.ele,
      down: Math.round(((bestY + 0.5) / h) * 1e5) / 1e5,
      across: Math.round(((bestX + 0.5) / w) * 1e5) / 1e5,
    })
  }
  return placed
}
