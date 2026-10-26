from pydantic_settings import BaseSettings
from typing import List
import json
import os


class Settings(BaseSettings):
    # App
    APP_NAME: str = "StreetSmart API"
    APP_VERSION: str = "1.0.0"
    DEBUG: bool = True

    # Database
    DATABASE_URL: str = "postgresql://streetsmart:streetsmart123@localhost:5432/streetsmart_db"

    # Security
    SECRET_KEY: str = "neon-noir-smart-city-secret-key-2024"
    ALGORITHM: str = "HS256"
    ACCESS_TOKEN_EXPIRE_MINUTES: int = 30

    # Mapbox
    MAPBOX_SECRET_TOKEN: str = ""
    NEXT_PUBLIC_MAPBOX_TOKEN: str = ""

    # Supabase — set these in backend/.env. The project this URL/key
    # pointed to previously no longer resolves (deleted/expired), so a
    # fresh Supabase project's credentials MUST be supplied via .env.
    SUPABASE_URL: str = ""
    SUPABASE_KEY: str = ""

    # ── Real routing / data providers (all free, no key needed unless noted) ──
    # Valhalla + OSRM are the community-run FOSSGIS servers. Fine for a demo /
    # hackathon; for production self-host them (see docs/DATA_SOURCES.md).
    VALHALLA_URL: str = "https://valhalla1.openstreetmap.de"
    OSRM_URL: str = "https://routing.openstreetmap.de"
    OVERPASS_URLS: str = "https://overpass-api.de/api/interpreter,https://overpass.private.coffee/api/interpreter"
    HTTP_USER_AGENT: str = "StreetSmart/2.0 (SIH2026 student project; contact: set-HTTP_USER_AGENT-env)"
    OSM_CACHE_DIR: str = os.path.join(os.path.dirname(os.path.dirname(__file__)), ".cache", "osm")
    OSM_CACHE_TTL_HOURS: int = 24 * 7

    # Optional: LIVE traffic. Free key from https://developer.tomtom.com
    # Without it the app shows *estimated* traffic and labels it as estimated.
    TOMTOM_API_KEY: str = ""

    # Local timezone offset (minutes) used to decide day/night + rush hour. IST = +330
    LOCAL_UTC_OFFSET_MIN: int = 330

    # Optional prior from official city-level statistics (0 = neutral). Street-level
    # crime data is not public in India, so this is the only place NCRB-style
    # numbers can enter, and it is OFF by default.
    CITY_RISK_PRIOR: float = 0.0

    # Demo tools (simulate an incident on a route for judges). Turn OFF after the demo.
    ENABLE_DEMO_TOOLS: bool = True

    # Admin panel login (set these on Render!). If unset, legacy demo credentials
    # are used and a warning is logged.
    ADMIN_EMAIL: str = ""
    ADMIN_PASSWORD: str = ""

    # CORS
    BACKEND_CORS_ORIGINS: str = '["http://localhost:3000","http://127.0.0.1:3000"]'

    @property
    def cors_origins(self) -> List[str]:
        try:
            return json.loads(self.BACKEND_CORS_ORIGINS)
        except Exception:
            return ["http://localhost:3000"]

    # ML
    ML_MODEL_PATH: str = "./ml/models/safety_model.pkl"
    ENABLE_ML_SCORING: bool = True

    # Data paths
    DATA_DIR: str = os.path.join(os.path.dirname(__file__), "data")

    class Config:
        env_file = ".env"
        case_sensitive = True
        extra = "allow"


settings = Settings()