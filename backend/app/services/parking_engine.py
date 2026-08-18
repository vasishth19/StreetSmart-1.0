"""
StreetSmart – Parking Engine
SIH1515: Smart and Effective Realtime Management of Street Parking

Responsibilities:
  - Load zone metadata and procedurally generate individual spots
  - Simulate realtime occupancy (time-of-day demand curve + jitter)
  - Compute demand-based dynamic pricing per spot
  - Handle reservations (hold a spot, release on expiry/cancel)

This mirrors the existing engine pattern (routing_engine / safety_engine):
an in-process singleton seeded from a JSON file in app/data, with
in-memory state for anything that needs to mutate at request time.
Reservations are additionally persisted to Supabase (parking_reservations)
for audit/history, the same way sos.py / reports.py persist their events —
but the engine never depends on that write succeeding for the live spot
map to keep working.
"""
import json
import math
import random
import logging
from datetime import datetime, timedelta
from typing import List, Optional, Dict
from uuid import uuid4

from app.config import settings
from app.models.parking import (
    ParkingSpot, ParkingZone, VehicleType, SpotStatus, DemandLevel,
)

logger = logging.getLogger(__name__)

DATA_FILE = f"{settings.DATA_DIR}/parking_zones.json"

# Peak windows (24h), roughly office/market rush hours — used for the
# time-of-day component of both occupancy and pricing.
PEAK_HOURS = [(9, 11), (17, 20)]


class ParkingEngine:
    def __init__(self):
        self._zones_meta: List[dict] = self._load_zones()
        self._spots: Dict[str, ParkingSpot] = {}
        self._zone_spot_ids: Dict[str, List[str]] = {}
        self._generate_spots()

    # ── Setup ─────────────────────────────────────────────────────

    def _load_zones(self) -> List[dict]:
        try:
            with open(DATA_FILE, "r") as f:
                return json.load(f)
        except Exception as e:
            logger.error(f"Failed to load parking_zones.json: {e}")
            return []

    def _generate_spots(self):
        """Procedurally scatter spots around each zone centre and give
        each an initial status, weighted by the current time-of-day
        demand so a fresh server boot still looks realistic."""
        for zone in self._zones_meta:
            rng = random.Random(zone["id"])  # deterministic per zone
            ids = []
            occ_prob = self._demand_curve(datetime.utcnow().hour)
            for i in range(zone["total_spots"]):
                spot_id = f"{zone['id']}_s{i+1:03d}"
                bearing = rng.uniform(0, 2 * math.pi)
                dist_m = rng.uniform(20, zone["radius_m"])
                lat, lng = self._offset_latlng(zone["lat"], zone["lng"], bearing, dist_m)

                vehicle_type = rng.choices(
                    [VehicleType.CAR, VehicleType.TWO_WHEELER, VehicleType.SUV, VehicleType.COMMERCIAL],
                    weights=[0.55, 0.30, 0.10, 0.05],
                )[0]
                is_occupied = rng.random() < occ_prob
                base_price = zone["base_price_per_hour"] * (0.5 if vehicle_type == VehicleType.TWO_WHEELER else 1.0)

                spot = ParkingSpot(
                    id=spot_id,
                    zone_id=zone["id"],
                    label=f"{zone['name']} · Spot {i+1}",
                    lat=lat,
                    lng=lng,
                    vehicle_type=vehicle_type,
                    status=SpotStatus.OCCUPIED if is_occupied else SpotStatus.AVAILABLE,
                    base_price_per_hour=round(base_price, 2),
                    current_price_per_hour=round(base_price, 2),
                    covered=rng.random() < 0.15,
                    ev_charging=rng.random() < 0.08,
                    occupied_since=datetime.utcnow().isoformat() if is_occupied else None,
                )
                self._spots[spot_id] = spot
                ids.append(spot_id)
            self._zone_spot_ids[zone["id"]] = ids

    @staticmethod
    def _offset_latlng(lat: float, lng: float, bearing: float, dist_m: float) -> (float, float):
        R = 6371000
        lat1, lng1 = math.radians(lat), math.radians(lng)
        lat2 = math.asin(
            math.sin(lat1) * math.cos(dist_m / R) +
            math.cos(lat1) * math.sin(dist_m / R) * math.cos(bearing)
        )
        lng2 = lng1 + math.atan2(
            math.sin(bearing) * math.sin(dist_m / R) * math.cos(lat1),
            math.cos(dist_m / R) - math.sin(lat1) * math.sin(lat2),
        )
        return math.degrees(lat2), math.degrees(lng2)

    @staticmethod
    def _demand_curve(hour: int) -> float:
        """Base occupancy probability 0-1 for a given hour of day."""
        for start, end in PEAK_HOURS:
            if start <= hour < end:
                return 0.82
        if 7 <= hour < 22:
            return 0.5
        return 0.15

    def _distance_km(self, lat1, lng1, lat2, lng2) -> float:
        R = 6371
        dlat = math.radians(lat2 - lat1)
        dlng = math.radians(lng2 - lng1)
        a = (math.sin(dlat / 2) ** 2 + math.cos(math.radians(lat1)) *
             math.cos(math.radians(lat2)) * math.sin(dlng / 2) ** 2)
        return R * 2 * math.asin(math.sqrt(a))

    # ── Live state / drift ───────────────────────────────────────

    def _tick_zone(self, zone_id: str):
        """Nudge a handful of spots toward the current demand level on
        every read, so occupancy drifts realistically without a
        background scheduler."""
        occ_prob = self._demand_curve(datetime.utcnow().hour)
        ids = self._zone_spot_ids.get(zone_id, [])
        sample = random.sample(ids, k=max(1, len(ids) // 6)) if ids else []
        for sid in sample:
            spot = self._spots[sid]
            if spot.status in (SpotStatus.RESERVED, SpotStatus.DISABLED):
                continue
            if spot.status == SpotStatus.RESERVED and spot.reserved_until:
                continue
            flips_to_occupied = random.random() < occ_prob
            if flips_to_occupied and spot.status == SpotStatus.AVAILABLE:
                spot.status = SpotStatus.OCCUPIED
                spot.occupied_since = datetime.utcnow().isoformat()
            elif not flips_to_occupied and spot.status == SpotStatus.OCCUPIED:
                spot.status = SpotStatus.AVAILABLE
                spot.occupied_since = None
        self._release_expired_reservations(zone_id)
        self._reprice_zone(zone_id)

    def _release_expired_reservations(self, zone_id: str):
        now = datetime.utcnow()
        for sid in self._zone_spot_ids.get(zone_id, []):
            spot = self._spots[sid]
            if spot.status == SpotStatus.RESERVED and spot.reserved_until:
                if datetime.fromisoformat(spot.reserved_until) <= now:
                    spot.status = SpotStatus.AVAILABLE
                    spot.reserved_until = None

    # ── Pricing ──────────────────────────────────────────────────

    def _occupancy_rate(self, zone_id: str) -> float:
        ids = self._zone_spot_ids.get(zone_id, [])
        if not ids:
            return 0.0
        taken = sum(1 for sid in ids if self._spots[sid].status in (SpotStatus.OCCUPIED, SpotStatus.RESERVED))
        return round(taken / len(ids), 3)

    def _demand_level(self, occupancy_rate: float) -> DemandLevel:
        if occupancy_rate >= 0.9:
            return DemandLevel.SURGE
        if occupancy_rate >= 0.7:
            return DemandLevel.HIGH
        if occupancy_rate >= 0.4:
            return DemandLevel.MODERATE
        return DemandLevel.LOW

    def _surge_multiplier(self, occupancy_rate: float, hour: int) -> float:
        """Core dynamic-pricing formula. Occupancy is the dominant
        signal (empty streets stay cheap; near-full zones get
        expensive fast to free up turnover); a smaller time-of-day
        term nudges peak-hour prices up even before a zone fills."""
        if occupancy_rate < 0.4:
            occ_mult = 0.8
        elif occupancy_rate < 0.7:
            occ_mult = 1.0
        elif occupancy_rate < 0.9:
            occ_mult = 1.0 + (occupancy_rate - 0.7) * 3.0       # 1.0 → 1.6
        else:
            occ_mult = 1.6 + (occupancy_rate - 0.9) * 9.0        # 1.6 → 2.5

        peak = any(start <= hour < end for start, end in PEAK_HOURS)
        time_mult = 1.15 if peak else 1.0

        return round(min(occ_mult * time_mult, 2.5), 2)

    def _reprice_zone(self, zone_id: str):
        occupancy = self._occupancy_rate(zone_id)
        multiplier = self._surge_multiplier(occupancy, datetime.utcnow().hour)
        for sid in self._zone_spot_ids.get(zone_id, []):
            spot = self._spots[sid]
            spot.current_price_per_hour = round(spot.base_price_per_hour * multiplier, 2)

    def get_pricing_quote(self, spot_id: str) -> Optional[dict]:
        spot = self._spots.get(spot_id)
        if not spot:
            return None
        self._tick_zone(spot.zone_id)
        occupancy = self._occupancy_rate(spot.zone_id)
        multiplier = self._surge_multiplier(occupancy, datetime.utcnow().hour)
        demand = self._demand_level(occupancy)
        reasons = [f"Zone occupancy at {int(occupancy * 100)}%"]
        if any(start <= datetime.utcnow().hour < end for start, end in PEAK_HOURS):
            reasons.append("Peak hour surcharge applied")
        if multiplier <= 0.85:
            reasons.append("Off-peak discount applied")
        return {
            "spot_id": spot_id,
            "base_price_per_hour": spot.base_price_per_hour,
            "price_per_hour": round(spot.base_price_per_hour * multiplier, 2),
            "surge_multiplier": multiplier,
            "demand_level": demand,
            "occupancy_rate": occupancy,
            "reasons": reasons,
        }

    # ── Public read API ──────────────────────────────────────────

    def list_zones(self) -> List[ParkingZone]:
        zones = []
        for meta in self._zones_meta:
            self._tick_zone(meta["id"])
            occupancy = self._occupancy_rate(meta["id"])
            ids = self._zone_spot_ids.get(meta["id"], [])
            available = sum(1 for sid in ids if self._spots[sid].status == SpotStatus.AVAILABLE)
            avg_price = (
                sum(self._spots[sid].current_price_per_hour for sid in ids) / len(ids)
                if ids else 0
            )
            zones.append(ParkingZone(
                id=meta["id"],
                name=meta["name"],
                area=meta["area"],
                lat=meta["lat"],
                lng=meta["lng"],
                radius_m=meta["radius_m"],
                total_spots=meta["total_spots"],
                available_spots=available,
                occupancy_rate=occupancy,
                demand_level=self._demand_level(occupancy),
                avg_price_per_hour=round(avg_price, 2),
                surge_multiplier=self._surge_multiplier(occupancy, datetime.utcnow().hour),
            ))
        return zones

    def get_nearby_spots(self, lat: float, lng: float, radius_km: float = 1.0, limit: int = 60) -> List[ParkingSpot]:
        # Tick every zone within a generous range so results reflect live state
        for meta in self._zones_meta:
            if self._distance_km(lat, lng, meta["lat"], meta["lng"]) <= radius_km + (meta["radius_m"] / 1000):
                self._tick_zone(meta["id"])

        results = []
        for spot in self._spots.values():
            if self._distance_km(lat, lng, spot.lat, spot.lng) <= radius_km:
                results.append(spot)
        results.sort(key=lambda s: (s.status != SpotStatus.AVAILABLE, self._distance_km(lat, lng, s.lat, s.lng)))
        return results[:limit]

    def get_zone(self, zone_id: str) -> Optional[ParkingZone]:
        zones = self.list_zones()
        return next((z for z in zones if z.id == zone_id), None)

    def get_spot(self, spot_id: str) -> Optional[ParkingSpot]:
        return self._spots.get(spot_id)

    # ── Reservations ─────────────────────────────────────────────

    def reserve_spot(self, spot_id: str, duration_minutes: int) -> Optional[dict]:
        spot = self._spots.get(spot_id)
        if not spot:
            return {"error": "not_found"}
        self._tick_zone(spot.zone_id)
        if spot.status != SpotStatus.AVAILABLE:
            return {"error": "unavailable", "status": spot.status.value}

        quote = self.get_pricing_quote(spot_id)
        now = datetime.utcnow()
        expires = now + timedelta(minutes=duration_minutes)

        spot.status = SpotStatus.RESERVED
        spot.reserved_until = expires.isoformat()

        reservation_id = str(uuid4())
        return {
            "id": reservation_id,
            "spot_id": spot_id,
            "zone_id": spot.zone_id,
            "status": "confirmed",
            "price_per_hour": quote["price_per_hour"],
            "duration_minutes": duration_minutes,
            "estimated_total": round(quote["price_per_hour"] * (duration_minutes / 60), 2),
            "reserved_at": now.isoformat(),
            "expires_at": expires.isoformat(),
        }

    def cancel_reservation(self, spot_id: str) -> Optional[dict]:
        spot = self._spots.get(spot_id)
        if not spot:
            return None
        if spot.status == SpotStatus.RESERVED:
            spot.status = SpotStatus.AVAILABLE
            spot.reserved_until = None
        return {"spot_id": spot_id, "status": "released"}

    # ── Analytics ────────────────────────────────────────────────

    def get_analytics(self) -> dict:
        zones = self.list_zones()
        total_spots = sum(z.total_spots for z in zones)
        total_available = sum(z.available_spots for z in zones)
        overall_occupancy = round(1 - (total_available / total_spots), 3) if total_spots else 0

        hour = datetime.utcnow().hour
        hourly_occupancy = [
            {"hour": h, "occupancy": round(self._demand_curve(h) * 100 + random.uniform(-4, 4), 1)}
            for h in range(24)
        ]

        # Rough same-day revenue estimate from currently reserved/occupied spots
        revenue_today = 0.0
        for spot in self._spots.values():
            if spot.status in (SpotStatus.OCCUPIED, SpotStatus.RESERVED):
                revenue_today += spot.current_price_per_hour * random.uniform(0.5, 2.5)

        return {
            "overview": {
                "total_zones": len(zones),
                "total_spots": total_spots,
                "available_spots": total_available,
                "overall_occupancy_rate": overall_occupancy,
                "avg_price_per_hour": round(
                    sum(z.avg_price_per_hour for z in zones) / len(zones), 2
                ) if zones else 0,
            },
            "zone_breakdown": [
                {
                    "id": z.id, "name": z.name, "occupancy_rate": z.occupancy_rate,
                    "demand_level": z.demand_level.value, "available_spots": z.available_spots,
                    "total_spots": z.total_spots, "avg_price_per_hour": z.avg_price_per_hour,
                }
                for z in zones
            ],
            "hourly_occupancy": hourly_occupancy,
            "revenue_today": round(revenue_today, 2),
            "demand_trend": "+12.4%" if self._demand_curve(hour) > 0.6 else "-3.1%",
        }


# Singleton
parking_engine = ParkingEngine()
