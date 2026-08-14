from fastapi import APIRouter, HTTPException
from typing import List
from datetime import datetime
import logging
import os
from dotenv import load_dotenv
from supabase import create_client

load_dotenv()

from app.models.report import ReportRequest, ReportResponse

router = APIRouter()
logger = logging.getLogger(__name__)

SUPABASE_URL = os.getenv("SUPABASE_URL", "https://awoqphdurcbyshkcwllh.supabase.co")
SUPABASE_KEY = os.getenv("SUPABASE_KEY", "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImF3b3FwaGR1cmNieXNoa2N3bGxoIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NDIyMzk2MDksImV4cCI6MjA1NzgxNTYwOX0.xt4BgGCFMMyPSDEMENoFMBiADJOqbMEFfJblcBpD1wY")
supabase = create_client(SUPABASE_URL, SUPABASE_KEY)

@router.post("/reports")
async def submit_report(report: ReportRequest):
    try:
        new_report = {
            "lat":         report.lat,
            "lng":         report.lng,
            "issue_type":  report.issue_type.value,
            "severity":    report.severity.value,
            "description": report.description,
            "status":      "reported",
            "created_at":  datetime.utcnow().isoformat(),
            "votes":       0,
            "address":     report.address,
        }
        result = supabase.table("reports").insert(new_report).execute()
        return result.data[0]
    except Exception as e:
        logger.error(f"Report submission error: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@router.get("/reports")
async def get_reports(limit: int = 50, issue_type: str = None, severity: str = None):
    try:
        query = supabase.table("reports").select("*")
        if issue_type:
            query = query.eq("issue_type", issue_type)
        if severity:
            query = query.eq("severity", severity)
        result = query.order("created_at", desc=True).limit(limit).execute()
        return result.data
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@router.post("/reports/{report_id}/vote")
async def vote_report(report_id: str):
    try:
        result = supabase.table("reports").select("votes").eq("id", report_id).execute()
        if not result.data:
            raise HTTPException(status_code=404, detail="Report not found")
        votes = result.data[0]["votes"] + 1
        supabase.table("reports").update({"votes": votes}).eq("id", report_id).execute()
        return {"id": report_id, "votes": votes}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))