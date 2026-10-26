from fastapi import APIRouter, HTTPException
from pydantic import BaseModel
from typing import List, Optional, Dict
import logging

from app.models.route import Coordinates
from app.services import community_signals, osm_client
from app.services.mode_profiles import PROFILE_WEIGHTS, resolve_mode
from app.services.road_router import RawRoute
from app.services.routing_engine import is_dark, local_time
from app.services.safety_model import analyse_route
from app.utils.geo_local import bbox_of, polyline_length_m

router = APIRouter()
logger = logging.getLogger(__name__)


class ScoringRequest(BaseModel):
    coordinates: List[List[float]]          # [[lng, lat], ...]
    profile: str = "general"
    travel_mode: Optional[str] = None
    departure_time: Optional[str] = None
    weights: Optional[Dict[str, float]] = None


@router.post("/score")
async def score_route(request: ScoringRequest):
    """Score any polyline using real OSM + community evidence (no random values)."""
    if len(request.coordinates) < 2:
        raise HTTPException(status_code=422, detail="Need at least 2 coordinates")
    try:
        spec = resolve_mode(request.travel_mode, request.profile)
        dist = polyline_length_m(request.coordinates)
        raw = RawRoute(request.coordinates, dist, dist / (spec.speed_kmh / 3.6), [], "client")
        ldt = local_time(request.departure_time)
        night = is_dark(ldt, request.coordinates[0][1], request.coordinates[0][0])
        osm, osm_status = await osm_client.fetch_corridor([request.coordinates])
        sigs, comm = await community_signals.load_signals(bbox_of(request.coordinates, 150))
        an = analyse_route(raw, osm, sigs, spec, request.profile, ldt, night)
        return {"scores": {k: round(v, 1) for k, v in an.scores.items()}, "coverage_pct": an.coverage,
                "profile": request.profile, "is_night": night, "osm_status": osm_status, "community_status": comm}
    except Exception as e:
        logger.error(f"Scoring error: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/score/profiles")
async def get_scoring_profiles():
    """Default scoring weight profiles for each user type."""
    return {"profiles": {p: {f"weight_{k}": v for k, v in w.items()} for p, w in PROFILE_WEIGHTS.items()}}
