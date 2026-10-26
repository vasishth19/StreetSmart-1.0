"""
Safety heatmap built from REAL community signals (reports + anonymised SOS).
The previous version generated random points around hard-coded New York
coordinates, which meant nothing for an Indian campus.
"""
import math
from typing import Dict, List

from app.services import community_signals as cs
from app.utils.geo_local import bbox_of

_RISK_TYPES = cs.SECURITY_TYPES | cs.ACCESS_TYPES | cs.LIGHT_TYPES | {"sos"}


class SafetyEngine:
    async def build(self, lat: float, lng: float, radius_km: float):
        box = bbox_of([[lng, lat]], radius_km * 1000)
        signals, status = await cs.load_signals(box)
        cell = 0.0015  # ~165 m grid
        grid: Dict[tuple, float] = {}
        for s in signals:
            if s.type not in _RISK_TYPES:
                continue
            w = {"harassment": 1.4, "unsafe_area": 1.2, "sos": 1.2, "poor_lighting": 0.9}.get(s.type, 0.7) * s.weight
            key = (round(s.lat / cell), round(s.lng / cell))
            grid[key] = grid.get(key, 0.0) + w
        points = [{"lat": k[0] * cell, "lng": k[1] * cell,
                   "intensity": round(min(1.0, v / 2.0), 3),
                   "risk_level": "HIGH" if v >= 1.2 else "MEDIUM" if v >= 0.6 else "LOW"}
                  for k, v in grid.items()]
        zones = [{"lat": p["lat"], "lng": p["lng"], "radius_m": 150, "risk_score": p["intensity"],
                  "label": "Community-reported risk area",
                  "color": "#FF3B3B" if p["intensity"] > 0.6 else "#FFB020"}
                 for p in points if p["intensity"] >= 0.3]
        n = max(1, len(points))
        stats = {"mean_risk": round(sum(p["intensity"] for p in points) / n, 3) if points else 0.0,
                 "max_risk": max((p["intensity"] for p in points), default=0.0),
                 "high_risk_count": sum(1 for p in points if p["risk_level"] == "HIGH"),
                 "total_points": len(points), "source": "community reports + SOS", "status": status}
        return points, zones, stats


safety_engine = SafetyEngine()
