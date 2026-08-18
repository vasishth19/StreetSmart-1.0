"""
StreetSmart – Parking API
SIH1515: Smart and Effective Realtime Management of Street Parking

Endpoints:
  GET  /parking/zones                 list zones with live occupancy + pricing
  GET  /parking/zones/{zone_id}       single zone
  GET  /parking/spots                 nearby spots (lat/lng/radius)
  GET  /parking/spots/{spot_id}       single spot
  GET  /parking/pricing/{spot_id}     current dynamic price quote
  POST /parking/reserve               reserve a spot
  POST /parking/reserve/{spot_id}/cancel
  GET  /parking/analytics             city-wide dashboard data
"""
from fastapi import APIRouter, HTTPException, Query
from datetime import datetime
import logging

from app.models.parking import ReservationRequest
from app.services.parking_engine import parking_engine
from app.services.supabase_client import supabase

router = APIRouter(prefix="/parking", tags=["parking"])
logger = logging.getLogger(__name__)


@router.get("/zones")
async def list_zones():
    """All parking zones with live occupancy, demand level and pricing."""
    try:
        return parking_engine.list_zones()
    except Exception as e:
        logger.error(f"Zone list error: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/zones/{zone_id}")
async def get_zone(zone_id: str):
    zone = parking_engine.get_zone(zone_id)
    if not zone:
        raise HTTPException(status_code=404, detail="Zone not found")
    return zone


@router.get("/spots")
async def get_nearby_spots(
    lat: float = Query(..., description="Latitude to search around"),
    lng: float = Query(..., description="Longitude to search around"),
    radius_km: float = Query(default=1.0, ge=0.1, le=5.0),
    vehicle_type: str = Query(default=None, description="Filter: car, two_wheeler, suv, commercial"),
):
    """Nearby spots ranked by availability then distance."""
    try:
        spots = parking_engine.get_nearby_spots(lat, lng, radius_km)
        if vehicle_type:
            spots = [s for s in spots if s.vehicle_type.value == vehicle_type]
        return {
            "spots": spots,
            "center": {"lat": lat, "lng": lng},
            "radius_km": radius_km,
            "total_found": len(spots),
            "generated_at": datetime.utcnow().isoformat(),
        }
    except Exception as e:
        logger.error(f"Nearby spots error: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/spots/{spot_id}")
async def get_spot(spot_id: str):
    spot = parking_engine.get_spot(spot_id)
    if not spot:
        raise HTTPException(status_code=404, detail="Spot not found")
    return spot


@router.get("/pricing/{spot_id}")
async def get_pricing(spot_id: str):
    """Current dynamic price for a spot, with a short explanation of
    what's driving it (occupancy, peak hour, etc.)."""
    quote = parking_engine.get_pricing_quote(spot_id)
    if not quote:
        raise HTTPException(status_code=404, detail="Spot not found")
    return quote


@router.post("/reserve")
async def reserve_spot(request: ReservationRequest):
    """Reserve a spot for `duration_minutes`. The spot is held until
    the reservation expires or is explicitly cancelled."""
    try:
        result = parking_engine.reserve_spot(request.spot_id, request.duration_minutes)
        if not result:
            raise HTTPException(status_code=404, detail="Spot not found")
        if "error" in result:
            if result["error"] == "not_found":
                raise HTTPException(status_code=404, detail="Spot not found")
            raise HTTPException(status_code=409, detail=f"Spot is {result.get('status', 'unavailable')}")

        # Best-effort persistence for history/admin dashboards — never
        # blocks the reservation itself if it fails (same pattern as sos.py).
        try:
            record = {
                "spot_id": request.spot_id,
                "zone_id": result["zone_id"],
                "user_id": request.user_id,
                "vehicle_number": request.vehicle_number,
                "vehicle_type": request.vehicle_type.value,
                "duration_minutes": request.duration_minutes,
                "price_per_hour": result["price_per_hour"],
                "estimated_total": result["estimated_total"],
                "status": "confirmed",
                "reserved_at": result["reserved_at"],
                "expires_at": result["expires_at"],
            }
            saved = supabase.table("parking_reservations").insert(record).execute()
            result["id"] = saved.data[0]["id"] if saved.data else result["id"]
        except Exception as e:
            logger.warning(f"Reservation logging skipped: {e}")

        result["vehicle_number"] = request.vehicle_number
        return result
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Reservation error: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/reserve/{spot_id}/cancel")
async def cancel_reservation(spot_id: str):
    result = parking_engine.cancel_reservation(spot_id)
    if not result:
        raise HTTPException(status_code=404, detail="Spot not found")
    try:
        supabase.table("parking_reservations").update({"status": "cancelled"}).eq(
            "spot_id", spot_id
        ).eq("status", "confirmed").execute()
    except Exception as e:
        logger.warning(f"Reservation cancel logging skipped: {e}")
    return result


@router.get("/analytics")
async def get_parking_analytics():
    """City-wide occupancy, pricing and revenue snapshot for the admin dashboard."""
    try:
        return parking_engine.get_analytics()
    except Exception as e:
        logger.error(f"Parking analytics error: {e}")
        raise HTTPException(status_code=500, detail=str(e))
