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