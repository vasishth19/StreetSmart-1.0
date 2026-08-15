from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel, Field
from typing import List
from datetime import datetime
import logging
import os
from dotenv import load_dotenv
from supabase import create_client
from .auth import get_current_user
from app.services.supabase_client import supabase

load_dotenv()

router = APIRouter(prefix="/reviews", tags=["reviews"])
logger = logging.getLogger(__name__)

class ReviewCreate(BaseModel):
    rating:  int = Field(..., ge=1, le=5)
    comment: str = Field(..., min_length=3, max_length=500)

class ReviewResponse(BaseModel):
    id:         int
    user_id:    int
    user_name:  str
    rating:     int
    comment:    str
    created_at: str

class ReviewsListResponse(BaseModel):
    reviews:    List[ReviewResponse]
    total:      int
    avg_rating: float

@router.get("", response_model=ReviewsListResponse)
async def list_reviews():
    try:
        result = supabase.table("reviews").select("*").order("id", desc=True).execute()
        reviews = result.data
        avg = sum(r["rating"] for r in reviews) / len(reviews) if reviews else 0
        return ReviewsListResponse(
            reviews=[ReviewResponse(**r) for r in reviews],
            total=len(reviews),
            avg_rating=round(avg, 2),
        )
    except Exception as e:
        logger.error(f"Reviews fetch error: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@router.post("", response_model=ReviewResponse)
async def create_review(body: ReviewCreate, user=Depends(get_current_user)):
    try:
        name = user["name"] if user else "Guest"
        uid  = user["id"]   if user else 0
        review = {
            "user_id":    uid,
            "user_name":  name,
            "rating":     body.rating,
            "comment":    body.comment,
            "created_at": datetime.utcnow().isoformat(),
        }
        result = supabase.table("reviews").insert(review).execute()
        return ReviewResponse(**result.data[0])
    except Exception as e:
        logger.error(f"Review creation error: {e}")
        raise HTTPException(status_code=500, detail=str(e))