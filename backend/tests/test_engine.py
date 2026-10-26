"""
Offline tests: network providers are replaced with a synthetic ~11 km city route so we can
verify the LOGIC (mode-specific ETA, lighting/accessibility scoring, community effect,
traffic colours). Live provider behaviour is checked by scripts/live_check.py.
Run:  cd backend && pytest -q
"""
import asyncio
import math
import os
import sys
from datetime import datetime

sys.path.insert(0, os.path.join(os.path.dirname(__file__), ".."))

import pytest

from app.models.route import Coordinates, RoutePreferences
from app.services import community_signals as cs
from app.services import osm_client, road_router, routing_engine as re_mod
from app.services.mode_profiles import resolve_mode
from app.services.osm_client import OsmData, OsmPoint, OsmWay
from app.services.road_router import Maneuver, RawRoute
from app.services.safety_model import analyse_route
from app.utils.geo_local import haversine_m, polyline_length_m

O = Coordinates(lat=26.4400, lng=80.2900)
D = Coordinates(lat=26.4400, lng=80.3900)   # ~10 km due east at this latitude


def straight_route(n=101):
    return [[O.lng + (D.lng - O.lng) * i / (n - 1), O.lat] for i in range(n)]


def mk_raw(speed_kmh=40.0):
    coords = straight_route()
    dist = polyline_length_m(coords)
    mans = []
    step = 10
    for i in range(0, len(coords) - 1, step):
        seg = coords[i:i + step + 1]
        L = polyline_length_m(seg)
        mans.append(Maneuver(seg, L, L / (speed_kmh / 3.6), "Continue", "Test Road"))
    return RawRoute(coords, dist, dist / (speed_kmh / 3.6), mans, "test")


def way(lit=None, surface=None, hw="residential", sidewalk=None, smooth=None, west=O.lng, east=D.lng):
    tags = {"highway": hw}
    if lit: tags["lit"] = lit
    if surface: tags["surface"] = surface
    if sidewalk: tags["sidewalk"] = sidewalk
    if smooth: tags["smoothness"] = smooth
    return OsmWay(1, tags, [(west, O.lat), (east, O.lat)])


NOON = datetime(2026, 10, 26, 12, 0)
NIGHT = datetime(2026, 10, 26, 22, 0)


def run(spec_key, osm=None, signals=None, dt=NOON, night=False, profile="general"):
    spec = resolve_mode(spec_key, profile)
    return analyse_route(mk_raw(), osm, signals or [], spec, profile, dt, night)


def test_distance_is_real_geodesic():
    assert 9_900 < polyline_length_m(straight_route()) < 10_200


def test_same_route_gives_different_time_per_mode():
    t = {k: run(k).total_min for k in ("walking", "wheelchair", "cycling", "motorcycle", "car")}
    assert t["walking"] > t["cycling"] > t["motorcycle"]
    assert t["motorcycle"] <= t["car"]          # bikes filter through congestion
    assert t["wheelchair"] > t["walking"]
    # ~10.1 km at 5 km/h ≈ 2 h
    assert 115 < t["walking"] < 130
    # wheelchair 3.6 km/h ≈ 2.8 h
    assert 160 < t["wheelchair"] < 180


def test_elderly_profile_changes_walking_speed():
    assert run("walking", profile="elderly").total_min > run("walking").total_min * 1.2


def test_rush_hour_slows_cars_and_marks_traffic():
    day = run("car", dt=datetime(2026, 10, 26, 3, 0))
    rush = run("car", dt=datetime(2026, 10, 26, 18, 30))
    assert rush.total_min > day.total_min * 1.25
    assert rush.delay_min > day.delay_min
    assert all(c.traffic_ratio is not None for c in rush.chunks)


def test_motorbike_less_hit_by_traffic_than_car():
    dt = datetime(2026, 10, 26, 18, 30)
    car, bike = run("car", dt=dt), run("motorcycle", dt=dt)
    assert bike.delay_min / bike.moving_min < car.delay_min / car.moving_min


def test_ambulance_faster_than_car_in_traffic():
    dt = datetime(2026, 10, 26, 18, 30)
    assert run("ambulance", dt=dt).total_min < run("car", dt=dt).total_min


def test_lit_vs_unlit_road_lighting_score_night():
    lit = OsmData(ways=[way(lit="yes")])
    unlit = OsmData(ways=[way(lit="no")])
    a, b = run("walking", lit, dt=NIGHT, night=True), run("walking", unlit, dt=NIGHT, night=True)
    assert a.scores["lighting"] > 75 and b.scores["lighting"] < 30
    assert a.scores["safety"] > b.scores["safety"]
    assert any(h.type == "unlit_road" for h in b.hazards)


def test_unknown_data_is_not_scored_as_good_or_bad():
    a = run("walking", OsmData(ways=[way()]), dt=NIGHT, night=True)
    assert 40 <= a.scores["lighting"] <= 60          # shrinks toward neutral
    assert a.coverage["lighting"] < 5                # and says so


def test_no_data_at_all_is_neutral_and_flagged():
    a = run("walking", None, dt=NIGHT, night=True)
    assert 45 <= a.scores["safety"] <= 65 and a.coverage["safety"] == 0


def test_cctv_police_and_shops_raise_safety():
    mid = (O.lng + D.lng) / 2
    pts = [OsmPoint(O.lng + (D.lng - O.lng) * i / 40, O.lat + 0.0002, "cctv") for i in range(41)]
    shops = [OsmPoint(O.lng + (D.lng - O.lng) * i / 400, O.lat + 0.0002, "poi", {"shop": "x"}) for i in range(401)]
    base = run("walking", OsmData(ways=[way()]), dt=NIGHT, night=True)
    rich = run("walking", OsmData(ways=[way()], cctv=pts, pois=shops), dt=NIGHT, night=True)
    assert rich.scores["safety"] > base.scores["safety"] + 8
    assert rich.scores["crowd"] > base.scores["crowd"] + 15


def test_wheelchair_penalises_steps_and_rough_surface():
    good = OsmData(ways=[way(surface="asphalt", sidewalk="both", smooth="good")])
    bad = OsmData(ways=[way(surface="gravel", sidewalk="no", smooth="very_bad")])
    g, b = run("wheelchair", good), run("wheelchair", bad)
    assert g.scores["accessibility"] > 75 and b.scores["accessibility"] < 30
    assert b.total_min > g.total_min                # rough surface -> slower
    steps = OsmData(ways=[way(surface="asphalt", sidewalk="both"),
                          OsmWay(2, {"highway": "steps"}, [(O.lng + 0.04, O.lat - 0.0001), (O.lng + 0.0402, O.lat + 0.0001)])])
    assert any(h.type == "steps" for h in run("wheelchair", steps).hazards)


def _report(id, typ, dx_deg, status="reported", votes=0, sev="medium", age_days=1, verified=False):
    return {"id": id, "lat": O.lat + 0.0001, "lng": O.lng + dx_deg, "issue_type": typ, "severity": sev,
            "status": status, "votes": votes, "created_at": datetime.utcnow().isoformat(), "verified": verified}


def test_community_reports_change_the_result_and_trust_grows_with_confirmations():
    sigs_weak = [cs.to_signal(_report("1", "poor_lighting", 0.05))]
    sigs_strong = [cs.to_signal(_report("1", "poor_lighting", 0.05, status="approved"))]
    osm = OsmData(ways=[way(lit="yes")])
    none_ = run("walking", osm, dt=NIGHT, night=True)
    weak = run("walking", osm, sigs_weak, dt=NIGHT, night=True)
    strong = run("walking", osm, sigs_strong, dt=NIGHT, night=True)
    assert none_.scores["lighting"] > weak.scores["lighting"] > strong.scores["lighting"]
    assert any(h.kind == "community" and h.type == "poor_lighting" for h in strong.hazards)


def test_rejected_and_resolved_reports_are_ignored_and_old_ones_fade():
    assert cs.to_signal(_report("1", "poor_lighting", 0.0, status="rejected")) is None
    assert cs.to_signal(_report("1", "poor_lighting", 0.0, status="resolved")) is None
    old = _report("1", "flooding", 0.0)
    old["created_at"] = "2020-01-01T00:00:00+00:00"
    assert cs.to_signal(old) is None                 # flooding half-life = 3 days


def test_broken_sidewalk_report_slows_wheelchair_more_than_walker():
    sig = [cs.to_signal(_report("9", "broken_sidewalk", 0.05, status="approved", sev="high"))]
    osm = OsmData(ways=[way(surface="asphalt")])
    w0, w1 = run("walking", osm), run("walking", osm, sig)
    c0, c1 = run("wheelchair", osm), run("wheelchair", osm, sig)
    assert (c1.total_min - c0.total_min) > (w1.total_min - w0.total_min)
    assert c1.scores["accessibility"] < c0.scores["accessibility"]


def test_pothole_slows_two_wheelers():
    sig = [cs.to_signal(_report("5", "pothole", 0.05, status="approved", sev="high"))]
    a, b = run("motorcycle"), run("motorcycle", None, sig)
    assert b.total_min > a.total_min


def test_sos_cluster_lowers_safety_and_shows_hazard():
    sos = [cs.sos_signal({"lat": O.lat + 0.0001, "lng": O.lng + 0.05, "status": "active",
                          "created_at": datetime.utcnow().isoformat()}) for _ in range(4)]
    osm = OsmData(ways=[way()])
    a, b = run("walking", osm, dt=NIGHT, night=True), run("walking", osm, sos, dt=NIGHT, night=True)
    assert b.scores["safety"] < a.scores["safety"]
    assert any(h.kind == "sos_cluster" for h in b.hazards)


def test_segments_have_traffic_colours_for_cars_and_quality_colours_for_walkers():
    from app.services.safety_model import merge_segments
    car = run("car", dt=datetime(2026, 10, 26, 18, 30))
    segs = merge_segments(car.chunks, resolve_mode("car"))
    assert segs and all(s.traffic in ("free", "moderate", "heavy") for s in segs)
    assert {s.color for s in segs} <= {"#22C55E", "#FACC15", "#EF4444"}
    walk = run("walking", OsmData(ways=[way(lit="no")]), dt=NIGHT, night=True)
    wsegs = merge_segments(walk.chunks, resolve_mode("walking"))
    assert all(s.traffic is None for s in wsegs) and any(s.quality in ("poor", "fair") for s in wsegs)


def test_night_detection_uses_real_sun_times():
    assert re_mod.is_dark(datetime(2026, 10, 25, 22, 0), 26.45, 80.35)
    assert not re_mod.is_dark(datetime(2026, 10, 25, 12, 0), 26.45, 80.35)
    assert re_mod.is_dark(datetime(2026, 10, 25, 18, 30), 26.45, 80.35)   # after sunset (~17:32)
    assert not re_mod.is_dark(datetime(2026, 10, 25, 8, 0), 26.45, 80.35)


# ───────────── full engine with mocked providers ─────────────
@pytest.fixture
def patched(monkeypatch):
    async def fake_candidates(spec, o, d, night, profile, client=None, avoid=None):
        fake_candidates.avoid = avoid
        a = mk_raw()
        b_coords = [[c[0], c[1] + 0.006 * math.sin(math.pi * i / 100)] for i, c in enumerate(straight_route())]
        b = RawRoute(b_coords, polyline_length_m(b_coords), polyline_length_m(b_coords) / 11, [], "test", "alt")
        return [a, b]

    async def fake_osm(routes):
        return OsmData(ways=[way(lit="yes", surface="asphalt", sidewalk="both")]), "ok"

    async def fake_sig(box):
        return list(getattr(fake_sig, "items", [])), "ok"

    async def fake_rain(lat, lng):
        return 0.0

    monkeypatch.setattr(re_mod.weather, "precipitation_mm", fake_rain)
    patched_ns = type("NS", (), {})()
    patched_ns.sig = fake_sig
    patched_ns.cand = fake_candidates

    monkeypatch.setattr(re_mod, "fetch_candidates", fake_candidates)
    monkeypatch.setattr(osm_client, "fetch_corridor", fake_osm)
    monkeypatch.setattr(re_mod.community_signals, "load_signals", fake_sig)
    return patched_ns


def _gen(mode, profile="general", dep=None):
    prefs = RoutePreferences(user_profile=profile, travel_mode=mode, departure_time=dep)
    return asyncio.run(re_mod.routing_engine.generate_routes(O, D, prefs))


def test_engine_end_to_end_modes_differ(patched):
    out = {m: _gen(m) for m in ("walking", "wheelchair", "car", "motorcycle")}
    t = {m: r.routes[0].duration_min for m, r in out.items()}
    assert t["wheelchair"] > t["walking"] > t["motorcycle"]
    assert t["motorcycle"] <= t["car"]
    assert out["walking"].routes[0].draw_style == "dotted" and out["car"].routes[0].draw_style == "solid"
    r = out["car"].routes[0]
    assert r.eta.traffic_source == "estimated" and r.eta.range_min[0] < r.eta.total_min < r.eta.range_min[1]
    assert 1 <= len(out["walking"].routes) <= 3 and out["walking"].routes[0].rank == 1
    assert out["walking"].routes[0].scores.overall > 0


def test_engine_priority_modes_name_corridors(patched):
    r = _gen("ambulance")
    assert r.routes[0].name == "Fastest corridor"


def test_engine_degrades_honestly_without_osm(monkeypatch, patched):
    async def none_osm(routes):
        return None, "warming"
    monkeypatch.setattr(osm_client, "fetch_corridor", none_osm)
    r = _gen("walking")
    assert r.routes[0].data_quality.osm_status == "warming"
    assert any("not ready" in n for n in r.routes[0].data_quality.notes)


# ───────────── provider response parsing (documented formats) ─────────────
def test_parse_overpass_sample():
    raw = {"elements": [
        {"type": "way", "id": 1, "tags": {"highway": "residential", "lit": "yes", "surface": "asphalt"},
         "geometry": [{"lat": 26.44, "lon": 80.29}, {"lat": 26.44, "lon": 80.30}]},
        {"type": "node", "id": 2, "lat": 26.4401, "lon": 80.295, "tags": {"highway": "street_lamp"}},
        {"type": "node", "id": 3, "lat": 26.4401, "lon": 80.296, "tags": {"man_made": "surveillance"}},
        {"type": "way", "id": 4, "center": {"lat": 26.44, "lon": 80.297}, "tags": {"amenity": "police"}},
        {"type": "node", "id": 5, "lat": 26.44, "lon": 80.298, "tags": {"shop": "kiosk"}},
    ]}
    d = osm_client.parse_overpass(raw)
    assert len(d.ways) == 1 and len(d.lamps) == 1 and len(d.cctv) == 1 and len(d.police) == 1 and len(d.pois) == 1


def test_parse_valhalla_trip():
    from app.utils.geo_local import decode_polyline
    shape = "_p~iF~ps|U_ulLnnqC_mqNvxq`@"      # precision-5 sample; Valhalla uses 6 -> just check structure
    trip = {"legs": [{"shape": "", "maneuvers": []}], "summary": {"length": 1.0, "time": 720}}
    # empty shape must not crash and returns a RawRoute
    r = road_router._parse_valhalla_trip(trip, "x")
    assert r.provider == "valhalla" and r.distance_m == 1000


def test_osrm_uses_profile_specific_path(monkeypatch):
    seen = {}

    class FakeResp:
        status_code = 200
        def json(self):
            return {"code": "Ok", "routes": [{"geometry": {"coordinates": [[80.29, 26.44], [80.30, 26.44]]},
                                               "distance": 1000, "duration": 720, "legs": []}]}

    class FakeClient:
        async def get(self, url, params=None, headers=None):
            seen["url"] = url
            return FakeResp()

    async def nopace(*a, **k): return None
    monkeypatch.setattr(road_router, "_pace", nopace)
    asyncio.run(road_router._osrm(FakeClient(), resolve_mode("walking"), O, D, "x", 0))
    assert "/routed-foot/" in seen["url"]          # NOT the car-only demo path
    asyncio.run(road_router._osrm(FakeClient(), resolve_mode("car"), O, D, "x", 0))
    assert "/routed-car/" in seen["url"]


# ───────────── PDF requirements: accidents, crowds, closures, expiry, rerouting ─────────────
def test_new_incident_types_expire_on_their_own():
    now = datetime.utcnow()
    for typ, hours_old, should_live in [("accident", 2, True), ("accident", 40, False),
                                        ("crowd", 1, True), ("crowd", 30, False),
                                        ("pothole", 24 * 120, True), ("poor_lighting", 24 * 60, True)]:
        r = _report("x", typ, 0.0)
        r["created_at"] = (now - __import__("datetime").timedelta(hours=hours_old)).isoformat()
        assert (cs.to_signal(r) is not None) == should_live, (typ, hours_old)


def test_unverified_closure_never_blocks_but_verified_does():
    weak = cs.to_signal(_report("1", "road_blocked", 0.05))
    strong = cs.to_signal(_report("1", "road_blocked", 0.05, status="approved"))
    assert not cs.is_blocking(weak) and cs.is_blocking(strong)
    crit_acc = cs.to_signal(_report("2", "accident", 0.05, status="approved", sev="critical"))
    minor_acc = cs.to_signal(_report("3", "accident", 0.05, status="approved", sev="low"))
    assert cs.is_blocking(crit_acc) and not cs.is_blocking(minor_acc)


def test_accident_slows_cars_and_crowd_slows_walkers():
    acc = [cs.to_signal(_report("a", "accident", 0.05, status="approved", sev="high"))]
    crowd = [cs.to_signal(_report("c", "crowd", 0.05, status="approved", sev="high"))]
    dt = datetime(2026, 10, 26, 3, 0)
    assert run("car", None, acc, dt=dt).total_min > run("car", None, None, dt=dt).total_min * 1.02
    assert run("walking", None, crowd).total_min > run("walking").total_min
    assert run("wheelchair", None, crowd).total_min - run("wheelchair").total_min > \
           run("walking", None, crowd).total_min - run("walking").total_min
    assert any("Crowd" in w for w in run("walking", None, crowd).warnings)


def test_verified_closure_marks_route_blocked_and_raises_eta():
    blk = [cs.to_signal(_report("b", "road_blocked", 0.05, status="approved", sev="critical"))]
    a = run("car", None, blk, dt=datetime(2026, 10, 26, 3, 0))
    assert a.blocked and a.total_min > run("car", None, None, dt=datetime(2026, 10, 26, 3, 0)).total_min * 1.05
    assert any("closure" in w.lower() for w in a.warnings)


def test_engine_drops_blocked_route_when_alternative_is_clear_and_passes_avoid(patched):
    # closure sits on the straight route (route A) but not on the curved detour (route B)
    blk = cs.to_signal(_report("b", "road_blocked", 0.0, status="approved", sev="critical"))
    blk.lat, blk.lng = O.lat, O.lng + 0.05
    patched.sig.items = [blk]
    r = _gen("car")
    assert len(r.routes) == 1 and not r.routes[0].blocked
    assert any("verified road closure" in n for n in r.routes[0].data_quality.notes)
    assert patched.cand.avoid == [(blk.lat, blk.lng)]


def test_simulated_incident_is_labelled(patched):
    s = cs.to_signal({**_report("s", "pothole", 0.05, status="approved"), "is_simulated": True})
    patched.sig.items = [s]
    r = _gen("walking")
    hz = [h for h in r.routes[0].hazards if h.kind == "community"]
    assert hz and hz[0].simulated and "SIMULATED" in hz[0].label
