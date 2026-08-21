"""
StreetSmart – Parking Models
SIH1515: Smart and Effective Realtime Management of Street Parking

Pydantic schemas for parking zones, individual spots, dynamic pricing
and reservations.
"""
from pydantic import BaseModel, Field
from typing import Optional, List
from enum import Enum


class VehicleType(str, Enum):
    TWO_WHEELER = "two_wheeler"
    CAR = "car"
    SUV = "suv"
    COMMERCIAL = "commercial"


class SpotStatus(str, Enum):
    AVAILABLE = "available"
    OCCUPIED = "occupied"
    RESERVED = "reserved"
    DISABLED = "disabled"  # out of service (blocked, under repair, etc.)


class DemandLevel(str, Enum):
    LOW = "low"
    MODERATE = "moderate"
    HIGH = "high"
    SURGE = "surge"


class ParkingSpot(BaseModel):
    id: str
    zone_id: str
    label: str
    lat: float
    lng: float
    vehicle_type: VehicleType = VehicleType.CAR
    status: SpotStatus = SpotStatus.AVAILABLE
    base_price_per_hour: float
    current_price_per_hour: float
    covered: bool = False
    ev_charging: bool = False
    reserved_until: Optional[str] = None
    occupied_since: Optional[str] = None


class FacilityType(str, Enum):
    FORMAL   = "formal"    # gated/barriered — mall, IT park, railway station lot, multiplex
    INFORMAL = "informal"  # open street/market — no physical barrier, chaotic by nature


class DataSource(str, Enum):
    OPERATOR_VERIFIED = "operator_verified"  # real barrier/ANPR count from the facility operator
    COMMUNITY_REPORTED = "community_reported"  # crowdsourced check-in/check-out, confidence decays over time
    SIMULATED_DEMO = "simulated_demo"  # procedurally generated for demo purposes — not live data


class ParkingZone(BaseModel):
    id: str
    name: str
    area: str
    lat: float
    lng: float
    radius_m: float = 300
    total_spots: int
    available_spots: int
    occupancy_rate: float  # 0-1
    demand_level: DemandLevel
    facility_type: FacilityType = FacilityType.INFORMAL
    data_source: DataSource = DataSource.SIMULATED_DEMO
    avg_price_per_hour: float
    surge_multiplier: float = 1.0


class NearbySpotsResponse(BaseModel):
    zone: Optional[ParkingZone] = None
    spots: List[ParkingSpot]
    center: dict
    radius_km: float
    generated_at: str


class PricingQuote(BaseModel):
    spot_id: str
    base_price_per_hour: float
    price_per_hour: float
    surge_multiplier: float
    demand_level: DemandLevel
    occupancy_rate: float
    reasons: List[str]


class ReservationRequest(BaseModel):
    spot_id: str
    vehicle_number: str = Field(..., min_length=3, max_length=15)
    vehicle_type: VehicleType = VehicleType.CAR
    duration_minutes: int = Field(default=60, ge=15, le=720)
    user_id: Optional[str] = None


class ReservationResponse(BaseModel):
    id: str
    spot_id: str
    zone_id: str
    vehicle_number: str
    status: str
    price_per_hour: float
    duration_minutes: int
    estimated_total: float
    reserved_at: str
    expires_at: str


class ReservationCancelResponse(BaseModel):
    id: str
    status: str
    spot_id: str


class ParkingAnalytics(BaseModel):
    overview: dict
    zone_breakdown: List[dict]
    hourly_occupancy: List[dict]
    revenue_today: float
    demand_trend: str
