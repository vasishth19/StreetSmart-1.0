"""
Real street-level data from OpenStreetMap via the Overpass API.

What we pull along a route corridor (all REAL, community-surveyed OSM data):
  * ways       : lit=yes/no, sidewalk, surface, smoothness, incline, wheelchair, steps
  * street lamps (highway=street_lamp)
  * CCTV cameras (man_made=surveillance)
  * police stations / hospitals (within ~600 m)
  * shops & amenities (a proxy for "eyes on the street" / footfall)
  * crossings & kerbs (lowered kerb / tactile paving)

HONESTY NOTE: OSM coverage in Indian cities is uneven. A missing `lit` tag does NOT
mean "dark"; it means "unknown". The scoring model therefore tracks CONFIDENCE and
the API reports how much of each route actually had data (data_quality.*_coverage).
Community reports are what fill the gaps.
"""
from __future__ import annotations

import asyncio
import hashlib
import json
import logging
import os
import time
from dataclasses import dataclass, field
from typing import Any, Dict, List, Optional, Sequence, Tuple

import httpx

from app.config import settings
from app.utils.geo_local import thin

logger = logging.getLogger(__name__)

_mem: Dict[str, Tuple[float, Dict[str, Any]]] = {}
_inflight: Dict[str, "asyncio.Task"] = {}


@dataclass
class OsmWay:
    id: int
    tags: Dict[str, str]
    geom: List[Tuple[float, float]]  # (lng, lat)


@dataclass
class OsmPoint:
    lng: float
    lat: float
    kind: str
    tags: Dict[str, str] = field(default_factory=dict)


@dataclass
class OsmData:
    ways: List[OsmWay] = field(default_factory=list)
    lamps: List[OsmPoint] = field(default_factory=list)
    cctv: List[OsmPoint] = field(default_factory=list)
    police: List[OsmPoint] = field(default_factory=list)
    hospitals: List[OsmPoint] = field(default_factory=list)
    pois: List[OsmPoint] = field(default_factory=list)
    crossings: List[OsmPoint] = field(default_factory=list)
    kerbs: List[OsmPoint] = field(default_factory=list)
    status: str = "ok"        # ok | cached


def _poly_str(coords: Sequence[Sequence[float]], max_points: int) -> str:
    pts = thin(coords, max_points)
    return ",".join(f"{p[1]:.5f},{p[0]:.5f}" for p in pts)


def build_query(routes_coords: List[List[List[float]]], timeout_s: int = 50) -> str:
    """One Overpass query covering every candidate route (union of corridors)."""
    parts = [f"[out:json][timeout:{timeout_s}];("]
    for coords in routes_coords:
        poly = _poly_str(coords, 140)
        parts.append(f'way(around:28,{poly})["highway"];')
    parts.append(");out tags geom;(")
    for coords in routes_coords:
        poly = _poly_str(coords, 140)
        parts += [
            f'node(around:40,{poly})["highway"="street_lamp"];',
            f'node(around:60,{poly})["man_made"="surveillance"];',
            f'node(around:30,{poly})["highway"="crossing"];',
            f'node(around:30,{poly})["barrier"="kerb"];',
            f'node(around:50,{poly})["highway"="bus_stop"];',
            f'nwr(around:60,{poly})["shop"];',
            f'nwr(around:60,{poly})["amenity"~"^(restaurant|cafe|fast_food|pharmacy|bank|atm|marketplace|place_of_worship|school|college|university|clinic|fuel|ice_cream|food_court)$"];',
        ]
        sparse = _poly_str(coords, 40)
        parts += [
            f'nwr(around:600,{sparse})["amenity"~"^(police|hospital)$"];',
        ]
    parts.append(");out center tags;")
    return "\n".join(parts)


def _cache_path(key: str) -> str:
    return os.path.join(settings.OSM_CACHE_DIR, f"{key}.json")


def _cache_get(key: str, allow_stale: bool = False) -> Optional[Dict[str, Any]]:
    ttl = settings.OSM_CACHE_TTL_HOURS * 3600
    hit = _mem.get(key)
    if hit and (allow_stale or time.time() - hit[0] < ttl):
        return hit[1]
    try:
        p = _cache_path(key)
        if os.path.exists(p) and (allow_stale or time.time() - os.path.getmtime(p) < ttl):
            with open(p) as f:
                data = json.load(f)
            _mem[key] = (os.path.getmtime(p), data)
            return data
    except Exception as e:  # noqa: BLE001
        logger.debug("cache read failed: %s", e)
    return None


def _cache_put(key: str, data: Dict[str, Any]) -> None:
    _mem[key] = (time.time(), data)
    try:
        os.makedirs(settings.OSM_CACHE_DIR, exist_ok=True)
        with open(_cache_path(key), "w") as f:
            json.dump(data, f)
    except Exception as e:  # noqa: BLE001
        logger.debug("cache write failed: %s", e)


async def _overpass_request(query: str) -> Dict[str, Any]:
    urls = [u.strip() for u in settings.OVERPASS_URLS.split(",") if u.strip()]
    last: Optional[Exception] = None
    async with httpx.AsyncClient(timeout=httpx.Timeout(70.0, connect=8.0)) as client:
        for url in urls:
            try:
                r = await client.post(url, data={"data": query}, headers={"User-Agent": settings.HTTP_USER_AGENT})
                if r.status_code == 200:
                    return r.json()
                last = RuntimeError(f"{url} -> {r.status_code}")
            except Exception as e:  # noqa: BLE001
                last = e
    raise RuntimeError(f"all Overpass endpoints failed: {last}")


def parse_overpass(raw: Dict[str, Any]) -> OsmData:
    out = OsmData()
    seen = set()
    for el in raw.get("elements", []):
        key = (el.get("type"), el.get("id"))
        if key in seen:
            continue
        seen.add(key)
        tags = el.get("tags", {}) or {}
        if el.get("type") == "way" and "geometry" in el and "highway" in tags:
            geom = [(g["lon"], g["lat"]) for g in el["geometry"]]
            if len(geom) >= 2:
                out.ways.append(OsmWay(el["id"], tags, geom))
            continue
        lat = el.get("lat", (el.get("center") or {}).get("lat"))
        lng = el.get("lon", (el.get("center") or {}).get("lon"))
        if lat is None or lng is None:
            continue
        if tags.get("highway") == "street_lamp":
            out.lamps.append(OsmPoint(lng, lat, "lamp", tags))
        elif tags.get("man_made") == "surveillance":
            out.cctv.append(OsmPoint(lng, lat, "cctv", tags))
        elif tags.get("highway") == "crossing":
            out.crossings.append(OsmPoint(lng, lat, "crossing", tags))
        elif tags.get("barrier") == "kerb":
            out.kerbs.append(OsmPoint(lng, lat, "kerb", tags))
        elif tags.get("amenity") == "police":
            out.police.append(OsmPoint(lng, lat, "police", tags))
        elif tags.get("amenity") == "hospital":
            out.hospitals.append(OsmPoint(lng, lat, "hospital", tags))
        elif tags.get("highway") == "bus_stop" or "shop" in tags or "amenity" in tags:
            out.pois.append(OsmPoint(lng, lat, "poi", tags))
    return out


async def fetch_corridor(routes_coords: List[List[List[float]]], wait_s: float = 22.0) -> Tuple[Optional[OsmData], str]:
    """
    Returns (data, status). status: ok | cached | warming | unavailable.
    If Overpass is slow we return quickly with status 'warming' and let the fetch
    finish in the background — the NEXT request for the same corridor is instant.
    """
    query = build_query(routes_coords)
    key = hashlib.sha1(query.encode()).hexdigest()[:20]

    cached = _cache_get(key)
    if cached is not None:
        d = parse_overpass(cached)
        d.status = "cached"
        return d, "cached"

    task = _inflight.get(key)
    if task is None or task.done():
        async def _job():
            try:
                raw = await _overpass_request(query)
                _cache_put(key, raw)
                return raw
            finally:
                _inflight.pop(key, None)
        task = asyncio.create_task(_job())
        _inflight[key] = task

    try:
        raw = await asyncio.wait_for(asyncio.shield(task), timeout=wait_s)
        d = parse_overpass(raw)
        return d, "ok"
    except asyncio.TimeoutError:
        stale = _cache_get(key, allow_stale=True)
        if stale is not None:
            d = parse_overpass(stale)
            d.status = "cached"
            return d, "cached"
        return None, "warming"
    except Exception as e:  # noqa: BLE001
        logger.warning("Overpass failed: %s", e)
        stale = _cache_get(key, allow_stale=True)
        if stale is not None:
            d = parse_overpass(stale)
            d.status = "cached"
            return d, "cached"
        return None, "unavailable"
