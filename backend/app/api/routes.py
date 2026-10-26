from fastapi import APIRouter, HTTPException, Query
from datetime import datetime
import logging

from app.config import settings
from app.models.route import RouteRequest, RoutesResponse
from app.services.road_router import RoutingError
from app.services.routing_engine import routing_engine
from app.services.safety_engine import safety_engine

router = APIRouter()
logger = logging.getLogger(__name__)


@router.post("/routes", response_model=RoutesResponse)
async def generate_routes(request: RouteRequest):
    """
    Real routes on the OpenStreetMap network with mode-specific travel time
    (walking / wheelchair / cycling / motorbike / car / emergency), street-level
    lighting, CCTV, surface and community-report evidence, and traffic for vehicles.
    """
    try:
        logger.info("routes %s -> %s mode=%s profile=%s", request.origin, request.destination,
                    request.preferences.travel_mode or request.preferences.transport_mode,
                    request.preferences.user_profile)
        resp = await routing_engine.generate_routes(request.origin, request.destination, request.preferences)
        if not resp.routes:
            raise HTTPException(status_code=404, detail="No routes found")
        return resp
    except HTTPException:
        raise
    except RoutingError as e:
        logger.error("routing error: %s", e)
        raise HTTPException(status_code=502, detail=f"Routing providers unavailable: {e}")
    except Exception as e:
        logger.exception("Route generation error")
        raise HTTPException(status_code=500, detail=f"Route generation failed: {e}")


@router.get("/routes/status")
async def routes_status():
    """What data sources are active — handy to show mentors / to debug deployments."""
    return {
        "routing": {"primary": settings.VALHALLA_URL, "fallback": settings.OSRM_URL + " (routed-foot/bike/car)"},
        "street_data": "OpenStreetMap via Overpass (lit, lamps, CCTV, surface, sidewalks, shops, police)",
        "community": "Supabase reports + anonymised SOS clusters",
        "traffic": "live (TomTom)" if settings.TOMTOM_API_KEY else "estimated (typical rush-hour pattern)",
        "local_utc_offset_min": settings.LOCAL_UTC_OFFSET_MIN,
        "city_risk_prior": settings.CITY_RISK_PRIOR,
    }


@router.get("/heatmap")
async def get_heatmap(
    lat: float = Query(default=26.4499, description="Center latitude"),
    lng: float = Query(default=80.3319, description="Center longitude"),
    radius: float = Query(default=3.0, description="Radius in km"),
):
    """Risk heatmap built from real community reports + SOS clusters."""
    try:
        points, zones, stats = await safety_engine.build(lat, lng, radius)
        return {"heatmap": points, "incident_zones": zones, "stats": stats,
                "center": {"lat": lat, "lng": lng}, "radius_km": radius}
    except Exception as e:
        logger.error(f"Heatmap error: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/analytics")
async def get_analytics():
    """
    Analytics from the real reports table. Fields we do not track (e.g. route
    counts per profile) are returned as 0 instead of random numbers.
    """
    from collections import Counter
    import asyncio
    rows = []
    try:
        from app.services.supabase_client import supabase
        rows = await asyncio.to_thread(lambda: supabase.table("reports").select("issue_type,status,created_at").limit(5000).execute().data or [])
    except Exception as e:
        logger.info("analytics: reports unavailable: %s", e)
    by_type = Counter(r.get("issue_type") or "other" for r in rows)
    resolved = Counter(r.get("issue_type") or "other" for r in rows if (r.get("status") or "") in ("resolved", "fixed"))
    return {
        "overview": {"total_routes_today": 0, "active_users": 0, "avg_safety_score": 0,
                     "reports_resolved": sum(resolved.values()), "cities_covered": 1, "accessibility_score": 0,
                     "total_reports": len(rows)},
        "hourly_safety": [], "profile_usage": [], "daily_routes": [],
        "top_issues": [{"type": t, "count": c, "resolved": resolved.get(t, 0)} for t, c in by_type.most_common(8)],
        "safety_trend": "n/a", "accessibility_trend": "n/a",
        "note": "Only report statistics are real; route/user counters are not tracked yet.",
    }
