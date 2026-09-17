"""Ridgeline API: elevation profiles for any map area, ready to draw as an "Unknown Pleasures"-style chart.

Run: uvicorn main:app --port 8010
"""
import urllib.error
from enum import Enum

from fastapi import Depends, FastAPI, HTTPException, Query
from fastapi.middleware.gzip import GZipMiddleware
from fastapi.responses import JSONResponse

import dem
import peaks

MAX_LON_SPAN = 2.0   # degrees; keeps the tile budget meaningful (the frontend mirrors these limits)
MAX_LAT_SPAN = 1.4
MIN_SPAN = 0.005
CACHEABLE = {"Cache-Control": "public, max-age=86400"}

app = FastAPI(title="Ridgeline API", version="0.2.0")
app.add_middleware(GZipMiddleware, minimum_size=1024)


class Direction(str, Enum):
    north = "north"
    east = "east"
    south = "south"
    west = "west"


def frame(
    west: float = Query(..., ge=-180, le=180),
    south: float = Query(..., ge=-85, le=85),
    east: float = Query(..., ge=-180, le=180),
    north: float = Query(..., ge=-85, le=85),
):
    """Validated bounding box, rounded so nearly identical frames (~10 m apart) share cache entries."""
    if west >= east or south >= north:
        raise HTTPException(422, "Expected west < east and south < north")
    if east - west > MAX_LON_SPAN or north - south > MAX_LAT_SPAN:
        raise HTTPException(422, f"Area too large (max {MAX_LON_SPAN}° × {MAX_LAT_SPAN}°) — zoom in")
    if min(east - west, north - south) < MIN_SPAN:
        raise HTTPException(422, "Area too small — zoom out")
    return tuple(round(v, 4) for v in (west, south, east, north))


def tiles_unavailable(e):
    return HTTPException(502, f"Elevation tiles unavailable: {e.reason}")


@app.get("/api/health")
def health():
    return {"ok": True}


@app.get("/api/ridgelines")
def ridgelines(
    bbox: tuple = Depends(frame),
    lines: int = Query(100, ge=16, le=240, description="Number of ridgelines, far → near"),
    samples: int = Query(360, ge=64, le=2000, description="Points per ridgeline"),
    direction: Direction = Query(Direction.north, description="Direction the viewer is looking"),
):
    try:
        result = dem.build_ridgelines(bbox, lines, samples, direction.value)
    except urllib.error.URLError as e:
        raise tiles_unavailable(e)
    return JSONResponse(result, headers=CACHEABLE)


@app.get("/api/search-peaks")
def search_peaks(q: str = Query(..., min_length=2, max_length=100)):
    """Free-text mountain search (any named peak worldwide, not just the built-in top-10 lists)."""
    results = peaks.search_peaks(q)
    if results is None:
        raise HTTPException(502, "Mountain search is unavailable right now")
    return JSONResponse({"results": results}, headers={"Cache-Control": "public, max-age=3600"})


@app.get("/api/summits")
def summits(bbox: tuple = Depends(frame)):
    """Named summits for the frame. Separate from /api/ridgelines so a slow Overpass never delays the lines."""
    named = peaks.summits(bbox)
    if named is None:
        # Nothing is cached, so the next request retries the lookup
        return JSONResponse(
            {"summits": [], "error": "Summit names are unavailable right now"},
            headers={"Cache-Control": "no-store"},
        )
    try:
        placed = dem.locate_summits(bbox, named)  # grid is shared with /api/ridgelines for the same frame
    except urllib.error.URLError as e:
        raise tiles_unavailable(e)
    return JSONResponse({"summits": placed}, headers=CACHEABLE)
