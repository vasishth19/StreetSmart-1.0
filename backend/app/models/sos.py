from pydantic import BaseModel, Field
from typing import Optional, List


class SOSContact(BaseModel):
    name: str = Field(..., max_length=80)
    phone: str = Field(..., max_length=20)


class SOSRequest(BaseModel):
    lat: float = Field(..., ge=-90, le=90)
    lng: float = Field(..., ge=-180, le=180)
    accuracy: Optional[float] = None
    contact_count: int = 0
    note: Optional[str] = Field(None, max_length=200)


class SOSResponse(BaseModel):
    id: str
    lat: float
    lng: float
    created_at: str
    contact_count: int
