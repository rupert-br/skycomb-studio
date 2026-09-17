"""Fetch elevation for mountain regions around Salzburg (AT) and export ridgeline rows.

Source: AWS Terrain Tiles (Terrarium encoding), https://registry.opendata.aws/terrain-tiles/
Output: `const regions = {...}` inlined into index.html.
"""
import io
import json
import math
import os
import urllib.request
from concurrent.futures import ThreadPoolExecutor

import numpy as np
from PIL import Image

CACHE = ".cache/tiles"
MAX_TILES = 80     # zoom is chosen per region as the highest level within this tile budget

# Named summits (real elevations); labels snap to the highest drawn point nearby
PEAKS = [
    {"name": "Großglockner", "elev": 3798, "lat": 47.0745, "lon": 12.6941},
    {"name": "Großvenediger", "elev": 3657, "lat": 47.1092, "lon": 12.3464},
    {"name": "Hoher Dachstein", "elev": 2995, "lat": 47.4753, "lon": 13.6064},
    {"name": "Hochkönig", "elev": 2941, "lat": 47.4203, "lon": 13.0628},
    {"name": "Hoher Göll", "elev": 2522, "lat": 47.5936, "lon": 13.0658},
    {"name": "Raucheck", "elev": 2430, "lat": 47.4990, "lon": 13.2260},
    {"name": "Ellmauer Halt", "elev": 2344, "lat": 47.5616, "lon": 12.3024},
]

# bbox = (west, south, east, north)
REGIONS = {
    "overview": {"name": "Salzburger Alpen", "subtitle": "Wilder Kaiser · Großvenediger · Großglockner · Hochkönig · Hoher Göll · Tennengebirge · Dachstein",
                 "bbox": (12.10, 46.98, 13.85, 47.62), "rows": 120, "cols": 480},
    "tennengebirge": {"name": "Tennengebirge", "subtitle": "Salzburg · Austria",
                      "bbox": (13.11, 47.44, 13.47, 47.60), "rows": 100, "cols": 360},
    "hochkoenig": {"name": "Hochkönig", "subtitle": "Berchtesgadener Alpen · Salzburg",
                   "bbox": (12.93, 47.36, 13.22, 47.49), "rows": 100, "cols": 360},
    "hohergoell": {"name": "Hoher Göll", "subtitle": "Berchtesgadener Alpen · Salzburg · Bavaria",
                   "bbox": (12.96, 47.54, 13.18, 47.66), "rows": 100, "cols": 360},
    "dachstein": {"name": "Dachstein", "subtitle": "Salzburg · Upper Austria · Styria",
                  "bbox": (13.42, 47.42, 13.82, 47.58), "rows": 100, "cols": 360},
    "grossvenediger": {"name": "Großvenediger", "subtitle": "Hohe Tauern · Salzburg · Tyrol",
                       "bbox": (12.18, 47.02, 12.52, 47.20), "rows": 100, "cols": 360},
    "grossglockner": {"name": "Großglockner", "subtitle": "Hohe Tauern · Carinthia · Tyrol",
                      "bbox": (12.55, 46.98, 12.87, 47.18), "rows": 100, "cols": 360},
    "wilderkaiser": {"name": "Wilder Kaiser", "subtitle": "Kaisergebirge · Tyrol",
                     "bbox": (12.14, 47.51, 12.46, 47.63), "rows": 100, "cols": 360},
}


def lonlat_to_px(lon, lat, z):
    n = 256 * 2**z
    x = (lon + 180) / 360 * n
    y = (1 - math.log(math.tan(math.radians(lat)) + 1 / math.cos(math.radians(lat))) / math.pi) / 2 * n
    return x, y


def fetch_tile(z, x, y):
    path = f"{CACHE}/{z}/{x}/{y}.png"
    if not os.path.exists(path):
        url = f"https://s3.amazonaws.com/elevation-tiles-prod/terrarium/{z}/{x}/{y}.png"
        with urllib.request.urlopen(url) as r:
            body = r.read()
        os.makedirs(os.path.dirname(path), exist_ok=True)
        with open(path, "wb") as f:
            f.write(body)
    img = np.asarray(Image.open(path).convert("RGB"), dtype=np.float64)
    return img[..., 0] * 256 + img[..., 1] + img[..., 2] / 256 - 32768


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
    fixed = np.where(grid > hi + tolerance, hi, np.where(grid < lo - tolerance, lo, grid))
    if (n := int((fixed != grid).sum())):
        print(f"  despiked {n} pixel(s)")
    return fixed


def ridgelines(grid, n_lines, n_samples, peak_pos):
    """Cut `grid` into `n_lines` horizontal bands, each resampled to `n_samples` points.

    peak_pos: [(peak, down, across)] with positions as 0..1 fractions of the grid.
    """
    h, w = grid.shape
    # Each ridgeline = mean over a band of the per-column maxima
    band_edges = np.linspace(0, h, n_lines + 1).astype(int)
    col_edges = np.linspace(0, w, n_samples + 1).astype(int)
    rows = np.array([
        [grid[band_edges[i]:band_edges[i + 1], col_edges[j]:col_edges[j + 1]].max(axis=1).mean() for j in range(n_samples)]
        for i in range(n_lines)
    ]).round().astype(int)

    peaks = []
    for p, down, across in peak_pos:
        r, c = min(int(down * n_lines), n_lines - 1), min(int(across * n_samples), n_samples - 1)
        # Snap to the highest drawn point within a small window
        r0, c0 = max(r - 1, 0), max(c - 4, 0)
        window = rows[r0:r + 2, c0:c + 5]
        dr, dc = np.unravel_index(window.argmax(), window.shape)
        peaks.append({"name": p["name"], "elev": p["elev"], "row": int(r0 + dr), "col": int(c0 + dc)})
    return rows, peaks


def tile_range(bbox, z):
    west, south, east, north = bbox
    x0, y0 = lonlat_to_px(west, north, z)
    x1, y1 = lonlat_to_px(east, south, z)
    return (x0, y0, x1, y1), (int(x0 // 256), int(y0 // 256), int(x1 // 256), int(y1 // 256))


def pick_zoom(bbox):
    for z in range(13, 5, -1):
        _, (tx0, ty0, tx1, ty1) = tile_range(bbox, z)
        if (tx1 - tx0 + 1) * (ty1 - ty0 + 1) <= MAX_TILES:
            return z


def build_region(key, cfg):
    bbox, n_rows, n_cols = cfg["bbox"], cfg["rows"], cfg["cols"]
    z = pick_zoom(bbox)
    (x0, y0, x1, y1), (tx0, ty0, tx1, ty1) = tile_range(bbox, z)
    coords = [(tx, ty) for ty in range(ty0, ty1 + 1) for tx in range(tx0, tx1 + 1)]
    print(f"{key}: zoom {z}, {len(coords)} tiles")

    with ThreadPoolExecutor(8) as pool:
        tiles = list(pool.map(lambda c: fetch_tile(z, *c), coords))
    mosaic = np.zeros(((ty1 - ty0 + 1) * 256, (tx1 - tx0 + 1) * 256))
    for (tx, ty), tile in zip(coords, tiles):
        mosaic[(ty - ty0) * 256:(ty - ty0 + 1) * 256, (tx - tx0) * 256:(tx - tx0 + 1) * 256] = tile

    # Crop to bbox in mosaic pixel coordinates
    ox, oy = tx0 * 256, ty0 * 256
    grid = mosaic[int(y0 - oy):int(y1 - oy), int(x0 - ox):int(x1 - ox)]
    grid = despike(grid)
    h, w = grid.shape

    # Summit positions as fractions of the grid: (down from north, across from west)
    west, south, east, north = bbox
    peak_pos = []
    metres_per_px = 40075016.686 * math.cos(math.radians((south + north) / 2)) / (256 * 2**z)
    radius = max(int(1000 / metres_per_px), 1)
    for p in PEAKS:
        if west <= p["lon"] <= east and south <= p["lat"] <= north:
            px, py = lonlat_to_px(p["lon"], p["lat"], z)
            # Move to the highest pixel within 1 km, so small coordinate errors don't miss the summit
            cx, cy = int(px - x0), int(py - y0)
            ys, xs = max(cy - radius, 0), max(cx - radius, 0)
            window = grid[ys:cy + radius + 1, xs:cx + radius + 1]
            dy, dx = np.unravel_index(window.argmax(), window.shape)
            sy, sx = ys + dy, xs + dx
            shift = math.hypot(sx - cx, sy - cy) * metres_per_px
            print(f"  {p['name']}: DEM summit {int(window.max())} m, {shift:.0f} m from given coordinate")
            peak_pos.append((p, (sy + 0.5) / h, (sx + 0.5) / w))

    # "ew": lines run west → east, ordered north → south (for looking north/south)
    # "ns": lines run north → south, ordered west → east (for looking east/west)
    ew_rows, ew_peaks = ridgelines(grid, n_rows, n_cols, peak_pos)
    ns_rows, ns_peaks = ridgelines(grid.T, n_rows, n_cols, [(p, across, down) for p, down, across in peak_pos])

    print(f"  grid {w}x{h}px, elevation {int(grid.min())}–{int(grid.max())} m, peaks: {[p['name'] for p in ew_peaks]}")
    return {
        "name": cfg["name"],
        "subtitle": cfg["subtitle"],
        "bbox": bbox,
        "min": int(min(ew_rows.min(), ns_rows.min())),
        "max": int(max(ew_rows.max(), ns_rows.max())),
        "views": {
            "ew": {"rows": ew_rows.tolist(), "peaks": ew_peaks},
            "ns": {"rows": ns_rows.tolist(), "peaks": ns_peaks},
        },
    }


def main():
    regions = {key: build_region(key, cfg) for key, cfg in REGIONS.items()}

    # Inline the data into index.html so the page works when opened straight from disk
    start, end = "// <data> (written by fetch_dem.py)\n", "// </data>"
    with open("index.html") as f:
        html = f.read()
    head, rest = html.split(start)
    tail = rest[rest.index(end):]
    js = "const regions = " + json.dumps(regions, separators=(",", ":"), ensure_ascii=False) + ";\n"
    with open("index.html", "w") as f:
        f.write(head + start + js + tail)
    print(f"wrote {len(js) // 1024} KB of data -> index.html")


if __name__ == "__main__":
    main()
