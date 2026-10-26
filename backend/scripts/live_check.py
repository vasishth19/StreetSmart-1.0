"""
LIVE end-to-end check against the real public servers. Run on YOUR machine (needs internet):

    cd backend
    python scripts/live_check.py "PSIT Kanpur" "Kalyanpur Kanpur"

Prints, for every travel mode: distance, time, traffic source and data coverage, so you can
compare against Google Maps and show mentors a real accuracy table.
"""
import asyncio, os, sys, json
import httpx
sys.path.insert(0, os.path.join(os.path.dirname(__file__), ".."))
from app.models.route import Coordinates, RoutePreferences
from app.services.routing_engine import routing_engine, _fmt_dur


async def geocode(q):
    async with httpx.AsyncClient(headers={"User-Agent": "StreetSmart-livecheck/1.0"}, timeout=15) as c:
        r = await c.get("https://nominatim.openstreetmap.org/search", params={"q": q, "format": "json", "limit": 1})
        r.raise_for_status()
        j = r.json()
        if not j:
            raise SystemExit(f"could not geocode {q!r}")
        return Coordinates(lat=float(j[0]["lat"]), lng=float(j[0]["lon"]))


async def main(a, b):
    o, d = await geocode(a), await geocode(b)
    print(f"{a} -> {b}\n  origin {o}\n  dest   {d}\n")
    print(f"{'mode':<12}{'km':>7}{'time':>10}{'range':>16}  traffic    lit%  surf%  reports  provider")
    for mode in ("walking", "wheelchair", "cycling", "motorcycle", "car"):
        prefs = RoutePreferences(travel_mode=mode, user_profile="wheelchair" if mode == "wheelchair" else "general")
        try:
            resp = await routing_engine.generate_routes(o, d, prefs)
        except Exception as e:
            print(f"{mode:<12} FAILED: {e}")
            continue
        r = resp.routes[0]
        dq = r.data_quality
        rng = f"{_fmt_dur(r.eta.range_min[0])}–{_fmt_dur(r.eta.range_min[1])}"
        print(f"{mode:<12}{r.distance_km:>7.1f}{_fmt_dur(r.duration_min):>10}{rng:>16}  {dq.traffic_source:<10}{dq.lighting_coverage_pct:>5.0f}{dq.surface_coverage_pct:>7.0f}{dq.community_reports_used:>8}  {dq.routing_provider} / osm:{dq.osm_status}")
        if mode == "walking":
            for n in dq.notes:
                print("   note:", n)
    print("\nNow open Google Maps for the same pair and fill docs/ACCURACY_LOG.md")

if __name__ == "__main__":
    asyncio.run(main(sys.argv[1] if len(sys.argv) > 1 else "PSIT Kanpur", sys.argv[2] if len(sys.argv) > 2 else "Kalyanpur Kanpur"))
