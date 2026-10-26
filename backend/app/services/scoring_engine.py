"""
Kept for backwards compatibility. The old version generated scores with random
noise; scoring is now done by app.services.safety_model from real evidence.
Only the deterministic helpers remain here.
"""
from typing import Dict

from app.services.mode_profiles import PROFILE_WEIGHTS


class ScoringEngine:
    def compute_composite_score(self, safety: float, lighting: float, crowd: float,
                                accessibility: float, weights: Dict[str, float] = None) -> float:
        w = dict(weights or PROFILE_WEIGHTS["general"])
        tot = sum(w.get(k, 0) for k in ("safety", "lighting", "crowd", "accessibility")) or 1.0
        val = (w.get("safety", 0) * safety + w.get("lighting", 0) * lighting
               + w.get("crowd", 0) * crowd + w.get("accessibility", 0) * accessibility) / tot
        return float(max(0.0, min(100.0, val)))

    def get_risk_level(self, composite_score: float) -> str:
        return "LOW" if composite_score >= 70 else "MEDIUM" if composite_score >= 50 else "HIGH"


scoring_engine = ScoringEngine()
