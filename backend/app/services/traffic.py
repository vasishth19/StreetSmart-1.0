"""
Traffic layer for road vehicles (car / motorbike / emergency).

LIVE   : if TOMTOM_API_KEY is set, we sample TomTom's Flow Segment Data along the
         route (currentSpeed / freeFlowSpeed) -> real, current congestion.
ESTIMATED : otherwise we use a typical-day rush-hour curve. It is clearly labelled
         "estimated" everywhere (API + UI) — we never present a model as live data.

Colour code (same as Google Maps):  green = flowing, yellow = slow, red = heavy.
OpenStreetMap itself has NO live traffic; that is a property of the data source,
not a bug in the app. Live traffic needs a provider with probe data.
"""
from __future__ import annotations

import asyncio
import logging
import math
import time
from datetime import datetime
from typing import Dict, List, Optional, Tuple

import httpx

from app.config import settings

logger = logging.getLogger(__name__)

TRAFFIC_COLORS = {"free": "#22C55E", "moderate": "#FACC15", "heavy": "#EF4444"}
_cache: Dict[str, Tuple[float, Optional[float]]] = {}


def classify(ratio: float) -> str:
    if ratio >= 0.75:
        return "free"
    if ratio >= 0.5:
        return "moderate"
    return "heavy"


def rush_hour_index(local_dt: datetime) -> float:
    """0..1 typical congestion for an Indian city; peaks ~10:00 and ~18:30."""
    h = local_dt.hour + local_dt.minute / 60
    idx = (0.85 * math.exp(-((h - 10.0) / 1.4) ** 2)
           + 1.00 * math.exp(-((h - 18.5) / 1.7) ** 2)
           + (0.22 if 7 <= h <= 22 else 0.04))
    if local_dt.weekday() >= 5:
        idx *= 0.7
    return max(0.0, min(1.0, idx))


def estimated_ratio(local_dt: datetime, free_speed_kmh: float) -> float:
    """
    Slower inner-city roads (signals, mixed traffic) lose more speed in rush hour
    than fast arterials/highways. Heuristic, hence labelled "estimated".
    """
    idx = rush_hour_index(local_dt)
    sens = 1.0 if free_speed_kmh < 35 else 0.75 if free_speed_kmh < 60 else 0.45
    return max(0.25, 1.0 - 0.6 * idx * sens)


async def _tomtom_ratio(client: httpx.AsyncClient, lat: float, lng: float) -> Optional[float]:
    key = f"{lat:.3f},{lng:.3f}"
    hit = _cache.get(key)
    if hit and time.time() - hit[0] < 150:
        return hit[1]
    url = ("https://api.tomtom.com/traffic/services/4/flowSegmentData/absolute/10/json"
           f"?key={settings.TOMTOM_API_KEY}&point={lat:.5f},{lng:.5f}&unit=KMPH")
    ratio: Optional[float] = None
    try:
        r = await client.get(url)
        if r.status_code == 200:
            d = r.json().get("flowSegmentData", {})
            cur, free = float(d.get("currentSpeed", 0)), float(d.get("freeFlowSpeed", 0))
            if d.get("roadClosure"):
                ratio = 0.1
            elif free > 0:
                ratio = max(0.05, min(1.0, cur / free))
        else:
            logger.info("TomTom flow %s", r.status_code)
    except Exception as e:  # noqa: BLE001
        logger.info("TomTom flow failed: %s", e)
    _cache[key] = (time.time(), ratio)
    return ratio


async def live_ratios(points: List[Tuple[float, float]]) -> Optional[List[Optional[float]]]:
    """points are (lat, lng). Returns None if no key configured."""
    if not settings.TOMTOM_API_KEY:
        return None
    async with httpx.AsyncClient(timeout=6.0, headers={"User-Agent": settings.HTTP_USER_AGENT}) as client:
        return list(await asyncio.gather(*[_tomtom_ratio(client, la, lo) for la, lo in points]))
