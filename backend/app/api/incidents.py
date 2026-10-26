"""
Live incident feed + demo tools.

PULSE  — the browser polls /incidents/pulse for the area around the selected route
         (every ~25 s). When the digest changes (new / confirmed / resolved incident) the
         app silently re-runs route scoring and explains what changed. Polling is used
         instead of WebSockets because it works on free hosting without extra setup.

DEMO   — /demo/simulate drops a clearly-labelled SIMULATED incident on a route so judges
         can watch scoring + rerouting react. Simulated reports are tagged is_simulated,
         shown with a 🧪 label everywhere, and can be wiped with /demo/simulated.
"""
import asyncio
import hashlib
import logging
from datetime import datetime
from typing import Optional

from fastapi import APIRouter, HTTPException, Query
from pydantic import BaseModel, Field

from app.config import settings
from app.models.report import IssueType, IssueSeverity

router = APIRouter()
logger = logging.getLogger(__name__)


@router.get("/incidents/pulse")
async def incidents_pulse(min_lat: float, min_lng: float, max_lat: float, max_lng: float):
    """Cheap change-detector: digest of all active incidents inside the bounding box."""
    from app.services.supabase_client import supabase
    from app.services import community_signals as cs

    def _q():
        return (supabase.table("reports").select("*")
                .gte("lat", min_lat).lte("lat", max_lat).gte("lng", min_lng).lte("lng", max_lng)
                .limit(1500).execute().data) or []
    try:
        rows = await asyncio.to_thread(_q)
    except Exception as e:  # noqa: BLE001
        raise HTTPException(status_code=503, detail=f"incident store unavailable: {e}")
    live = [r for r in rows if cs.to_signal(r) is not None]
    parts = sorted(f"{r.get('id')}|{r.get('status')}|{r.get('confirmations') or 0}|{r.get('denials') or 0}|{r.get('verified')}" for r in live)
    digest = hashlib.sha1("\n".join(parts).encode()).hexdigest()[:16]
    latest = max(live, key=lambda r: str(r.get("created_at") or ""), default=None)
    return {
        "digest": digest, "active_count": len(live),
        "latest": ({"type": latest.get("issue_type"), "severity": latest.get("severity"),
                    "created_at": latest.get("created_at"), "simulated": bool(latest.get("is_simulated"))}
                   if latest else None),
        "checked_at": datetime.utcnow().isoformat(),
    }


class SimulateRequest(BaseModel):
    lat: float = Field(..., ge=-90, le=90)
    lng: float = Field(..., ge=-180, le=180)
    issue_type: IssueType = IssueType.POTHOLE
    severity: IssueSeverity = IssueSeverity.HIGH
    verified: bool = True          # simulated incidents default to "verified" so the effect is visible
    description: Optional[str] = "Simulated incident for demonstration"


@router.post("/demo/simulate")
async def simulate_incident(body: SimulateRequest):
    if not settings.ENABLE_DEMO_TOOLS:
        raise HTTPException(status_code=403, detail="Demo tools are disabled (set ENABLE_DEMO_TOOLS=true)")
    from app.services.supabase_client import supabase
    row = {
        "lat": body.lat, "lng": body.lng, "issue_type": body.issue_type.value, "severity": body.severity.value,
        "description": f"[SIMULATED] {body.description}", "status": "approved" if body.verified else "reported",
        "created_at": datetime.utcnow().isoformat(), "votes": 0, "anonymous": True, "address": "Simulated incident",
        "is_simulated": True, "verified": body.verified, "verified_by": "demo",
        "last_confirmed_at": datetime.utcnow().isoformat(),
    }
    try:
        res = supabase.table("reports").insert(row).execute()
    except Exception as e:  # noqa: BLE001
        raise HTTPException(status_code=500, detail=f"{e}  (did you run the v2.1 SQL migration?)")
    return {"simulated": True, "report": res.data[0]}


@router.delete("/demo/simulated")
async def clear_simulated():
    if not settings.ENABLE_DEMO_TOOLS:
        raise HTTPException(status_code=403, detail="Demo tools are disabled")
    from app.services.supabase_client import supabase
    try:
        res = supabase.table("reports").delete().eq("is_simulated", True).execute()
        return {"deleted": len(res.data or [])}
    except Exception as e:  # noqa: BLE001
        raise HTTPException(status_code=500, detail=str(e))
