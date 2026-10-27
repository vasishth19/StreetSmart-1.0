"""
Real road/path routing on OpenStreetMap data.

Primary : Valhalla (valhalla1.openstreetmap.de) — has true pedestrian, wheelchair,
          bicycle, motorcycle and car costing, a `use_lit` preference for lit
          streets, and gives named turn-by-turn manoeuvres.
Fallback: OSRM via FOSSGIS `routed-foot / routed-bike / routed-car`.

IMPORTANT BUG THIS REPLACES: the public OSRM demo (router.project-osrm.org) ignores
the profile in the URL and always answers with CAR routes — that is why walking,
wheelchair and car all showed the same 11 km / same time before.
"""
from __future__ import annotations

import asyncio
import logging
import time
from dataclasses import dataclass, field
from typing import Any, Dict, List, Optional

import httpx
from shapely.geometry import LineString

from app.config import settings
from app.models.route import Coordinates
from app.services.mode_profiles import ModeSpec
from app.utils.geo_local import LocalXY, decode_polyline, polyline_length_m

logger = logging.getLogger(__name__)


@dataclass
class Maneuver:
    coords: List[List[float]]
    length_m: float
    time_s: float
    instruction: str = ""
    street: str = ""
    kind: str = ""


@dataclass
class RawRoute:
    coords: List[List[float]]          # [[lng, lat], ...]
    distance_m: float
    duration_s: float                  # provider's own duration (free-flow / nominal speed)
    maneuvers: List[Maneuver]
    provider: str
    variant: str = "default"


class RoutingError(Exception):
    pass


# ── polite pacing for the free community servers (policy: ≤ 1 request / second) ──
_last_call: Dict[str, float] = {}
_pace_lock = asyncio.Lock()


async def _pace(host: str, min_interval: float = 0.8):
    async with _pace_lock:
        wait = _last_call.get(host, 0) + min_interval - time.monotonic()
        if wait > 0:
            await asyncio.sleep(wait)
        _last_call[host] = time.monotonic()


def _headers() -> Dict[str, str]:
    return {"User-Agent": settings.HTTP_USER_AGENT, "Accept": "application/json"}


# ───────────────────────────── Valhalla ─────────────────────────────
def _valhalla_costing_options(spec: ModeSpec, variant: str, night: bool, profile: str) -> Dict[str, Any]:
    if spec.valhalla_costing == "pedestrian":
        opts: Dict[str, Any] = {"walking_speed": spec.speed_kmh}
        if spec.kind == "wheel":
            opts["type"] = "wheelchair"
        if spec.key in ("walking_elderly", "walking_low_vision"):
            opts["step_penalty"] = 120
        if variant == "safest":
            opts.update({"use_lit": 1.0, "alley_factor": 6.0, "sidewalk_factor": 0.6, "use_living_streets": 0.4})
        elif variant == "balanced":
            opts.update({"use_lit": 0.5 if night else 0.2, "alley_factor": 3.0})
        elif variant == "shortest":
            opts["shortest"] = True
        return {"pedestrian": opts}
    if spec.valhalla_costing == "bicycle":
        opts = {"cycling_speed": spec.speed_kmh, "bicycle_type": "Hybrid"}
        if variant == "safest":
            opts["use_roads"] = 0.1
        elif variant == "balanced":
            opts["use_roads"] = 0.4
        elif variant == "shortest":
            opts["shortest"] = True
        return {"bicycle": opts}
    if spec.valhalla_costing == "motorcycle":
        opts = {}
        if variant == "shortest":
            opts["shortest"] = True
        return {"motorcycle": opts}
    opts = {}
    if variant == "shortest":
        opts["shortest"] = True
    return {"auto": opts}


def _parse_valhalla_trip(trip: Dict[str, Any], variant: str) -> RawRoute:
    leg_coords: List[List[float]] = []
    maneuvers: List[Maneuver] = []
    for leg in trip.get("legs", []):
        shape = decode_polyline(leg["shape"], 6)
        offset = len(leg_coords)
        leg_coords.extend(shape if offset == 0 else shape[1:])
        for m in leg.get("maneuvers", []):
            b, e = int(m.get("begin_shape_index", 0)), int(m.get("end_shape_index", 0))
            seg = shape[b:e + 1] if e >= b else shape[b:b + 1]
            if len(seg) < 2:
                continue
            maneuvers.append(Maneuver(
                coords=seg,
                length_m=float(m.get("length", 0)) * 1000.0,
                time_s=float(m.get("time", 0)),
                instruction=m.get("instruction", ""),
                street=", ".join(m.get("street_names", [])[:1]) if m.get("street_names") else "",
                kind=str(m.get("type", "")),
            ))
    summ = trip.get("summary", {})
    dist_m = float(summ.get("length", 0)) * 1000.0 or polyline_length_m(leg_coords)
    return RawRoute(leg_coords, dist_m, float(summ.get("time", 0)), maneuvers, "valhalla", variant)


async def _valhalla(client: httpx.AsyncClient, spec: ModeSpec, o: Coordinates, d: Coordinates,
                    variant: str, alternates: int, night: bool, profile: str,
                    avoid: Optional[List[tuple]] = None) -> List[RawRoute]:
    body = {
        "locations": [{"lat": o.lat, "lon": o.lng}, {"lat": d.lat, "lon": d.lng}],
        "costing": spec.valhalla_costing,
        "costing_options": _valhalla_costing_options(spec, variant, night, profile),
        "directions_options": {"units": "kilometers", "language": "en-US"},
    }
    if alternates:
        body["alternates"] = alternates
    if avoid:                      # verified road closures: ask Valhalla to route around them
        body["exclude_locations"] = [{"lat": a, "lon": b} for a, b in avoid[:20]]
    url = settings.VALHALLA_URL.rstrip("/") + "/route"
    await _pace(settings.VALHALLA_URL)
    r = await client.post(url, json=body, headers=_headers())
    if r.status_code == 400 and avoid:           # server refused exclude_locations -> retry plain
        body.pop("exclude_locations", None)
        await _pace(settings.VALHALLA_URL)
        r = await client.post(url, json=body, headers=_headers())
    if r.status_code == 400 and spec.valhalla_costing == "motorcycle":
        # some Valhalla builds don't ship motorcycle costing -> use auto
        body["costing"] = "auto"
        body["costing_options"] = {"auto": body["costing_options"].get("motorcycle", {})}
        await _pace(settings.VALHALLA_URL)
        r = await client.post(url, json=body, headers=_headers())
    if r.status_code != 200:
        raise RoutingError(f"valhalla {r.status_code}: {r.text[:160]}")
    data = r.json()
    trips = [data["trip"]] + [a["trip"] for a in data.get("alternates", []) if "trip" in a]
    return [_parse_valhalla_trip(t, variant if i == 0 else f"{variant}-alt{i}") for i, t in enumerate(trips)]


# ───────────────────────────── OSRM (FOSSGIS) ─────────────────────────────
def _osrm_instruction(step: Dict[str, Any]) -> str:
    m = step.get("maneuver", {})
    t, mod, name = m.get("type", ""), m.get("modifier", ""), step.get("name", "")
    on = f" onto {name}" if name else ""
    if t == "depart":
        return f"Head {mod or 'ahead'}{(' on ' + name) if name else ''}"
    if t == "arrive":
        return "You have arrived at your destination"
    if t in ("turn", "end of road", "fork", "on ramp", "off ramp"):
        return f"Turn {mod}{on}" if mod else f"Continue{on}"
    if t == "roundabout" or t == "rotary":
        return f"Take the roundabout{on}"
    return f"Continue{on}"


def _parse_osrm_route(rt: Dict[str, Any], variant: str) -> RawRoute:
    coords = [[c[0], c[1]] for c in rt["geometry"]["coordinates"]]
    maneuvers: List[Maneuver] = []
    for leg in rt.get("legs", []):
        for st in leg.get("steps", []):
            g = st.get("geometry", {}).get("coordinates", [])
            if len(g) < 2:
                continue
            maneuvers.append(Maneuver(
                coords=[[c[0], c[1]] for c in g],
                length_m=float(st.get("distance", 0)),
                time_s=float(st.get("duration", 0)),
                instruction=_osrm_instruction(st),
                street=st.get("name", ""),
                kind=st.get("maneuver", {}).get("type", ""),
            ))
    return RawRoute(coords, float(rt["distance"]), float(rt["duration"]), maneuvers, "osrm-fossgis", variant)


async def _osrm(client: httpx.AsyncClient, spec: ModeSpec, o: Coordinates, d: Coordinates,
                variant: str, alternates: int) -> List[RawRoute]:
    base = settings.OSRM_URL.rstrip("/")
    # NOTE: the path prefix routed-foot / routed-bike / routed-car is what actually
    # selects the profile on the FOSSGIS server; the 'driving' segment is cosmetic.
    url = (f"{base}/routed-{spec.osrm_profile}/route/v1/driving/"
           f"{o.lng},{o.lat};{d.lng},{d.lat}")
    params = {"overview": "full", "geometries": "geojson", "steps": "true",
              "alternatives": "true" if alternates else "false"}
    await _pace(settings.OSRM_URL)
    r = await client.get(url, params=params, headers=_headers())
    if r.status_code != 200:
        raise RoutingError(f"osrm {r.status_code}: {r.text[:160]}")
    data = r.json()
    if data.get("code") != "Ok" or not data.get("routes"):
        raise RoutingError(f"osrm: {data.get('code')} {data.get('message', '')}")
    return [_parse_osrm_route(rt, variant if i == 0 else f"{variant}-alt{i}") for i, rt in enumerate(data["routes"])]


# ───────────────────────────── public API ─────────────────────────────
def variants_for(spec: ModeSpec) -> List[tuple]:
    """(variant name, alternates) requests to make for each mode kind."""
    if spec.priority:
        return [("default", 2)]
    if spec.kind in ("foot", "wheel", "bike"):
        return [("safest", 1), ("balanced", 1), ("shortest", 0)]
    return [("default", 2), ("shortest", 0)]


def _dedupe(routes: List[RawRoute], overlap_threshold: float = 0.92) -> List[RawRoute]:
    """Drop near-identical geometries (≥92 % of one lies within 30 m of the other)."""
    kept: List[RawRoute] = []
    for r in routes:
        if len(r.coords) < 2:
            continue
        lat0 = r.coords[0][1]
        proj = LocalXY(lat0, r.coords[0][0])
        ls = LineString(proj.many(r.coords))
        dup = False
        for k in kept:
            kproj = LocalXY(lat0, r.coords[0][0])
            kls = LineString(kproj.many(k.coords))
            n = 40
            near = sum(1 for i in range(n + 1)
                       if kls.distance(ls.interpolate(i / n, normalized=True)) < 30)
            if near / (n + 1) >= overlap_threshold:
                dup = True
                break
        if not dup:
            kept.append(r)
    return kept


async def fetch_candidates(spec: ModeSpec, origin: Coordinates, dest: Coordinates,
                           night: bool, profile: str, client: Optional[httpx.AsyncClient] = None,
                           avoid: Optional[List[tuple]] = None) -> List[RawRoute]:
    own = client is None
    client = client or httpx.AsyncClient(timeout=httpx.Timeout(25.0, connect=8.0))
    try:
        out: List[RawRoute] = []
        errors: List[str] = []
        for variant, alts in variants_for(spec):
            got: List[RawRoute] = []
            try:
                got = await _valhalla(client, spec, origin, dest, variant, alts, night, profile, avoid)
            except Exception as e:  # noqa: BLE001
                errors.append(f"valhalla[{variant}]: {e}")
                try:
                    got = await _osrm(client, spec, origin, dest, variant, alts)
                except Exception as e2:  # noqa: BLE001
                    errors.append(f"osrm[{variant}]: {e2}")
            out.extend(got)
        if not out:
            raise RoutingError("; ".join(errors) or "no route found")
        if errors:
            logger.warning("routing partial failures: %s", errors)
        return _dedupe(out, 0.85)[:5]
    finally:
        if own:
            await client.aclose()
