from pydantic import BaseModel, Field
from typing import List, Optional, Dict, Any
from enum import Enum


class UserProfile(str, Enum):
    GENERAL = "general"
    WOMAN = "woman"
    ELDERLY = "elderly"
    WHEELCHAIR = "wheelchair"
    VISUALLY_IMPAIRED = "visually_impaired"


class TransportMode(str, Enum):
    # kept for backwards compatibility with older clients
    WALKING = "walking"
    CYCLING = "cycling"
    DRIVING = "driving"


class Coordinates(BaseModel):
    lat: float = Field(..., ge=-90, le=90)
    lng: float = Field(..., ge=-180, le=180)


class RoutePreferences(BaseModel):
    user_profile: UserProfile = UserProfile.GENERAL
    transport_mode: TransportMode = TransportMode.WALKING
    # NEW: precise mode. walking | wheelchair | cycling | motorcycle | car |
    # ambulance | fire | police  (aliases like "pedestrian" are accepted)
    travel_mode: Optional[str] = None
    # NEW: ISO-8601 departure time (defaults to "now"). Drives day/night + traffic.
    departure_time: Optional[str] = None
    avoid_stairs: bool = False
    avoid_crowds: bool = False
    prefer_lit: bool = True
    prefer_cameras: bool = False
    max_distance_km: float = Field(default=10.0, ge=0.1, le=100.0)
    # If True (default) the profile's own weight table is used and the four
    # weights below are ignored. Set False to apply custom weights.
    use_profile_weights: bool = True
    weight_safety: float = Field(default=0.35, ge=0.0, le=1.0)
    weight_lighting: float = Field(default=0.25, ge=0.0, le=1.0)
    weight_crowd: float = Field(default=0.20, ge=0.0, le=1.0)
    weight_accessibility: float = Field(default=0.20, ge=0.0, le=1.0)


class RouteRequest(BaseModel):
    origin: Coordinates
    destination: Coordinates
    preferences: RoutePreferences = RoutePreferences()


class RouteScores(BaseModel):
    overall: float = Field(..., ge=0, le=100)
    safety: float = Field(..., ge=0, le=100)
    lighting: float = Field(..., ge=0, le=100)
    crowd: float = Field(..., ge=0, le=100)
    accessibility: float = Field(..., ge=0, le=100)
    risk_level: str  # LOW, MEDIUM, HIGH


class RouteSegment(BaseModel):
    coordinates: List[List[float]]
    distance_m: float
    duration_s: float
    street_name: str = ""
    safety_score: float = 0
    lighting_level: str = "UNKNOWN"   # BRIGHT, MODERATE, DIM, UNKNOWN
    has_cctv: bool = False
    is_accessible: bool = True
    surface_type: str = "unknown"
    # NEW
    quality: str = "unknown"          # good | fair | poor | unknown  (overall, for colouring)
    traffic: Optional[str] = None     # free | moderate | heavy  (road vehicles only)
    traffic_ratio: Optional[float] = None  # current speed / free-flow speed
    color: Optional[str] = None       # ready-to-draw colour for this stretch
    issues: List[str] = []


class EtaBreakdown(BaseModel):
    mode: str
    mode_label: str
    speed_basis: str                  # human-readable: how the time was computed
    moving_min: float
    delay_min: float = 0              # traffic / obstacle delay
    total_min: float
    traffic_source: Optional[str] = None   # live | estimated | none
    range_min: List[float] = []       # honest uncertainty band [low, high]


class Hazard(BaseModel):
    kind: str                         # community | osm | sos_cluster
    type: str
    severity: str = "medium"
    lat: float
    lng: float
    label: str
    along_m: float = 0
    trust: Optional[float] = None
    age_days: Optional[float] = None
    verified: bool = False
    report_id: Optional[str] = None
    simulated: bool = False           # demo incident — always labelled in the UI


class DataQuality(BaseModel):
    osm_status: str = "unavailable"   # ok | cached | warming | unavailable
    community_status: str = "unavailable"  # ok | unavailable
    traffic_source: str = "none"      # live | estimated | none
    routing_provider: str = ""
    lighting_coverage_pct: float = 0
    surface_coverage_pct: float = 0
    safety_evidence_pct: float = 0
    community_reports_used: int = 0
    notes: List[str] = []


class RouteResult(BaseModel):
    id: str
    name: str
    description: str
    coordinates: List[List[float]]
    segments: List[RouteSegment]
    scores: RouteScores
    distance_km: float
    duration_min: float
    waypoints: List[Coordinates]
    audio_instructions: List[str]
    warnings: List[str]
    highlights: List[str]
    color: str  # Neon color for map display
    rank: int
    # NEW (all optional so old clients keep working)
    mode: Optional[str] = None
    eta: Optional[EtaBreakdown] = None
    hazards: List[Hazard] = []
    why: List[str] = []
    draw_style: str = "solid"         # "dotted" for foot/wheelchair, "solid" for vehicles
    data_quality: Optional[DataQuality] = None
    is_night: bool = False
    blocked: bool = False             # passes through a verified closure


class RoutesResponse(BaseModel):
    routes: List[RouteResult]
    origin: Coordinates
    destination: Coordinates
    recommended_route_id: str
    total_routes: int
    generated_at: str
    # NEW
    mode: Optional[str] = None
    is_night: bool = False
    data_quality: Optional[DataQuality] = None
