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
    POTHOLE = "pothole"            # broken road surface (cars, bikes, wheelchairs)
    ACCIDENT = "accident"          # sudden accident / vehicle breakdown
    CROWD = "crowd"                # sudden crowd / gathering / procession
    ROAD_BLOCKED = "road_blocked"  # road closed / impassable
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
    # anonymous per-browser id (random string kept in localStorage). Used only to stop
    # one device confirming the same report twice. Stored hashed.
    device_id: Optional[str] = Field(None, max_length=80)
    accuracy_m: Optional[float] = None   # GPS accuracy when the report was captured


class ConfirmRequest(BaseModel):
    device_id: str = Field(..., min_length=6, max_length=80)
    still_present: bool = True           # False = "it has been fixed"
    lat: float = Field(..., ge=-90, le=90)   # confirmer's own position (must be near the report)
    lng: float = Field(..., ge=-180, le=180)


class StatusUpdate(BaseModel):
    status: str                          # approved | rejected | flagged | resolved | investigating | reported


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