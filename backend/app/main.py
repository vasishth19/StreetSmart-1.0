"""
StreetSmart – FastAPI Main (Upgraded)
Includes: routes, scoring, preferences, reports, auth, reviews, metrics
"""

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
import logging

from app.api.routes      import router as routes_router
from app.api.scoring     import router as scoring_router
from app.api.preferences import router as preferences_router
from app.api.reports     import router as reports_router
from app.api.auth        import router as auth_router
from app.api.reviews     import router as reviews_router
from app.api.metrics     import metrics_router
from app.api.sos         import router as sos_router

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger("streetsmart")

app = FastAPI(
    title       = "StreetSmart API",
    description = "Safety-first Smart City Navigation Platform",
    version     = "2.0.0",
    docs_url    = "/docs",
    redoc_url   = "/redoc",
)

app.add_middleware(
    CORSMiddleware,
    allow_origins = ["*"],
    allow_credentials = True,
    allow_methods     = ["*"],
    allow_headers     = ["*"],
)

# ── Routers ───────────────────────────────────────────────────────
app.include_router(auth_router)
app.include_router(routes_router)
app.include_router(scoring_router)
app.include_router(preferences_router)
app.include_router(reports_router)
app.include_router(reviews_router)
app.include_router(metrics_router)
app.include_router(sos_router)

# ── Health ────────────────────────────────────────────────────────
@app.get("/health")
async def health():
    return {"status": "healthy", "version": "2.0.0"}

@app.exception_handler(Exception)
async def global_handler(request, exc):
    logger.error(f"Unhandled: {exc}")
    return JSONResponse(status_code=500, content={"detail": "Internal server error"})