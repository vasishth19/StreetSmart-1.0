"""
Per-mode travel physics.

WHY THIS FILE EXISTS
--------------------
The old app used one speed for everybody (and the public OSRM demo server silently
returns *car* routes for foot/bike). Different travellers genuinely take different
times over the same 11 km, so every mode here has its own speed and its own
sensitivity to traffic, surface quality and community-reported obstacles.

Speeds are typical urban values, NOT measurements of your city. They are meant to
be calibrated: walk a known route with a GPS app, compare, and edit
`app/data/calibration.json` (time_multiplier per mode). That is the honest way to
push accuracy up, and it is what you can show mentors.
"""
from __future__ import annotations
import json
import os
from dataclasses import dataclass
from typing import Dict, Optional

from app.config import settings


@dataclass(frozen=True)
class ModeSpec:
    key: str
    label: str
    icon: str
    kind: str                # "foot" | "wheel" | "bike" | "motor"
    valhalla_costing: str    # pedestrian | bicycle | motorcycle | auto
    osrm_profile: str        # foot | bike | car  (FOSSGIS routed-<profile>)
    speed_kmh: float         # nominal moving speed (foot/wheel/bike); cap for motor
    traffic_exponent: float  # 0 = ignores traffic, 1 = full impact
    surface_sensitivity: float  # how strongly bad surfaces slow/penalise this mode
    priority: bool = False


MODES: Dict[str, ModeSpec] = {
    "walking":          ModeSpec("walking", "Walking", "🚶", "foot", "pedestrian", "foot", 5.0, 0.0, 0.5),
    "walking_elderly":  ModeSpec("walking_elderly", "Walking (senior)", "🧓", "foot", "pedestrian", "foot", 3.9, 0.0, 0.8),
    "walking_low_vision": ModeSpec("walking_low_vision", "Walking (low vision)", "🦯", "foot", "pedestrian", "foot", 3.8, 0.0, 0.8),
    "wheelchair":       ModeSpec("wheelchair", "Wheelchair", "♿", "wheel", "pedestrian", "foot", 3.6, 0.0, 1.0),
    "cycling":          ModeSpec("cycling", "Bicycle", "🚴", "bike", "bicycle", "bike", 14.0, 0.15, 0.8),
    "motorcycle":       ModeSpec("motorcycle", "Motorbike", "🏍️", "motor", "motorcycle", "car", 60.0, 0.55, 0.5),
    "car":              ModeSpec("car", "Car", "🚗", "motor", "auto", "car", 80.0, 1.0, 0.3),
    "ambulance":        ModeSpec("ambulance", "Ambulance", "🚑", "motor", "auto", "car", 80.0, 0.4, 0.2, True),
    "fire":             ModeSpec("fire", "Fire brigade", "🚒", "motor", "auto", "car", 70.0, 0.4, 0.2, True),
    "police":           ModeSpec("police", "Police", "🚓", "motor", "auto", "car", 80.0, 0.4, 0.2, True),
}

# Frontend sends these (hooks/useRoutes + VehicleModeSelector)
ALIASES = {
    "pedestrian": "walking", "walk": "walking", "foot": "walking",
    "bike": "motorcycle", "motorbike": "motorcycle", "scooter": "motorcycle",
    "bicycle": "cycling", "cycle": "cycling",
    "vehicle": "car", "driving": "car", "auto": "car",
}

PROFILE_TO_FOOT_MODE = {
    "wheelchair": "wheelchair",
    "elderly": "walking_elderly",
    "visually_impaired": "walking_low_vision",
}


def resolve_mode(travel_mode: Optional[str], user_profile: str = "general") -> ModeSpec:
    key = (travel_mode or "walking").lower()
    key = ALIASES.get(key, key)
    if key not in MODES:
        key = "walking"
    # An accessibility profile on a foot journey changes the physics too.
    if key == "walking" and user_profile in PROFILE_TO_FOOT_MODE:
        key = PROFILE_TO_FOOT_MODE[user_profile]
    return MODES[key]


# Default scoring weights per profile (same table the /score/profiles endpoint shows)
PROFILE_WEIGHTS = {
    "general":           {"safety": 0.35, "lighting": 0.25, "crowd": 0.20, "accessibility": 0.20},
    "woman":             {"safety": 0.45, "lighting": 0.30, "crowd": 0.15, "accessibility": 0.10},
    "elderly":           {"safety": 0.30, "lighting": 0.20, "crowd": 0.15, "accessibility": 0.35},
    "wheelchair":        {"safety": 0.25, "lighting": 0.15, "crowd": 0.10, "accessibility": 0.50},
    "visually_impaired": {"safety": 0.35, "lighting": 0.30, "crowd": 0.15, "accessibility": 0.20},
}

_CAL_PATH = os.path.join(os.path.dirname(os.path.dirname(__file__)), "data", "calibration.json")


def time_multiplier(mode_key: str) -> float:
    """User-tunable correction measured from real trips. 1.0 = no correction."""
    try:
        with open(_CAL_PATH) as f:
            return float(json.load(f).get("time_multiplier", {}).get(mode_key, 1.0))
    except Exception:
        return 1.0
