from fastapi import APIRouter, Depends, File, HTTPException, Query, UploadFile
from typing import List, Optional
from datetime import datetime, timezone
import asyncio
import hashlib
import logging
import math

from app.config import settings
from app.api.admin import require_admin
from app.models.report import ConfirmRequest, ReportRequest, StatusUpdate
from app.services.supabase_client import supabase
from app.services import community_signals as cs
from app.utils.geo_local import haversine_m

router = APIRouter()
logger = logging.getLogger(__name__)

PRIVATE_FIELDS = ("reporter_contact", "device_hash")
VALID_STATUS = {"reported", "approved", "rejected", "flagged", "resolved", "investigating"}
CONFIRM_RADIUS_M = 150          # you must be near the problem to confirm / deny it
AUTO_VERIFY_CONFIRMS = 3        # distinct nearby people needed to auto-verify
AUTO_RESOLVE_DENIALS = 3


def _hash_device(device_id: str) -> str:
    return hashlib.sha256((settings.SECRET_KEY + "|" + device_id).encode()).hexdigest()[:32]


DUPLICATE_RADIUS_M = 30         # same type this close = same incident


def _clean(row: dict) -> dict:
    """Strip private fields and add the validation info the PDF asks for."""
    for f in PRIVATE_FIELDS:
        row.pop(f, None)
    try:
        sig = cs.to_signal(row)
        trust = cs.report_trust(row)
        row["confidence"] = round(trust, 2)
        row["confidence_label"] = "verified" if trust >= 0.85 else "corroborated" if trust >= 0.6 else "unverified"
        row["active"] = sig is not None          # False once it has expired / been rejected / resolved
        row["age_days"] = round(sig.age_days, 2) if sig else None
    except Exception:  # noqa: BLE001
        pass
    return row


@router.post("/reports")
async def submit_report(report: ReportRequest):
    try:
        new_report = {
            "lat": report.lat,
            "lng": report.lng,
            "issue_type": report.issue_type.value,
            "severity": report.severity.value,
            "description": report.description,
            "status": "reported",
            "created_at": datetime.utcnow().isoformat(),
            "votes": 0,
            "address": report.address,
            "anonymous": report.anonymous,
            # Never store contact info for anonymous reports, even if one was sent
            "reporter_contact": None if report.anonymous else report.reporter_contact,
        }
        # ── Duplicate detection: same incident type within 30 m that is still open = corroboration,
        #    not a new row. (Stops one pothole becoming 20 pins, and counts as independent evidence.)
        try:
            dlat = DUPLICATE_RADIUS_M / 111_320.0
            dlng = DUPLICATE_RADIUS_M / (111_320.0 * max(0.01, math.cos(math.radians(report.lat))))
            cands = (supabase.table("reports").select("*").eq("issue_type", report.issue_type.value)
                     .gte("lat", report.lat - dlat).lte("lat", report.lat + dlat)
                     .gte("lng", report.lng - dlng).lte("lng", report.lng + dlng).limit(20).execute().data) or []
            for c in cands:
                if (c.get("status") or "reported") in ("rejected", "resolved"):
                    continue
                if c.get("is_simulated"):
                    continue
                if cs.to_signal(c) is None:
                    continue                      # expired -> treat as a fresh report
                if haversine_m(report.lat, report.lng, c["lat"], c["lng"]) <= DUPLICATE_RADIUS_M:
                    same_device = report.device_id and c.get("device_hash") == _hash_device(report.device_id)
                    if not same_device:
                        upd = {"confirmations": (c.get("confirmations") or 0) + 1,
                               "last_confirmed_at": datetime.utcnow().isoformat()}
                        if upd["confirmations"] >= AUTO_VERIFY_CONFIRMS and (c.get("status") or "reported") in ("reported", "pending", "flagged"):
                            upd.update({"verified": True, "status": "approved", "verified_by": "community"})
                        try:
                            supabase.table("reports").update(upd).eq("id", c["id"]).execute()
                            c.update(upd)
                        except Exception:  # noqa: BLE001
                            pass
                    out = _clean(c)
                    out["duplicate"] = True
                    return out
        except Exception as e:  # noqa: BLE001
            logger.info("duplicate check skipped: %s", e)

        # Columns added by supabase_migration_v2.sql — written only if the client sent them
        if report.device_id:
            new_report["device_hash"] = _hash_device(report.device_id)
        if report.accuracy_m is not None:
            new_report["accuracy_m"] = report.accuracy_m
        try:
            result = supabase.table("reports").insert(new_report).execute()
        except Exception as e:
            # migration not run yet -> retry with the original columns only
            if "column" in str(e).lower():
                for k in ("device_hash", "accuracy_m"):
                    new_report.pop(k, None)
                result = supabase.table("reports").insert(new_report).execute()
            else:
                raise
        return _clean(result.data[0])
    except Exception as e:
        logger.error(f"Report submission error: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/reports")
async def get_reports(limit: int = 200, issue_type: str = None, severity: str = None, status: str = None):
    try:
        query = supabase.table("reports").select("*")
        if issue_type:
            query = query.eq("issue_type", issue_type)
        if severity:
            query = query.eq("severity", severity)
        if status:
            query = query.eq("status", status)
        result = query.order("created_at", desc=True).limit(limit).execute()
        return [_clean(r) for r in result.data]
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/reports/nearby")
async def nearby_reports(lat: float, lng: float, radius_m: float = Query(80, le=500),
                         device_id: Optional[str] = None, limit: int = 5):
    """Open reports around a point — powers the 'is this still broken?' prompt."""
    try:
        dlat = radius_m / 111_320.0
        dlng = radius_m / (111_320.0 * max(0.01, math.cos(math.radians(lat))))
        rows = (supabase.table("reports").select("*")
                .gte("lat", lat - dlat).lte("lat", lat + dlat)
                .gte("lng", lng - dlng).lte("lng", lng + dlng)
                .limit(100).execute().data) or []
        rows = [r for r in rows if (r.get("status") or "reported") not in ("rejected", "resolved")
                and haversine_m(lat, lng, r["lat"], r["lng"]) <= radius_m]
        if device_id:
            dh = _hash_device(device_id)
            rows = [r for r in rows if r.get("device_hash") != dh]
            try:
                done = supabase.table("report_confirmations").select("report_id").eq("device_hash", dh).execute().data or []
                answered = {str(d["report_id"]) for d in done}
                rows = [r for r in rows if str(r["id"]) not in answered]
            except Exception:
                pass
        rows.sort(key=lambda r: haversine_m(lat, lng, r["lat"], r["lng"]))
        return [_clean(r) for r in rows[:limit]]
    except Exception as e:
        logger.warning("nearby reports failed: %s", e)
        return []


@router.post("/reports/{report_id}/confirm")
async def confirm_report(report_id: str, body: ConfirmRequest):
    """
    One-tap crowd verification: "still there" (+1) or "it's fixed" (-1).
    Only people physically near the spot (150 m) can answer, one answer per device.
    3 independent 'still there' answers auto-verify the report — no admin needed.
    """
    try:
        res = supabase.table("reports").select("*").eq("id", report_id).execute()
        if not res.data:
            raise HTTPException(status_code=404, detail="Report not found")
        rep = res.data[0]
        if haversine_m(body.lat, body.lng, rep["lat"], rep["lng"]) > CONFIRM_RADIUS_M:
            raise HTTPException(status_code=403, detail=f"You need to be within {CONFIRM_RADIUS_M} m of the spot to confirm it")
        dh = _hash_device(body.device_id)
        if rep.get("device_hash") == dh:
            raise HTTPException(status_code=409, detail="You reported this one — others need to confirm it")
        prior = supabase.table("report_confirmations").select("id").eq("report_id", report_id).eq("device_hash", dh).execute().data
        if prior:
            raise HTTPException(status_code=409, detail="This device has already answered")
        supabase.table("report_confirmations").insert({
            "report_id": int(report_id) if str(report_id).isdigit() else report_id,
            "device_hash": dh, "still_present": body.still_present,
            "created_at": datetime.utcnow().isoformat()}).execute()

        rows = supabase.table("report_confirmations").select("still_present").eq("report_id", report_id).execute().data or []
        conf = sum(1 for r in rows if r["still_present"])
        den = sum(1 for r in rows if not r["still_present"])
        upd = {"confirmations": conf, "denials": den}
        if body.still_present:
            upd["last_confirmed_at"] = datetime.utcnow().isoformat()
        status = rep.get("status") or "reported"
        if status in ("reported", "pending", "flagged") and conf >= AUTO_VERIFY_CONFIRMS and den * 2 < conf:
            upd.update({"verified": True, "status": "approved", "verified_by": "community"})
            status = "approved"
        elif den >= AUTO_RESOLVE_DENIALS and den > conf and status != "resolved":
            upd.update({"status": "resolved", "verified_by": "community"})
            status = "resolved"
        supabase.table("reports").update(upd).eq("id", report_id).execute()
        return {"id": report_id, "confirmations": conf, "denials": den, "status": status,
                "verified": bool(upd.get("verified") or rep.get("verified"))}
    except HTTPException:
        raise
    except Exception as e:
        logger.error("confirm error: %s", e)
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/reports/{report_id}/vote")
async def vote_report(report_id: str):
    """Legacy +1 (kept so existing buttons keep working)."""
    try:
        result = supabase.table("reports").select("votes").eq("id", report_id).execute()
        if not result.data:
            raise HTTPException(status_code=404, detail="Report not found")
        votes = (result.data[0].get("votes") or 0) + 1
        supabase.table("reports").update({"votes": votes}).eq("id", report_id).execute()
        return {"id": report_id, "votes": votes}
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.patch("/reports/{report_id}/status")
async def set_report_status(report_id: str, body: StatusUpdate, _admin=Depends(require_admin)):
    """Admin only. This is what the Approve / Reject / Flag buttons now call."""
    if body.status not in VALID_STATUS:
        raise HTTPException(status_code=422, detail=f"status must be one of {sorted(VALID_STATUS)}")
    try:
        upd = {"status": body.status}
        if body.status == "approved":
            upd.update({"verified": True, "verified_by": "admin"})
        try:
            res = supabase.table("reports").update(upd).eq("id", report_id).execute()
        except Exception as e:
            if "column" in str(e).lower():     # migration not run: status only
                res = supabase.table("reports").update({"status": body.status}).eq("id", report_id).execute()
            else:
                raise
        if not res.data:
            raise HTTPException(status_code=404, detail="Report not found")
        return _clean(res.data[0])
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/reports/{report_id}/media")
async def upload_report_media(report_id: str, files: List[UploadFile] = File(...)):
    """
    Optional photo evidence (never required). Needs a PUBLIC storage bucket named
    'report-media' in Supabase (see docs/SETUP_V2.md).
    """
    urls: List[str] = []
    try:
        for f in files[:5]:
            if f.content_type not in ("image/jpeg", "image/png", "image/webp"):
                continue
            data = await f.read()
            if len(data) > 6 * 1024 * 1024:
                continue
            ext = {"image/jpeg": "jpg", "image/png": "png", "image/webp": "webp"}[f.content_type]
            path = f"{report_id}/{hashlib.sha1(data).hexdigest()[:16]}.{ext}"
            await asyncio.to_thread(lambda: supabase.storage.from_("report-media").upload(path, data, {"content-type": f.content_type}))
            urls.append(await asyncio.to_thread(lambda: supabase.storage.from_("report-media").get_public_url(path)))
        if urls:
            supabase.table("reports").update({"photo_urls": urls}).eq("id", report_id).execute()
        return {"id": report_id, "photo_urls": urls}
    except Exception as e:
        logger.warning("media upload failed: %s", e)
        raise HTTPException(status_code=500, detail=f"Photo upload failed: {e}")
