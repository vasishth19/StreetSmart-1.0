"""
Community signals = the part Google Maps does not have.

Two sources, both from YOUR Supabase database:
  * reports     (lighting, broken sidewalk, pothole, harassment, ...)
  * sos_alerts  (anonymised: only used as area-level risk, never shown per person)

HOW A REPORT BECOMES TRUSTED (no admin bottleneck)
--------------------------------------------------
  new anonymous report ................ trust 0.35  (already nudges routing a little)
  + each "still there" confirmation ... +0.12  (up to 4 counted)
  + each "it's fixed" denial .......... -0.15
  admin-approved OR 3 distinct nearby
  users confirmed ..................... trust 0.90+  (counts as verified)
  rejected / resolved ................. trust 0     (ignored)
Trust is then multiplied by an age decay (half-life depends on the issue: flooding
lasts days, a missing ramp lasts a year) which is RESET every time somebody confirms
it. So stale reports fade out on their own and nobody has to babysit the data.
"""
from __future__ import annotations

import asyncio
import logging
import math
import time
from dataclasses import dataclass
from datetime import datetime, timezone
from typing import Any, Dict, List, Optional, Tuple

logger = logging.getLogger(__name__)

# How long a report stays relevant WITHOUT being re-confirmed (half-life, days).
# Transient events fade in hours; physical defects persist until someone confirms a repair.
HALF_LIFE_DAYS = {
    "accident": 0.25, "crowd": 0.15, "road_blocked": 2, "flooding": 3, "obstruction": 14,
    "construction": 30, "harassment": 45, "unsafe_area": 60,
    "poor_lighting": 180, "pothole": 365, "broken_sidewalk": 180, "missing_ramp": 365, "other": 30,
}
SEVERITY_MULT = {"low": 0.5, "medium": 1.0, "high": 1.6, "critical": 2.2}
SECURITY_TYPES = {"unsafe_area", "harassment"}
ACCESS_TYPES = {"broken_sidewalk", "missing_ramp", "obstruction", "flooding", "construction", "pothole"}
LIGHT_TYPES = {"poor_lighting"}
CROWD_TYPES = {"crowd"}
INCIDENT_TYPES = {"accident"}
BLOCK_TYPES = {"road_blocked"}


@dataclass
class Signal:
    id: str
    lat: float
    lng: float
    type: str
    severity: str
    weight: float          # trust × decay × severity (0..~2.2)
    trust: float
    age_days: float
    verified: bool
    source: str = "report"  # report | sos
    simulated: bool = False


def _parse_ts(v: Any) -> Optional[datetime]:
    if not v:
        return None
    try:
        s = str(v).replace("Z", "+00:00")
        d = datetime.fromisoformat(s)
        return d if d.tzinfo else d.replace(tzinfo=timezone.utc)
    except Exception:  # noqa: BLE001
        return None


def report_trust(r: Dict[str, Any]) -> float:
    status = (r.get("status") or "reported").lower()
    if status in ("rejected", "resolved", "duplicate", "fixed"):
        return 0.0
    conf = int(r.get("confirmations") or 0)
    votes = int(r.get("votes") or 0)
    den = int(r.get("denials") or 0)
    t = 0.35 + 0.12 * min(conf + votes, 4) - 0.15 * den
    photos = r.get("photo_urls") or []
    if photos:
        t += 0.1                      # photo evidence is corroboration (never required)
    if status == "approved" or r.get("verified"):
        t = max(t, 0.9)
    return max(0.05, min(1.0, t))


def is_blocking(s: "Signal") -> bool:
    """
    HARD constraint: a road is treated as impassable only when the report is credible
    (trust >= 0.6, i.e. verified or corroborated) and is a closure, a critical accident
    or critical flooding. Unverified reports are shown but never close a road.
    """
    if s.source != "report" or s.trust < 0.6:
        return False
    return s.type in BLOCK_TYPES or (s.type in ("accident", "flooding") and s.severity == "critical")


def to_signal(r: Dict[str, Any], now: Optional[datetime] = None) -> Optional[Signal]:
    try:
        lat, lng = float(r["lat"]), float(r["lng"])
    except Exception:  # noqa: BLE001
        return None
    now = now or datetime.now(timezone.utc)
    trust = report_trust(r)
    if trust <= 0:
        return None
    typ = (r.get("issue_type") or "other").lower()
    ref = _parse_ts(r.get("last_confirmed_at")) or _parse_ts(r.get("created_at")) or now
    age = max(0.0, (now - ref).total_seconds() / 86400.0)
    exp = _parse_ts(r.get("expires_at"))
    if exp and exp < now:
        return None
    hl = HALF_LIFE_DAYS.get(typ, 30)
    decay = 0.5 ** (age / hl)
    if decay < 0.05:
        return None
    sev = SEVERITY_MULT.get((r.get("severity") or "medium").lower(), 1.0)
    return Signal(str(r.get("id", "")), lat, lng, typ, (r.get("severity") or "medium").lower(),
                  trust * decay * sev, trust, age, trust >= 0.85, "report", bool(r.get("is_simulated")))


def sos_signal(r: Dict[str, Any], now: Optional[datetime] = None) -> Optional[Signal]:
    status = (r.get("status") or "active").lower()
    if status in ("false_alarm", "test", "resolved_safe"):
        return None
    try:
        lat, lng = float(r["lat"]), float(r["lng"])
    except Exception:  # noqa: BLE001
        return None
    now = now or datetime.now(timezone.utc)
    ts = _parse_ts(r.get("created_at")) or now
    age = max(0.0, (now - ts).total_seconds() / 86400.0)
    w = 0.35 * (0.5 ** (age / 60.0))     # a single SOS can be accidental -> low weight; clusters add up
    if w < 0.02:
        return None
    return Signal("", lat, lng, "sos", "high", w, 0.5, age, False, "sos")


# ── tiny TTL cache so a burst of route requests doesn't hammer Supabase ──
_cache: Dict[str, Tuple[float, List[Signal]]] = {}


def _fetch_sync(bbox: Tuple[float, float, float, float]) -> Tuple[List[Dict], List[Dict]]:
    from app.services.supabase_client import supabase  # lazy: needs env vars
    min_lat, min_lng, max_lat, max_lng = bbox
    reps = (supabase.table("reports").select("*")
            .gte("lat", min_lat).lte("lat", max_lat).gte("lng", min_lng).lte("lng", max_lng)
            .limit(1500).execute().data) or []
    try:
        sos = (supabase.table("sos_alerts").select("lat,lng,status,created_at")
               .gte("lat", min_lat).lte("lat", max_lat).gte("lng", min_lng).lte("lng", max_lng)
               .limit(1500).execute().data) or []
    except Exception as e:  # noqa: BLE001
        logger.info("sos_alerts unavailable: %s", e)
        sos = []
    return reps, sos


async def load_signals(bbox: Tuple[float, float, float, float]) -> Tuple[List[Signal], str]:
    key = ",".join(f"{v:.3f}" for v in bbox)
    hit = _cache.get(key)
    if hit and time.time() - hit[0] < 45:
        return hit[1], "ok"
    try:
        reps, sos = await asyncio.to_thread(_fetch_sync, bbox)
    except Exception as e:  # noqa: BLE001
        logger.warning("community signals unavailable: %s", e)
        return [], "unavailable"
    now = datetime.now(timezone.utc)
    out = [s for s in (to_signal(r, now) for r in reps) if s]
    out += [s for s in (sos_signal(r, now) for r in sos) if s]
    _cache[key] = (time.time(), out)
    return out, "ok"
