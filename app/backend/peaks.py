"""Named summits from OpenStreetMap via the Overpass API (best effort: failures return no labels)."""
import json
import math
import os
import re
import time
import urllib.error
import urllib.parse
import urllib.request

from cache import SharedCache

OVERPASS_URL = os.environ.get("OVERPASS_URL", "https://overpass-api.de/api/interpreter")
NOMINATIM_URL = os.environ.get("NOMINATIM_URL", "https://nominatim.openstreetmap.org/search")
USER_AGENT = "ridgeline-studio/0.1 (prototype)"
PEAK_TYPES = {"peak", "volcano"}  # OSM natural= values worth offering as a "mountain" search result

_cache = SharedCache(maxsize=512)  # (bbox, limit) -> summits; failed lookups raise and aren't cached
_search_cache = SharedCache(maxsize=256)  # (query, limit) -> search results


def parse_ele(value):
    """OSM `ele` tags are messy: "3798", "3798 m", "3.798" (German thousands separator)."""
    match = re.match(r"\s*(-?\d+)(?:[.,](\d+))?", value or "")
    if not match:
        return None
    whole, fraction = match.groups()
    if fraction and len(fraction) == 3 and abs(int(whole)) < 10:
        return int(whole + fraction)
    return round(float(f"{whole}.{fraction or 0}"))


def _query_overpass(request, attempts=2):
    """POST a query; the public instance often answers 429/5xx when busy and succeeds right after."""
    for attempt in range(attempts):
        try:
            # Can take ~8 s even for a small frame; summits never block the lines, so wait generously
            with urllib.request.urlopen(request, timeout=30) as response:
                return json.load(response)["elements"]
        except urllib.error.HTTPError as e:
            if e.code not in (429, 502, 503, 504) or attempt == attempts - 1:
                raise
            time.sleep(1)


def summits(bbox, limit=6):
    """The highest named peaks in bbox, spread out so labels don't pile up. Returns None if the lookup fails."""
    try:
        return _cache.get((bbox, limit), lambda: _lookup(bbox, limit))
    except Exception:
        return None


def _lookup(bbox, limit):
    west, south, east, north = bbox
    query = f'[out:json][timeout:25];node["natural"="peak"]["name"]["ele"]({south},{west},{north},{east});out body;'
    request = urllib.request.Request(
        OVERPASS_URL,
        data=urllib.parse.urlencode({"data": query}).encode(),
        headers={"User-Agent": USER_AGENT},
    )
    elements = _query_overpass(request)

    candidates = []
    for el in elements:
        ele = parse_ele(el["tags"].get("ele"))
        if ele is not None:
            candidates.append({"name": el["tags"]["name"], "ele": ele, "lat": el["lat"], "lon": el["lon"]})
    candidates.sort(key=lambda p: -p["ele"])

    # Greedy: highest first, skipping summits closer than 15% of the frame diagonal to one already chosen
    cos_lat = math.cos(math.radians((south + north) / 2))
    min_distance = 0.15 * math.hypot((east - west) * cos_lat, north - south)
    chosen = []
    for p in candidates:
        if all(math.hypot((p["lon"] - q["lon"]) * cos_lat, p["lat"] - q["lat"]) >= min_distance for q in chosen):
            chosen.append(p)
            if len(chosen) == limit:
                break

    return tuple(chosen)


def search_peaks(query, limit=8):
    """Free-text mountain search via Nominatim (OSM's geocoder), for the search bar's autocomplete.

    Returns None if the lookup fails so the caller can distinguish "no results" from "unavailable".
    """
    query = query.strip()
    if not query:
        return ()
    try:
        return _search_cache.get((query.lower(), limit), lambda: _search(query, limit))
    except Exception:
        return None


def _search(query, limit):
    params = {
        "q": query,
        "format": "jsonv2",
        "addressdetails": 1,
        "extratags": 1,
        "namedetails": 1,
        "accept-language": "en",  # otherwise country/address names come back in the local language
        "limit": 20,  # over-fetch: most matches for a free-text query aren't peaks, filtered out below
    }
    request = urllib.request.Request(
        f"{NOMINATIM_URL}?{urllib.parse.urlencode(params)}",
        headers={"User-Agent": USER_AGENT},
    )
    with urllib.request.urlopen(request, timeout=10) as response:
        elements = json.load(response)

    results = []
    for el in elements:
        # jsonv2 calls the OSM primary tag "category"; older Nominatim responses call it "class"
        if el.get("category", el.get("class")) != "natural" or el.get("type") not in PEAK_TYPES:
            continue
        name = (el.get("namedetails") or {}).get("name") or el["display_name"].split(",")[0]
        results.append({
            "name": name,
            "lat": float(el["lat"]),
            "lon": float(el["lon"]),
            "elevation": parse_ele((el.get("extratags") or {}).get("ele")),
            "country": (el.get("address") or {}).get("country"),
        })
        if len(results) == limit:
            break
    return tuple(results)
