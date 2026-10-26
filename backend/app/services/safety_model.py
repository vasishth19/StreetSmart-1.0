"""
Evidence-based route analysis — replaces the old random-number scoring.

Every score is computed from facts about THIS route:
  lighting      OSM lit=yes/no, mapped street lamps, community "poor lighting" reports
  safety        police/CCTV/hospital proximity, street activity (shops, bus stops),
                community harassment/unsafe-area reports, anonymised SOS clusters,
                time-of-day (real sunset/sunrise)
  accessibility OSM surface / smoothness / sidewalk / steps / kerbs / wheelchair tags,
                community broken-sidewalk / missing-ramp / pothole / obstruction reports
  crowd         "eyes on the street": shops, amenities, bus stops per stretch

Each stretch gets a (score, confidence). Where OSM and the community say nothing the
confidence is low and the score shrinks toward a neutral prior — we never invent
"good" or "bad" from thin air, and we tell the user how much data backed the result.
"""
from __future__ import annotations

import math
from dataclasses import dataclass, field
from datetime import datetime
from typing import Any, Dict, List, Optional, Sequence, Set, Tuple

import numpy as np
from shapely.geometry import LineString, Point
from shapely.strtree import STRtree

from app.config import settings
from app.models.route import Hazard
from app.services import community_signals as cs
from app.services.mode_profiles import ModeSpec, time_multiplier
from app.services.osm_client import OsmData
from app.services.road_router import RawRoute
from app.services.traffic import TRAFFIC_COLORS, classify, estimated_ratio
from app.utils.geo_local import LocalXY, resample

PRIOR = 55.0
CHUNK_M = 80.0
FOOT_HW = {"footway", "pedestrian", "path", "steps", "corridor", "living_street", "track", "cycleway"}
ROAD_HW_BUSY = {"primary", "trunk", "secondary", "motorway", "primary_link", "trunk_link", "secondary_link"}
GOOD_SURF = {"asphalt", "concrete", "paved", "paving_stones", "concrete:plates", "concrete:lanes", "sett", "metal", "wood", "tartan"}
BAD_SURF = {"unpaved", "gravel", "dirt", "sand", "ground", "grass", "mud", "earth", "pebblestone", "fine_gravel", "compacted", "cobblestone", "unhewn_cobblestone", "rock"}
SMOOTH_GOOD = {"excellent", "good"}
SMOOTH_BAD = {"bad", "very_bad", "horrible", "very_horrible", "impassable"}
LIT_YES = {"yes", "24/7", "automatic", "sunset-sunrise", "limited", "interval", "street"}
LIT_NO = {"no", "disused"}
QUALITY_COLORS = {"good": "#00FF9C", "fair": "#FFB020", "poor": "#FF3B3B", "unknown": "#7DD3FC"}


@dataclass
class Chunk:
    coords: List[List[float]]
    start_m: float
    end_m: float
    length_m: float
    mid: Tuple[float, float]
    street: str = ""
    ff_speed_ms: float = 0.0
    # evidence
    lit: Optional[bool] = None
    surface: str = "unknown"
    smoothness: str = ""
    highway: str = ""
    # (score, confidence)
    lighting: Tuple[float, float] = (PRIOR, 0.0)
    safety: Tuple[float, float] = (PRIOR, 0.0)
    access: Tuple[float, float] = (PRIOR, 0.0)
    crowd: Tuple[float, float] = (PRIOR, 0.0)
    cctv_n: int = 0
    steps: bool = False
    issues: List[str] = field(default_factory=list)
    traffic_ratio: Optional[float] = None
    time_s: float = 0.0
    delay_s: float = 0.0
    badness: float = 0.0   # 0..1 surface/obstacle severity for slowdown
    crowd_w: float = 0.0   # reported crowd / gathering weight
    incident_w: float = 0.0  # reported accident weight
    blocked: bool = False
    overall: float = PRIOR


@dataclass
class Analysis:
    chunks: List[Chunk]
    scores: Dict[str, float]
    coverage: Dict[str, float]
    hazards: List[Hazard]
    moving_min: float
    delay_min: float
    total_min: float
    why: List[str]
    warnings: List[str]
    highlights: List[str]
    reports_used: int
    blocked: bool = False


def _clip(v: float, lo: float = 3.0, hi: float = 98.0) -> float:
    return max(lo, min(hi, v))


def _blend(sc: Tuple[float, float]) -> float:
    s, c = sc
    return c * s + (1 - c) * PRIOR


def _seg_dist(xy: np.ndarray, a: Tuple[float, float], b: Tuple[float, float]) -> np.ndarray:
    """Distance from many points to the straight segment a-b (local metres)."""
    ax, ay = a
    bx, by = b
    dx, dy = bx - ax, by - ay
    L2 = dx * dx + dy * dy
    if L2 < 1e-9:
        return np.hypot(xy[:, 0] - ax, xy[:, 1] - ay)
    t = np.clip(((xy[:, 0] - ax) * dx + (xy[:, 1] - ay) * dy) / L2, 0.0, 1.0)
    return np.hypot(xy[:, 0] - (ax + t * dx), xy[:, 1] - (ay + t * dy))


class _Idx:
    """
    numpy helpers for radius counts measured to the STRETCH of road (not just its
    midpoint) so something 25 m off the road is never missed by falling between
    two midpoints.
    """
    def __init__(self, proj: LocalXY, pts):
        self.xy = np.array([proj.to_xy(p.lng, p.lat) for p in pts]) if pts else np.zeros((0, 2))
        self.pts = pts

    def within(self, seg, r: float) -> List[int]:
        if not len(self.xy):
            return []
        return list(np.nonzero(_seg_dist(self.xy, *seg) <= r)[0])

    def nearest_m(self, seg) -> Optional[float]:
        if not len(self.xy):
            return None
        return float(np.min(_seg_dist(self.xy, *seg)))


def _assign_maneuvers(chunks: List[Chunk], raw: RawRoute) -> None:
    total = chunks[-1].end_m if chunks else 0
    mans = [m for m in raw.maneuvers if m.length_m > 0]
    msum = sum(m.length_m for m in mans) or 1.0
    scale = total / msum
    ranges, acc = [], 0.0
    for m in mans:
        ranges.append((acc, acc + m.length_m * scale, m))
        acc += m.length_m * scale
    for c in chunks:
        mid = (c.start_m + c.end_m) / 2
        for a, b, m in ranges:
            if a <= mid <= b + 1e-6:
                c.street = m.street
                c.ff_speed_ms = (m.length_m / m.time_s) if m.time_s > 0 else 0.0
                break
        if c.ff_speed_ms <= 0 and raw.duration_s > 0:
            c.ff_speed_ms = raw.distance_m / raw.duration_s


def analyse_route(raw: RawRoute, osm: Optional[OsmData], signals: List[cs.Signal], spec: ModeSpec,
                  profile: str, local_dt: datetime, is_night: bool,
                  live_ratio_fn=None, traffic_live: bool = False) -> Analysis:
    chunks_d = resample(raw.coords, CHUNK_M)
    chunks = [Chunk(d["coords"], d["start_m"], d["end_m"], d["length_m"], d["mid"]) for d in chunks_d]
    if not chunks:
        raise ValueError("empty route")
    lat0, lng0 = raw.coords[0][1], raw.coords[0][0]
    proj = LocalXY(lat0, lng0)
    _assign_maneuvers(chunks, raw)
    is_foot = spec.kind in ("foot", "wheel")
    is_motor = spec.kind == "motor"
    mid_xy = [proj.to_xy(*c.mid) for c in chunks]
    segs_xy = [(proj.to_xy(*c.coords[0]), proj.to_xy(*c.coords[-1])) for c in chunks]

    # ── OSM way matching ───────────────────────────────────────────
    way_lines, way_objs = [], []
    if osm and osm.ways:
        for w in osm.ways:
            try:
                way_lines.append(LineString(proj.many(w.geom)))
                way_objs.append(w)
            except Exception:  # noqa: BLE001
                continue
    tree = STRtree(way_lines) if way_lines else None

    lamps = _Idx(proj, osm.lamps if osm else [])
    cctv = _Idx(proj, osm.cctv if osm else [])
    police = _Idx(proj, osm.police if osm else [])
    hosp = _Idx(proj, osm.hospitals if osm else [])
    pois = _Idx(proj, osm.pois if osm else [])
    kerbs = _Idx(proj, (osm.kerbs + osm.crossings) if osm else [])
    osm_ok = bool(osm and (osm.ways or osm.lamps or osm.pois))

    sig_xy = np.array([proj.to_xy(s.lng, s.lat) for s in signals]) if signals else np.zeros((0, 2))

    def sig_near(seg, r: float, types: Set[str]) -> List[Tuple[cs.Signal, float]]:
        if not len(sig_xy):
            return []
        d = _seg_dist(sig_xy, *seg)
        out = []
        for i in np.nonzero(d <= r)[0]:
            s = signals[i]
            if s.type in types or (s.source == "sos" and "sos" in types):
                out.append((s, float(d[i])))
        return out

    used_ids: Set[str] = set()
    used_reports = 0
    seen_obstacle: Set[str] = set()

    for ch, (x, y), seg in zip(chunks, mid_xy, segs_xy):
        # ---- best matching OSM way for this stretch
        tags: Dict[str, str] = {}
        near_steps = False
        sidewalk_parallel = False
        if tree is not None:
            pt = Point(x, y)
            cand = tree.query(pt.buffer(25))
            best, best_key = None, None
            for i in cand:
                d = way_lines[i].distance(pt)
                hw = way_objs[i].tags.get("highway", "")
                if hw == "steps" and d <= 12:
                    near_steps = True
                if way_objs[i].tags.get("footway") == "sidewalk" and d <= 22:
                    sidewalk_parallel = True
                pref = 0 if ((hw in FOOT_HW) == is_foot) else 1
                key = (pref, d)
                if d <= 25 and (best_key is None or key < best_key):
                    best, best_key = way_objs[i], key
            if best:
                tags = best.tags
        ch.highway = tags.get("highway", "")
        ch.steps = near_steps or ch.highway == "steps"
        if not ch.street:
            ch.street = tags.get("name", "")

        # ---- lighting
        lit_tag = (tags.get("lit") or "").lower()
        lamp_n = len(lamps.within(seg, 35))
        if lit_tag in LIT_YES:
            ch.lit, ls, lc = True, 85.0, 0.9
        elif lit_tag in LIT_NO:
            ch.lit, ls, lc = False, 15.0, 0.9
        elif lamp_n >= 2:
            ch.lit, ls, lc = True, 78.0, 0.6
        elif lamp_n == 1:
            ls, lc = 62.0, 0.4
        else:
            ls, lc = 40.0, 0.12       # unknown — never claim "dark" or "bright"
        light_sig = sig_near(seg, 45, cs.LIGHT_TYPES)
        if light_sig:
            w = min(1.0, sum(s.weight for s, _ in light_sig))
            ls = ls * (1 - w) + 10.0 * w
            lc = max(lc, 0.5 + 0.4 * w)
            ch.lit = False if w >= 0.5 else ch.lit
            ch.issues.append("Poor lighting reported")
            for s, _ in light_sig:
                if s.id and s.id not in used_ids:
                    used_ids.add(s.id); used_reports += 1
        ch.lighting = (_clip(ls), lc)

        # ---- crowd / street activity
        npoi = len(pois.within(seg, 60))
        act = 22 + 9 * min(npoi, 8)
        if is_night:
            act *= 0.65
        ch.crowd = (_clip(act), 0.55 if osm_ok else 0.0)

        # ---- safety
        base = 62.0 - 40.0 * settings.CITY_RISK_PRIOR
        conf = 0.15 if osm_ok else 0.0
        d_pol = police.nearest_m(seg)
        if d_pol is not None and d_pol <= 450:
            base += 10 * (1 - d_pol / 450) + 3; conf += 0.25
        d_h = hosp.nearest_m(seg)
        if d_h is not None and d_h <= 600:
            base += 4; conf += 0.1
        ch.cctv_n = len(cctv.within(seg, 60))
        if ch.cctv_n:
            base += 8 + min(4, ch.cctv_n); conf += 0.3
        if npoi >= 6: base += 9; conf += 0.3
        elif npoi >= 3: base += 5; conf += 0.25
        elif npoi >= 1: base += 2; conf += 0.2
        elif osm_ok and is_night: base -= 10; conf += 0.15   # isolated + dark hours
        if ch.lit is True: base += 5
        if ch.lit is False and is_night: base -= 12
        night_mult = (1.5 if profile == "woman" else 1.3) if is_night else 1.0
        sec = sig_near(seg, 120, cs.SECURITY_TYPES)
        sos = sig_near(seg, 150, {"sos"})
        pen = 0.0
        if sec:
            rw = sum(s.weight for s, _ in sec)
            pen += min(55.0, 22.0 * rw); conf = max(conf, 0.8)
            ch.issues.append("Safety concern reported nearby")
            for s, _ in sec:
                if s.id and s.id not in used_ids:
                    used_ids.add(s.id); used_reports += 1
        if sos:
            pen += min(25.0, 12.0 * sum(s.weight for s, _ in sos)); conf = max(conf, 0.5)
        base -= pen * night_mult
        ch.safety = (_clip(base), min(0.95, conf))

        # ---- sudden incidents: crowd, accident, closure
        crowd_sig = sig_near(seg, 60, cs.CROWD_TYPES)
        inc_sig = sig_near(seg, 70, cs.INCIDENT_TYPES)
        blk_sig = [(s, d) for s, d in sig_near(seg, 30, cs.BLOCK_TYPES | cs.INCIDENT_TYPES | {"flooding"}) if cs.is_blocking(s)]
        if crowd_sig:
            ch.crowd_w = min(1.0, sum(s.weight for s, _ in crowd_sig))
            ch.issues.append("Crowd / gathering reported")
        if inc_sig:
            ch.incident_w = min(1.0, sum(s.weight for s, _ in inc_sig))
            ch.issues.append("Accident reported")
        if blk_sig:
            ch.blocked = True
            ch.issues.append("Road closed / impassable (verified)")
        for s, _ in crowd_sig + inc_sig + blk_sig:
            if s.id and s.id not in used_ids:
                used_ids.add(s.id); used_reports += 1
        if ch.crowd_w and is_night and profile == "woman":
            ch.safety = (_clip(ch.safety[0] - 8 * ch.crowd_w), max(ch.safety[1], 0.6))
        if ch.incident_w:
            ch.safety = (_clip(ch.safety[0] - 6 * ch.incident_w), max(ch.safety[1], 0.6))

        # ---- accessibility / surface condition
        a, ac = 60.0, 0.1
        hw = ch.highway
        surf = (tags.get("surface") or "").lower()
        smooth = (tags.get("smoothness") or "").lower()
        ch.surface, ch.smoothness = (surf or "unknown"), smooth
        bad = 0.0
        if is_foot:
            sw = (tags.get("sidewalk") or "").lower()
            if hw in FOOT_HW:
                a += 8; ac += 0.2
            elif sw in ("both", "left", "right", "yes") or sidewalk_parallel:
                a += 18; ac += 0.45
            elif sw in ("no", "none"):
                a -= 22; ac += 0.45; bad = max(bad, 0.5)
                ch.issues.append("No sidewalk (walking on the road)")
            elif hw in ROAD_HW_BUSY:
                a -= 10; ac += 0.1
        if surf in GOOD_SURF: a += 14; ac += 0.3
        elif surf in BAD_SURF:
            a -= 25 * (1.6 if spec.kind == "wheel" else 1.0); ac += 0.4; bad = max(bad, 0.6)
            ch.issues.append(f"Rough surface ({surf})")
        if smooth in SMOOTH_GOOD: a += 8; ac += 0.3
        elif smooth in SMOOTH_BAD:
            a -= 30 * (1.5 if spec.kind == "wheel" else 1.0); ac += 0.4; bad = max(bad, 0.9)
            ch.issues.append(f"Bad surface smoothness ({smooth})")
        if ch.steps and is_foot:
            a -= {"wheel": 80, "walking_elderly": 40}.get(spec.key, 10); ac += 0.5
            bad = max(bad, 1.0 if spec.kind == "wheel" else 0.4)
            ch.issues.append("Steps on this stretch")
        wc = (tags.get("wheelchair") or "").lower()
        if spec.kind == "wheel":
            if wc in ("yes", "designated"): a += 10; ac += 0.3
            elif wc == "no": a -= 60; ac += 0.5; bad = 1.0
            inc = tags.get("incline", "")
            try:
                if inc and abs(float(inc.replace("%", "").replace("up", "").replace("down", ""))) > 8:
                    a -= 25; ac += 0.3
            except ValueError:
                pass
            nk = kerbs.within(seg, 25)
            if nk:
                ks = [(osm.kerbs + osm.crossings)[i].tags.get("kerb", "") for i in nk]  # type: ignore
                if any(k in ("lowered", "flush") for k in ks): a += 6; ac += 0.2
                if any(k == "raised" for k in ks): a -= 12; ac += 0.2
        acc_sig = sig_near(seg, 40, cs.ACCESS_TYPES)
        if acc_sig:
            mult = {"wheel": 1.5, "walking_elderly": 1.2, "walking_low_vision": 1.2}.get(spec.key, 0.7 if is_foot else 0.9)
            w = sum(s.weight for s, _ in acc_sig)
            a -= min(60.0, 30.0 * w * mult); ac = max(ac, 0.8)
            bad = max(bad, min(1.0, 0.4 + 0.3 * w))
            for s, _ in acc_sig:
                ch.issues.append(f"{s.type.replace('_', ' ').title()} reported")
                if s.id and s.id not in used_ids:
                    used_ids.add(s.id); used_reports += 1
        ch.access = (_clip(a), min(0.95, ac))
        ch.badness = bad

    # ── traffic + timing per stretch ──────────────────────────────
    mult = time_multiplier(spec.key)
    ratios: Optional[List[Optional[float]]] = None
    if is_motor and live_ratio_fn is not None:
        ratios = live_ratio_fn(chunks)
    total_moving = total_delay = 0.0
    for i, ch in enumerate(chunks):
        if is_motor:
            ff = ch.ff_speed_ms if ch.ff_speed_ms > 0 else 8.0
            if spec.priority:
                ff *= 1.15
            ff = min(ff, spec.speed_kmh / 3.6)
            r = ratios[i] if ratios and ratios[i] is not None else estimated_ratio(local_dt, ff * 3.6)
            ch.traffic_ratio = max(0.05, min(1.0, r))
            eff = ch.traffic_ratio ** spec.traffic_exponent
            eff *= (1 - 0.35 * ch.crowd_w) * (1 - 0.5 * ch.incident_w)
            if ch.blocked:
                eff *= 0.15                      # effectively impassable: ETA explodes, route gets dropped
            pothole = 1.0
            for s, _ in sig_near(segs_xy[i], 30, {"pothole"}):
                pothole = min(pothole, 1 - 0.18 * min(1.0, s.weight) * spec.surface_sensitivity * 2)
            moving = ch.length_m / ff
            actual = ch.length_m / (ff * eff * pothole)
            ch.time_s = actual * mult
            ch.delay_s = (actual - moving) * mult
            total_moving += moving * mult
        else:
            slow = 1 - 0.40 * spec.surface_sensitivity * ch.badness
            slow *= 1 - min(0.45, 0.35 * ch.crowd_w * (1.4 if spec.kind == "wheel" else 1.0))
            slow *= 1 - 0.2 * ch.incident_w
            if ch.blocked:
                slow *= 0.15
            speed = spec.speed_kmh / 3.6
            moving = ch.length_m / speed
            actual = ch.length_m / (speed * max(0.4, slow))
            ch.time_s = actual * mult
            ch.delay_s = (actual - moving) * mult
            total_moving += moving * mult
    # one-off obstacle delays for foot / wheelchair (once per report)
    if is_foot:
        for s_i, s in enumerate(signals):
            if s.type in cs.ACCESS_TYPES and s.id and s.id in used_ids and s.id not in seen_obstacle:
                seen_obstacle.add(s.id)
                sec = {"missing_ramp": 45 if spec.kind == "wheel" else 0,
                       "broken_sidewalk": 20 if spec.kind == "wheel" else 6,
                       "obstruction": 15, "construction": 20,
                       "flooding": 90 if spec.kind == "wheel" else 40}.get(s.type, 0)
                total_delay += sec * min(1.0, s.weight) * mult
    if is_motor:
        # queueing upstream of an incident is not captured by the few metres around it
        for s in signals:
            if s.id and s.id in used_ids and s.id not in seen_obstacle:
                sec = {"accident": 150, "crowd": 60, "flooding": 120, "road_blocked": 0}.get(s.type, 0)
                if sec:
                    seen_obstacle.add(s.id)
                    total_delay += sec * min(1.0, s.weight) * mult
    total_delay += sum(c.delay_s for c in chunks)
    moving_min = total_moving / 60.0
    delay_min = total_delay / 60.0

    # ── aggregate scores (confidence-shrunk mean, 30 % worst-300 m) ──
    L = np.array([c.length_m for c in chunks])

    def agg(key: str) -> Tuple[float, float]:
        vals = np.array([_blend(getattr(c, key)) for c in chunks])
        mean = float((vals * L).sum() / L.sum())
        w = 4
        worst = mean
        if len(vals) >= w:
            worst = min(float(np.mean(vals[i:i + w])) for i in range(len(vals) - w + 1))
        cov = float(sum(c.length_m for c in chunks if getattr(c, key)[1] >= 0.5) / L.sum() * 100)
        return _clip(0.7 * mean + 0.3 * worst, 0, 99), cov

    scores, cov = {}, {}
    for name, key in (("lighting", "lighting"), ("safety", "safety"), ("accessibility", "access"), ("crowd", "crowd")):
        scores[name], cov[name] = agg(key)

    for ch in chunks:
        ch.overall = 0.4 * _blend(ch.safety) + 0.25 * _blend(ch.lighting) + 0.2 * _blend(ch.access) + 0.15 * _blend(ch.crowd)

    # ── hazards ──────────────────────────────────────────────────
    hazards: List[Hazard] = []
    along_of = lambda mid: min(chunks, key=lambda c: (c.mid[0]-mid[0])**2 + (c.mid[1]-mid[1])**2).start_m  # noqa: E731
    if len(sig_xy):
        route_line = LineString([proj.to_xy(*p) for p in raw.coords])
        for s, (sx, sy) in zip(signals, sig_xy):
            if s.source != "report":
                continue
            if route_line.distance(Point(sx, sy)) <= 45:
                age_txt = f"{int(s.age_days)}d ago" if s.age_days >= 1 else (f"{int(s.age_days * 24)}h ago" if s.age_days >= 1 / 24 else "just now")
                hazards.append(Hazard(
                    kind="community", type=s.type, severity=s.severity, lat=s.lat, lng=s.lng,
                    simulated=s.simulated,
                    label=f"{'🧪 SIMULATED · ' if s.simulated else ''}{s.type.replace('_', ' ').title()} · {'verified' if s.verified else 'unverified'} · {age_txt}",
                    along_m=round(along_of((s.lng, s.lat))), trust=round(s.trust, 2),
                    age_days=round(s.age_days, 1), verified=s.verified, report_id=s.id or None))
        # SOS clusters (grid cell, ≥ 2 recent alerts) — anonymised to ~110 m
        cells: Dict[Tuple[int, int], List[cs.Signal]] = {}
        for s, (sx, sy) in zip(signals, sig_xy):
            if s.source == "sos" and route_line.distance(Point(sx, sy)) <= 150:
                cells.setdefault((round(s.lat * 1000), round(s.lng * 1000)), []).append(s)
        for (ky, kx), group in cells.items():
            if len(group) >= 2:
                hazards.append(Hazard(kind="sos_cluster", type="sos_cluster", severity="high",
                                      lat=ky / 1000, lng=kx / 1000,
                                      label=f"{len(group)} SOS alerts triggered in this area recently",
                                      along_m=round(along_of((kx / 1000, ky / 1000)))))
    # OSM: unlit runs >= 160 m, steps for wheelchair / seniors
    run_start, run_len = None, 0.0
    for ch in chunks + [None]:  # type: ignore
        if ch is not None and ch.lit is False and not any("Poor lighting" in i for i in ch.issues):
            if run_start is None:
                run_start = ch
            run_len += ch.length_m
        else:
            if run_start is not None and run_len >= 160:
                hazards.append(Hazard(kind="osm", type="unlit_road", severity="medium",
                                      lat=run_start.mid[1], lng=run_start.mid[0],
                                      label=f"~{int(run_len)} m unlit (OpenStreetMap lit=no)", along_m=round(run_start.start_m)))
            run_start, run_len = None, 0.0
    if is_foot and spec.key in ("wheelchair", "walking_elderly"):
        for ch in chunks:
            if ch.steps:
                hazards.append(Hazard(kind="osm", type="steps", severity="high" if spec.kind == "wheel" else "medium",
                                      lat=ch.mid[1], lng=ch.mid[0], label="Steps on route (OpenStreetMap)", along_m=round(ch.start_m)))
                break
    hazards.sort(key=lambda h: h.along_m)

    # ── plain-language outputs ─────────────────────────────────
    total_km = L.sum() / 1000
    unlit_m = sum(c.length_m for c in chunks if c.lit is False)
    cctv_m = sum(c.length_m for c in chunks if c.cctv_n)
    warnings, highlights, why = [], [], []
    if is_night and scores["lighting"] < 55:
        warnings.append(f"🔦 Poor or unconfirmed lighting on parts of this route ({cov['lighting']:.0f}% of it has lighting data)")
    if unlit_m >= 160:
        warnings.append(f"🌑 About {unlit_m/1000:.1f} km is mapped as unlit (OpenStreetMap)")
    if scores["safety"] < 50:
        warnings.append("⚠️ Lower safety score — consider company or a different route after dark")
    comm = [h for h in hazards if h.kind == "community"]
    for h in comm[:3]:
        warnings.append(f"🚨 {h.type.replace('_', ' ').title()} reported near km {h.along_m/1000:.1f} ({'verified' if h.verified else 'community report'})")
    blocked_any = any(c.blocked for c in chunks)
    if blocked_any:
        warnings.insert(0, "⛔ Verified road closure on this route — avoid if possible")
    if any(c.incident_w for c in chunks):
        warnings.append("💥 Accident reported on this route — expect delays")
    if any(c.crowd_w for c in chunks):
        warnings.append("👥 Crowd / gathering reported on this route")
    if any(h.kind == "sos_cluster" for h in hazards):
        warnings.append("🆘 Several SOS alerts were triggered along this route recently")
    if any(h.type == "steps" for h in hazards):
        warnings.append("♿ Steps on this route — check the alternatives")
    if cctv_m / L.sum() > 0.25:
        highlights.append(f"📹 CCTV mapped near {cctv_m/L.sum()*100:.0f}% of this route")
    if scores["lighting"] >= 75 and is_night:
        highlights.append("💡 Well-lit corridor (mapped lamps / lit roads)")
    if scores["accessibility"] >= 75 and is_foot:
        highlights.append("♿ Good surfaces and sidewalks on most of the route")
    d_pol_min = None
    if osm and osm.police:
        if any((police.nearest_m(sg) or 1e9) <= 450 for sg in segs_xy):
            highlights.append("🚓 Police station(s) within ~450 m of parts of this route")
    highlights = [h for h in highlights if h]
    if comm:
        why.append(f"{len(comm)} community report(s) affect this route")
    if unlit_m:
        why.append(f"{unlit_m/1000:.1f} km mapped as unlit")
    if cctv_m:
        why.append(f"CCTV near {cctv_m/L.sum()*100:.0f}% of the route")
    if cov["lighting"] < 30:
        why.append(f"Only {cov['lighting']:.0f}% of the route has lighting data — score is cautious")
    return Analysis(chunks, scores, cov, hazards, moving_min, delay_min, moving_min + delay_min,
                    why[:4], warnings[:6], highlights[:3], used_reports, blocked_any)


def merge_segments(chunks: List[Chunk], spec: ModeSpec, max_segments: int = 70):
    """Merge consecutive stretches with the same look into drawable segments."""
    from app.models.route import RouteSegment
    is_motor = spec.kind == "motor"

    def quality(c: Chunk) -> str:
        confs = [c.lighting[1], c.safety[1], c.access[1]]
        if max(confs) < 0.3 and not c.issues:
            return "unknown"
        return "good" if c.overall >= 68 else "fair" if c.overall >= 45 else "poor"

    def look(c: Chunk) -> tuple:
        if is_motor:
            return (classify(c.traffic_ratio if c.traffic_ratio is not None else 1.0), c.street)
        return (quality(c), c.street)

    segs: List[List[Chunk]] = []
    for c in chunks:
        if segs and look(segs[-1][-1]) == look(c) and sum(x.length_m for x in segs[-1]) < 700:
            segs[-1].append(c)
        else:
            segs.append([c])
    while len(segs) > max_segments:   # coarsen if still too many
        merged, i = [], 0
        while i < len(segs):
            merged.append(segs[i] + (segs[i + 1] if i + 1 < len(segs) else []))
            i += 2
        segs = merged

    out = []
    for group in segs:
        coords: List[List[float]] = []
        for g in group:
            coords.extend(g.coords if not coords else g.coords[1:])
        dist = sum(g.length_m for g in group)
        wmean = lambda f: sum(f(g) * g.length_m for g in group) / dist  # noqa: E731
        # quality over the whole group (length-weighted)
        ov = wmean(lambda g: g.overall)
        confs = max(max(g.lighting[1], g.safety[1], g.access[1]) for g in group)
        q = "unknown" if (confs < 0.3 and not any(g.issues for g in group)) else ("good" if ov >= 68 else "fair" if ov >= 45 else "poor")
        tr = None
        ratio = None
        if is_motor:
            ratio = wmean(lambda g: g.traffic_ratio if g.traffic_ratio is not None else 1.0)
            tr = classify(ratio)
        lit_state = [g.lit for g in group]
        lvl = "UNKNOWN"
        if all(l is True for l in lit_state): lvl = "BRIGHT"
        elif any(l is False for l in lit_state): lvl = "DIM"
        elif any(l is True for l in lit_state): lvl = "MODERATE"
        issues = sorted({i for g in group for i in g.issues})
        out.append(RouteSegment(
            coordinates=[[round(c[0], 6), round(c[1], 6)] for c in coords],
            distance_m=round(dist, 1),
            duration_s=round(sum(g.time_s for g in group), 1),
            street_name=next((g.street for g in group if g.street), ""),
            safety_score=round(wmean(lambda g: _blend(g.safety)), 1),
            lighting_level=lvl,
            has_cctv=any(g.cctv_n for g in group),
            is_accessible=not any(g.steps for g in group) and wmean(lambda g: _blend(g.access)) >= 45,
            surface_type=next((g.surface for g in group if g.surface != "unknown"), "unknown"),
            quality=q,
            traffic=tr,
            traffic_ratio=round(ratio, 2) if ratio is not None else None,
            color=TRAFFIC_COLORS[tr] if tr else QUALITY_COLORS[q],
            issues=issues[:4],
        ))
    return out
