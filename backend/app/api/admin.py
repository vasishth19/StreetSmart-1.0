"""
Admin login + guard.

BEFORE: the admin password ('admin2026') was hard-coded in the browser bundle and the
Approve / Reject buttons only changed on-screen state — nothing was saved.
NOW: credentials are checked on the server, the server issues a short-lived token,
and the report-status endpoint requires that token.

Set ADMIN_EMAIL and ADMIN_PASSWORD in the backend environment (Render → Environment).
If they are not set, the old demo credentials keep working and a warning is logged.
"""
import hmac
import logging
from datetime import datetime, timedelta, timezone

from fastapi import APIRouter, Header, HTTPException
from jose import JWTError, jwt
from pydantic import BaseModel

from app.config import settings

router = APIRouter(prefix="/admin", tags=["admin"])
logger = logging.getLogger(__name__)

ALGORITHM = "HS256"
TOKEN_HOURS = 12


class AdminLogin(BaseModel):
    email: str
    password: str


def _creds():
    if settings.ADMIN_EMAIL and settings.ADMIN_PASSWORD:
        return settings.ADMIN_EMAIL, settings.ADMIN_PASSWORD, False
    logger.warning("ADMIN_EMAIL / ADMIN_PASSWORD not set — using legacy demo credentials. Set them in the environment!")
    return "admin@streetsmart.app", "admin2026", True


@router.post("/login")
async def admin_login(body: AdminLogin):
    email, pw, legacy = _creds()
    ok_email = hmac.compare_digest(body.email.strip().lower(), email.lower()) or (legacy and body.email.strip() == "admin")
    ok_pw = hmac.compare_digest(body.password, pw) or (legacy and body.password == "admin")
    if not (ok_email and ok_pw):
        raise HTTPException(status_code=401, detail="Invalid credentials")
    exp = datetime.now(timezone.utc) + timedelta(hours=TOKEN_HOURS)
    token = jwt.encode({"sub": "admin", "role": "admin", "exp": exp}, settings.SECRET_KEY, algorithm=ALGORITHM)
    return {"token": token, "expires_in_hours": TOKEN_HOURS}


def require_admin(authorization: str = Header(default="")):
    if not authorization.lower().startswith("bearer "):
        raise HTTPException(status_code=401, detail="Admin token required")
    try:
        payload = jwt.decode(authorization[7:], settings.SECRET_KEY, algorithms=[ALGORITHM])
        if payload.get("role") != "admin":
            raise JWTError("not admin")
    except JWTError:
        raise HTTPException(status_code=401, detail="Invalid or expired admin token")
    return payload
