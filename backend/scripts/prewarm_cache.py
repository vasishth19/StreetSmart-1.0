"""
Pre-download OpenStreetMap street data for your demo routes so the live demo never waits on
Overpass. Run once the day before (and again the morning of):

    cd backend && python scripts/prewarm_cache.py
Edit PAIRS below. The cache lives in backend/.cache/osm (7-day expiry). Commit it or run this on Render's shell.
"""
import asyncio, os, sys
sys.path.insert(0, os.path.join(os.path.dirname(__file__), ".."))
from scripts.live_check import geocode  # noqa
from app.models.route import RoutePreferences
from app.services.routing_engine import routing_engine

PAIRS = [("PSIT Kanpur", "Kalyanpur Kanpur"), ("PSIT Kanpur", "Kanpur Central Railway Station")]
MODES = ["walking", "wheelchair", "car"]

async def main():
    for a, b in PAIRS:
        o, d = await geocode(a), await geocode(b)
        for m in MODES:
            for attempt in range(4):
                r = await routing_engine.generate_routes(o, d, RoutePreferences(travel_mode=m))
                st = r.routes[0].data_quality.osm_status
                print(a, "->", b, m, "osm:", st)
                if st in ("ok", "cached"):
                    break
                await asyncio.sleep(15)

if __name__ == "__main__":
    asyncio.run(main())
