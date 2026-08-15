from pydantic import BaseModel, Field
from typing import Optional
from enum import Enum
from datetime import datetime


class IssueType(str, Enum):
    POOR_LIGHTING = "poor_lighting"
    UNSAFE_AREA = "unsafe_area"
    BROKEN_SIDEWALK = "broken_sidewalk"
    MISSING_RAMP = "missing_ramp"
    CONSTRUCTION = "construction"
    HARASSMENT = "harassment"
    FLOODING = "flooding"
    OBSTRUCTION = "obstruction"
    OTHER = "other"


class IssueSeverity(str, Enum):
    LOW = "low"
    MEDIUM = "medium"
    HIGH = "high"
    CRITICAL = "critical"


class ReportRequest(BaseModel):
    lat: float = Field(..., ge=-90, le=90)
    lng: float = Field(..., ge=-180, le=180)
    issue_type: IssueType
    severity: IssueSeverity = IssueSeverity.MEDIUM
    description: str = Field(..., min_length=10, max_length=500)
    anonymous: bool = True
    reporter_contact: Optional[str] = Field(None, max_length=120)
    address: Optional[str] = None


class ReportResponse(BaseModel):
    id: str
    lat: float
    lng: float
    issue_type: str
    severity: str
    description: str
    status: str
    created_at: str
    votes: int
    address: Optional[str] = None