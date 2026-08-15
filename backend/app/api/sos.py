from fastapi import APIRouter, Depends
from datetime import datetime
import logging
import os
from dotenv import load_dotenv
from supabase import create_client

load_dotenv()

from app.models.sos import SOSRequest
from app.api.auth import get_current_user
from app.services.supabase_client import supabase

router = APIRouter()
logger = logging.getLogger(__name__)


@router.post("/sos")
async def trigger_sos(body: SOSRequest, user=Depends(get_current_user)):
    """
    Logs an SOS event so it shows up on the admin/live dashboard.
    This endpoint is best-effort and NEVER blocks the client-side alert
    (SMS/WhatsApp to emergency contacts) which fires independently on
    the device regardless of whether this call succeeds.
    """
    record = {
        "user_id":       user["id"] if user else None,
        "lat":           body.lat,
        "lng":           body.lng,
        "accuracy":      body.accuracy,
        "contact_count": body.contact_count,
        "note":          body.note,
        "status":        "active",
        "created_at":    datetime.utcnow().isoformat(),
    }
    try:
        result = supabase.table("sos_alerts").insert(record).execute()
        return result.data[0]
    except Exception as e:
        # Never fail the SOS flow just because logging failed
        logger.error(f"SOS log error: {e}")
        return {**record, "id": "unlogged"}


@router.get("/sos")
async def list_sos_alerts(limit: int = 20):
    """Recent SOS alerts, for the admin dashboard."""
    try:
        result = (
            supabase.table("sos_alerts")
            .select("*")
            .order("created_at", desc=True)
            .limit(limit)
            .execute()
        )
        return result.data
    except Exception as e:
        logger.error(f"SOS list error: {e}")
        return []
