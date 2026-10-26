"""
StreetSmart routing engine (v2) — REAL routes, REAL per-mode travel times,
REAL street-level data. No random numbers anywhere in this file.

Pipeline for one request:
  1. pick the travel mode (walking / wheelchair / cycling / motorbike / car / emergency)
  2. get real candidate routes on the OSM road+path network (Valhalla → OSRM fallback)
  3. in parallel: fetch OSM street data (lamps, lit roads, CCTV, surfaces...) and
     community reports / SOS clusters from Supabase
  4. (road vehicles) fetch live traffic (TomTom) or use the labelled estimate
  5. score every stretch with confidence, aggregate, compute mode-specific ETA
  6. rank, name, and return segments with drawable colours
"""
from __future__ import annotations

import asyncio
import logging
import uuid
from datetime import datetime, timedelta, timezone
from typing import Dict, List, Optional, Tuple

from app.config import settings
from app.models.route import (
    Coordinates, DataQuality, EtaBreakdown, RoutePreferences, RouteResult,
    RouteScores, RoutesResponse,
)
from app.services import community_signals, osm_client, traffic, weather
from app.services.mode_profiles import PROFILE_WEIGHTS, ModeSpec, resolve_mode
from app.services.road_router import RawRoute, RoutingError, fetch_candidates
from app.services.safety_model import Analysis, analyse_route, merge_segments
from app.utils.geo_local import bbox_of, resample, sunrise_sunset_utc_hours

logger = logging.getLogger(__name__)

COLOR_SAFEST, COLOR_FASTEST, COLOR_BALANCED, COLOR_ALT = "#00FF9C", "#FFB020", "#00E5FF", "#B388FF"
PRIORITY_COLORS = ["#FF3B3B", "#FFB020", "#3B82F6", "#B388FF"]


def local_time(departure: Optional[str]) -> datetime:
    """Local wall-clock time (naive) for the departure."""
    if departure:
        try:
            d = datetime.fromisoformat(departure.replace("Z", "+00:00"))
            if d.tzinfo is None:
                return d
            return (d.astimezone(timezone.utc) + timedelta(minutes=settings.LOCAL_UTC_OFFSET_MIN)).replace(tzinfo=None)
        except ValueError:
            pass
    return (datetime.now(timezone.utc) + timedelta(minutes=settings.LOCAL_UTC_OFFSET_MIN)).replace(tzinfo=None)


def is_dark(local_dt: datetime, lat: float, lng: float) -> bool:
    """Real sunrise/sunset (+20 min twilight each side), not a guessed hour."""
    sr, ss = sunrise_sunset_utc_hours(lat, lng, local_dt.timetuple().tm_yday)
    off = settings.LOCAL_UTC_OFFSET_MIN / 60.0
    h = local_dt.hour + local_dt.minute / 60.0
    sunrise_local, sunset_local = (sr + off) % 24, (ss + off) % 24
    return h < sunrise_local - 0.33 or h > sunset_local + 0.33


def _fmt_dur(m: float) -> str:
    m = int(round(m))
    return f"{m // 60}h {m % 60}m" if m >= 60 else f"{m} min"


def _weights(prefs: RoutePreferences, night: bool) -> Dict[str, float]:
    if prefs.use_profile_weights:
        w = dict(PROFILE_WEIGHTS.get(prefs.user_profile.value, PROFILE_WEIGHTS["general"]))
    else:
        w = {"safety": prefs.weight_safety, "lighting": prefs.weight_lighting,
             "crowd": prefs.weight_crowd, "accessibility": prefs.weight_accessibility}
    if not night:
        w["lighting"] *= 0.35          # lighting hardly matters in daylight
    tot = sum(w.values()) or 1.0
    return {k: v / tot for k, v in w.items()}


def _risk(overall: float) -> str:
    return "LOW" if overall >= 70 else "MEDIUM" if overall >= 50 else "HIGH"


def _instructions(raw: RawRoute, spec: ModeSpec, an: Analysis, name: str, night: bool) -> List[str]:
    out = [f"Starting {spec.label.lower()} navigation. {raw.distance_m/1000:.1f} kilometres, about {_fmt_dur(an.total_min)}."]
    for w in an.warnings[:1]:
        out.append(w.replace("🔦 ", "").replace("🚨 ", "Alert: ").replace("🌑 ", "").replace("⚠️ ", "Warning: "))
    acc = 0.0
    for m in raw.maneuvers:
        ins = (m.instruction or "").strip()
        if not ins:
            continue
        d = m.length_m
        if m is not raw.maneuvers[0] and ins.lower().startswith("continue") and d < 120:
            continue
        out.append(f"{ins} — then {int(d)} metres." if d >= 30 and m is not raw.maneuvers[-1] else ins)
        acc += d
        if len(out) >= 28:
            break
    if not out[-1].lower().startswith("you have arrived") and "arrive" not in out[-1].lower():
        out.append("You have arrived at your destination.")
    return out


class RoutingEngine:
    async def generate_routes(self, origin: Coordinates, destination: Coordinates,
                              preferences: RoutePreferences, time_of_day: str = "") -> RoutesResponse:
        profile = preferences.user_profile.value
        travel = preferences.travel_mode or {"walking": "walking", "cycling": "cycling", "driving": "car"}[
            preferences.transport_mode.value]
        spec = resolve_mode(travel, profile)
        local_dt = local_time(preferences.departure_time)
        night = is_dark(local_dt, origin.lat, origin.lng)

        # 1. live community incidents around the whole journey (accidents, closures, crowds, potholes...)
        trip_box = bbox_of([[origin.lng, origin.lat], [destination.lng, destination.lat]], 2500)
        (signals, comm_status), rain = await asyncio.gather(
            community_signals.load_signals(trip_box), weather.precipitation_mm(origin.lat, origin.lng))
        # waterlogging reports matter more while it is actually raining (Open-Meteo)
        if rain and rain > 0.3:
            for s in signals:
                if s.type == "flooding":
                    s.weight *= 1.0 + min(1.0, rain / 5.0)
        closures = [(s.lat, s.lng) for s in signals if community_signals.is_blocking(s)]

        # 2. candidate routes — verified closures are passed to the router as "avoid" points
        candidates = await fetch_candidates(spec, origin, destination, night, profile, avoid=closures)
        provider = candidates[0].provider

        # 3. OSM street data along every candidate
        osm_data, osm_status = await osm_client.fetch_corridor([r.coords for r in candidates])

        # ── traffic (road vehicles only) ─────────────────────────────
        traffic_source = "none"
        per_route_live: List[Optional[Tuple[List[float], List[Optional[float]]]]] = []
        if spec.kind == "motor":
            traffic_source = "estimated"
            any_live = False
            for r in candidates:
                step = max(600.0, r.distance_m / 12)
                samples = resample(r.coords, step)
                ratios = await traffic.live_ratios([(s["mid"][1], s["mid"][0]) for s in samples])
                if ratios is None:
                    per_route_live.append(None)
                    continue
                if sum(1 for x in ratios if x is not None) >= max(1, len(ratios) // 2):
                    any_live = True
                per_route_live.append(([(s["start_m"] + s["end_m"]) / 2 for s in samples], ratios))
            if any_live:
                traffic_source = "live"
        else:
            per_route_live = [None] * len(candidates)

        analyses: List[Tuple[RawRoute, Analysis]] = []
        for r, live in zip(candidates, per_route_live):
            fn = None
            if live is not None:
                mids, ratios = live

                def fn(chunks, mids=mids, ratios=ratios):  # noqa: E306
                    out = []
                    for c in chunks:
                        mid = (c.start_m + c.end_m) / 2
                        j = min(range(len(mids)), key=lambda k: abs(mids[k] - mid))
                        out.append(ratios[j])
                    return out
            analyses.append((r, analyse_route(r, osm_data, signals, spec, profile, local_dt, night, fn)))

        # HARD constraint: drop routes through a verified closure if any alternative is clear
        dropped = 0
        clear = [(r, a) for r, a in analyses if not a.blocked]
        if clear and len(clear) < len(analyses):
            dropped = len(analyses) - len(clear)
            analyses = clear

        weights = _weights(preferences, night)
        comp = []
        for r, an in analyses:
            comp.append(sum(weights[k] * an.scores[k] for k in weights))
        etas = [an.total_min for _, an in analyses]
        min_eta = max(1e-6, min(etas))
        comp_w, eta_w = (1.0, 0.45) if spec.kind in ("foot", "wheel") else (0.35, 1.0)
        bal = [comp_w * c - eta_w * (e / min_eta - 1) * 100 for c, e in zip(comp, etas)]
        order = sorted(range(len(analyses)), key=lambda i: -bal[i])[:3]
        fastest_i = min(range(len(analyses)), key=lambda i: etas[i])
        safest_i = max(range(len(analyses)), key=lambda i: comp[i])

        lc = sum(an.coverage["lighting"] for _, an in analyses) / len(analyses)
        notes: List[str] = []
        if dropped:
            notes.append(f"{dropped} route(s) removed because they pass through a verified road closure.")
        if closures and not clear:
            notes.append("A verified closure blocks every available route — check the warning on each route.")
        if rain and rain > 0.3:
            notes.append(f"It is raining now ({rain:.1f} mm) — waterlogging reports are weighted higher.")
        if osm_status in ("warming", "unavailable"):
            notes.append("OpenStreetMap street-data layer is not ready yet — safety scores are cautious estimates. Retry in a few seconds.")
        if comm_status != "ok":
            notes.append("Community-report database unreachable — community layer skipped.")
        if traffic_source == "estimated":
            notes.append("Traffic is an ESTIMATE from a typical rush-hour pattern. Add a TomTom key for live traffic.")
        if osm_status in ("ok", "cached") and lc < 30:
            notes.append(f"OpenStreetMap has lighting data for only ~{lc:.0f}% of this route — reports from users fill this gap.")

        results: List[RouteResult] = []
        for rank, i in enumerate(order, start=1):
            raw, an = analyses[i]
            tags = []
            if i == order[0]:
                tags.append("Recommended")
            if i == fastest_i:
                tags.append("Fastest")
            if i == safest_i:
                tags.append("Safest")
            if spec.priority:
                tags = ["Fastest corridor"] if rank == 1 else [f"Alternate corridor {rank - 1}"]
            name = " · ".join(tags) if tags else f"Alternative {rank - 1}"
            if spec.priority:
                color = PRIORITY_COLORS[rank - 1]
            elif "Safest" in tags:
                color = COLOR_SAFEST
            elif "Fastest" in tags:
                color = COLOR_FASTEST
            elif "Recommended" in tags:
                color = COLOR_BALANCED
            else:
                color = COLOR_ALT

            overall = max(0.0, min(99.0, comp[i]))
            scores = RouteScores(overall=round(overall, 1), safety=round(an.scores["safety"], 1),
                                 lighting=round(an.scores["lighting"], 1), crowd=round(an.scores["crowd"], 1),
                                 accessibility=round(an.scores["accessibility"], 1), risk_level=_risk(overall))
            total = an.total_min
            band = 0.08 if spec.kind in ("foot", "bike") else 0.12 if spec.kind == "wheel" else (0.12 if traffic_source == "live" else 0.25)
            if spec.kind == "foot" and spec.key != "walking":
                band = 0.12
            if spec.kind in ("foot", "wheel"):
                basis = f"{spec.speed_kmh:g} km/h {spec.label.lower()} pace × {raw.distance_m/1000:.1f} km, slower on rough surfaces, plus delays from reported obstacles"
            elif spec.kind == "bike":
                basis = f"{spec.speed_kmh:g} km/h cycling pace × {raw.distance_m/1000:.1f} km"
            else:
                basis = ("road speeds × " + ("LIVE traffic (TomTom)" if traffic_source == "live" else "estimated typical traffic for this hour")
                         + (", emergency-vehicle speed-up" if spec.priority else ""))
            eta = EtaBreakdown(mode=spec.key, mode_label=spec.label, speed_basis=basis,
                               moving_min=round(an.moving_min, 1), delay_min=round(an.delay_min, 1),
                               total_min=round(total, 1), traffic_source=traffic_source,
                               range_min=[round(total * (1 - band), 1), round(total * (1 + band), 1)])
            dq = DataQuality(
                osm_status=osm_status, community_status=comm_status, traffic_source=traffic_source,
                routing_provider=provider, lighting_coverage_pct=round(an.coverage["lighting"], 1),
                surface_coverage_pct=round(an.coverage["accessibility"], 1),
                safety_evidence_pct=round(an.coverage["safety"], 1),
                community_reports_used=an.reports_used, notes=notes)
            segs = merge_segments(an.chunks, spec)
            results.append(RouteResult(
                id=str(uuid.uuid4()), name=name,
                description=f"{raw.distance_m/1000:.1f} km · {_fmt_dur(total)} {spec.label.lower()}"
                            + (f" · {an.delay_min:.0f} min delay" if an.delay_min >= 2 else ""),
                coordinates=[[round(c[0], 6), round(c[1], 6)] for c in raw.coords],
                segments=segs, scores=scores,
                distance_km=round(raw.distance_m / 1000, 2), duration_min=round(total, 1),
                waypoints=[origin, destination],
                audio_instructions=_instructions(raw, spec, an, name, night),
                warnings=an.warnings, highlights=an.highlights, color=color, rank=rank,
                mode=spec.key, eta=eta, hazards=an.hazards, why=an.why,
                draw_style="dotted" if spec.kind in ("foot", "wheel") else "solid",
                data_quality=dq, is_night=night, blocked=an.blocked))

        # Explain WHY the recommended route is not simply the fastest one
        def _community(rr): return [h for h in rr.hazards if h.kind == "community"]
        fastest_r = min(results, key=lambda rr: rr.duration_min)
        rec = results[0]
        if rec is not fastest_r:
            extra = round(rec.duration_min - fastest_r.duration_min)
            fh, rh = _community(fastest_r), _community(rec)
            if len(fh) > len(rh) or fastest_r.blocked:
                kinds = sorted({h.type.replace("_", " ") for h in fh if h.report_id not in {x.report_id for x in rh}})
                rec.why.insert(0, f"Chosen over the faster route (+{max(extra, 0)} min) because that one passes "
                                  + ("a verified closure" if fastest_r.blocked else f"{len(fh) - len(rh)} more reported hazard(s)")
                                  + (f": {', '.join(kinds)}" if kinds else ""))
            else:
                rec.why.insert(0, f"Chosen over the faster route (+{max(extra, 0)} min) for a better safety / accessibility score")
        top_dq = results[0].data_quality
        return RoutesResponse(
            routes=results, origin=origin, destination=destination,
            recommended_route_id=results[0].id, total_routes=len(results),
            generated_at=datetime.utcnow().isoformat(), mode=spec.key, is_night=night, data_quality=top_dq)


routing_engine = RoutingEngine()
