"""Open-Meteo rain intensity (free, no key). Used to link waterlogging reports to real rain."""
import time
from typing import Optional, Tuple
import httpx

_cache: dict = {}


async def precipitation_mm(lat: float, lng: float) -> Optional[float]:
    key = f"{lat:.1f},{lng:.1f}"
    hit = _cache.get(key)
    if hit and time.time() - hit[0] < 600:
        return hit[1]
    val: Optional[float] = None
    try:
        async with httpx.AsyncClient(timeout=4.0) as c:
            r = await c.get("https://api.open-meteo.com/v1/forecast",
                            params={"latitude": lat, "longitude": lng, "current": "precipitation"})
            if r.status_code == 200:
                val = float(r.json().get("current", {}).get("precipitation", 0) or 0)
    except Exception:  # noqa: BLE001
        val = None
    _cache[key] = (time.time(), val)
    return val
