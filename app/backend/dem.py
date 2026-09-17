"""Elevation tiles → ridgeline profiles for an arbitrary bounding box.

Tiles: AWS Terrain Tiles (Terrarium encoding), https://registry.opendata.aws/terrain-tiles/
"""
import math
import os
import threading
import time
import urllib.request
from concurrent.futures import ThreadPoolExecutor
from functools import lru_cache
from pathlib import Path

import numpy as np
from PIL import Image

from cache import SharedCache

TILE_URL = "https://s3.amazonaws.com/elevation-tiles-prod/terrarium/{z}/{x}/{y}.png"
CACHE_DIR = Path(os.environ.get("TILE_CACHE_DIR", Path(__file__).parent / ".cache" / "tiles"))
MAX_ZOOM = 13      # ~12 m/px in the Alps; plenty for a few hundred samples per line
MAX_TILES = 64     # per request; bounds memory (~64 × 256² px) and load on the tile source
EARTH_CIRCUMFERENCE = 40075016.686
USER_AGENT = "ridgeline-studio/0.1 (prototype)"

_pool = ThreadPoolExecutor(16)
_grids = SharedCache(maxsize=6)  # stitched rasters per bbox (≤ ~16 MB each); direction/line changes reuse them


def lonlat_to_px(lon, lat, z):
    """Web Mercator world pixel coordinates at zoom z."""
    n = 256 * 2**z
    x = (lon + 180) / 360 * n
    y = (1 - math.asinh(math.tan(math.radians(lat))) / math.pi) / 2 * n
    return x, y


def metres_per_px(z, south, north):
    return EARTH_CIRCUMFERENCE * math.cos(math.radians((south + north) / 2)) / (256 * 2**z)


@lru_cache(maxsize=256)
def fetch_tile(z, x, y):
    path = CACHE_DIR / str(z) / str(x) / f"{y}.png"
    if not path.exists():
        request = urllib.request.Request(TILE_URL.format(z=z, x=x, y=y), headers={"User-Agent": USER_AGENT})
        with urllib.request.urlopen(request, timeout=20) as response:
            body = response.read()
        path.parent.mkdir(parents=True, exist_ok=True)
        tmp = path.with_name(f"{y}.{threading.get_ident()}.tmp")
        tmp.write_bytes(body)
        tmp.replace(path)
    rgb = np.asarray(Image.open(path).convert("RGB"), dtype=np.float32)
    tile = rgb[..., 0] * 256 + rgb[..., 1] + rgb[..., 2] / 256 - 32768
    tile.setflags(write=False)  # shared via the LRU cache
    return tile


def tile_span(bbox, z):
    west, south, east, north = bbox
    x0, y0 = lonlat_to_px(west, north, z)
    x1, y1 = lonlat_to_px(east, south, z)
    return (x0, y0, x1, y1), (int(x0 // 256), int(y0 // 256), int(x1 // 256), int(y1 // 256))


def pick_zoom(bbox):
    """Highest zoom whose tile count fits the per-request budget."""
    for z in range(MAX_ZOOM, 0, -1):
        _, (tx0, ty0, tx1, ty1) = tile_span(bbox, z)
        if (tx1 - tx0 + 1) * (ty1 - ty0 + 1) <= MAX_TILES:
            return z
    return 0


def despike(grid, tolerance=200):
    """Flatten single-pixel spikes and pits (bad DEM values) to the range of their 8 neighbours."""
    h, w = grid.shape
    padded = np.pad(grid, 1, mode="edge")
    hi = np.full_like(grid, -np.inf)
    lo = np.full_like(grid, np.inf)
    for dy in (-1, 0, 1):
        for dx in (-1, 0, 1):
            if dy or dx:
                neighbour = padded[1 + dy:h + 1 + dy, 1 + dx:w + 1 + dx]
                np.maximum(hi, neighbour, out=hi)
                np.minimum(lo, neighbour, out=lo)
    return np.where(grid > hi + tolerance, hi, np.where(grid < lo - tolerance, lo, grid))


def elevation_grid(bbox):
    """Stitch, crop and clean the elevation raster for bbox. Returns (grid, zoom, tile count, pixel origin)."""
    z = pick_zoom(bbox)
    (x0, y0, x1, y1), (tx0, ty0, tx1, ty1) = tile_span(bbox, z)
    coords = [(tx, ty) for ty in range(ty0, ty1 + 1) for tx in range(tx0, tx1 + 1)]
    tiles = list(_pool.map(lambda c: fetch_tile(z, *c), coords))

    mosaic = np.empty(((ty1 - ty0 + 1) * 256, (tx1 - tx0 + 1) * 256), dtype=np.float32)
    for (tx, ty), tile in zip(coords, tiles):
        mosaic[(ty - ty0) * 256:(ty - ty0 + 1) * 256, (tx - tx0) * 256:(tx - tx0 + 1) * 256] = tile

    ox, oy = tx0 * 256, ty0 * 256
    grid = mosaic[int(y0 - oy):math.ceil(y1 - oy), int(x0 - ox):math.ceil(x1 - ox)]
    return despike(grid), z, len(coords), (x0, y0)


def grid_for(bbox):
    """elevation_grid, cached per bbox; concurrent requests for the same area share one download."""
    return _grids.get(bbox, lambda: elevation_grid(bbox))


def orient(grid, direction):
    """Turn the grid so row 0 is the far edge and columns run left → right as the viewer sees them."""
    return {
        "north": lambda: grid,
        "south": lambda: grid[::-1, ::-1],
        "east": lambda: grid.T[::-1, :],
        "west": lambda: grid.T[:, ::-1],
    }[direction]()


def profiles(grid, n_lines, n_samples):
    """Cut grid into n_lines horizontal bands; each line = per-column maxima of the band, averaged over its rows."""
    h, w = grid.shape
    band_edges = np.linspace(0, h, n_lines + 1).astype(int)
    col_starts = np.minimum(np.linspace(0, w, n_samples + 1).astype(int)[:-1], w - 1)
    rows = np.empty((n_lines, n_samples), dtype=np.float32)
    for i in range(n_lines):
        band = grid[band_edges[i]:max(band_edges[i + 1], band_edges[i] + 1)]
        rows[i] = np.maximum.reduceat(band, col_starts, axis=1).mean(axis=0)
    return np.rint(rows).astype(int)


def build_ridgelines(bbox, n_lines, n_samples, direction):
    started = time.perf_counter()
    grid, z, n_tiles, _ = grid_for(bbox)
    rows = profiles(orient(grid, direction), n_lines, n_samples)
    return {
        "bbox": list(bbox),
        "direction": direction,
        "min": int(rows.min()),
        "max": int(rows.max()),
        "rows": rows.tolist(),
        "meta": {
            "zoom": z,
            "tiles": n_tiles,
            "metres_per_px": round(metres_per_px(z, bbox[1], bbox[3]), 1),
            "elapsed_ms": round((time.perf_counter() - started) * 1000),
        },
    }


def locate_summits(bbox, summits):
    """Place summits as fractions of the frame (down from the north edge, across from the west edge),
    each moved to the highest DEM pixel within 500 m. Fractions don't depend on direction or line count,
    so the client maps them onto whatever lines it is showing."""
    grid, z, _, (x0, y0) = grid_for(bbox)
    h, w = grid.shape
    radius = max(int(500 / metres_per_px(z, bbox[1], bbox[3])), 1)
    placed = []
    for summit in summits:
        px, py = lonlat_to_px(summit["lon"], summit["lat"], z)
        cx, cy = int(px - x0), int(py - y0)
        if not (0 <= cx < w and 0 <= cy < h):
            continue
        ys, xs = max(cy - radius, 0), max(cx - radius, 0)
        window = grid[ys:cy + radius + 1, xs:cx + radius + 1]
        dy, dx = np.unravel_index(window.argmax(), window.shape)
        placed.append({
            "name": summit["name"],
            "ele": summit["ele"],
            "down": round((ys + dy + 0.5) / h, 5),
            "across": round((xs + dx + 0.5) / w, 5),
        })
    return placed
