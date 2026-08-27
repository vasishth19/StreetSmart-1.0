from fastapi import APIRouter, Depends, HTTPException, BackgroundTasks
from fastapi.security import OAuth2PasswordBearer, OAuth2PasswordRequestForm
from pydantic import BaseModel
from typing import Optional
from datetime import datetime, timedelta
import hashlib
import secrets
import httpx
from jose import JWTError, jwt
import os
from dotenv import load_dotenv
from app.services.supabase_client import supabase

load_dotenv()

router = APIRouter(prefix="/auth", tags=["auth"])

SECRET_KEY = os.getenv("JWT_SECRET_KEY", "streetsmart-secret-key-2026")
ALGORITHM  = "HS256"
ACCESS_TOKEN_EXPIRE_MINUTES = 60 * 24 * 7  # 7 days
RESET_TOKEN_EXPIRE_MINUTES  = 30

# ✅ Render's free tier blocks outbound SMTP ports (25/465/587) platform-wide,
# so raw smtplib can never work there regardless of credentials. SendGrid
# sends over HTTPS instead, which isn't blocked.
# We use "Single Sender Verification" (SendGrid dashboard → Settings →
# Sender Authentication → Verify a Single Sender) instead of full domain
# verification — this only requires proving you own ONE email address
# (like a Gmail address), no custom domain needed, and once verified you
# can send to ANY recipient. Free tier: 100 emails/day, 60-day trial window
# for new accounts (plenty for hackathon timelines).
SENDGRID_API_KEY = os.getenv("SENDGRID_API_KEY", "")
SENDGRID_FROM    = os.getenv("SENDGRID_FROM", "")  # must match your verified Single Sender email exactly
FRONTEND_URL     = os.getenv("FRONTEND_URL", "http://localhost:3000")

oauth2 = OAuth2PasswordBearer(tokenUrl="/auth/login", auto_error=False)

class SignupRequest(BaseModel):
    name:     str
    email:    str
    password: str

class ForgotPasswordRequest(BaseModel):
    email: str

class ResetPasswordRequest(BaseModel):
    token:        str
    new_password: str

class TokenResponse(BaseModel):
    access_token: str
    token_type:   str = "bearer"

class UserProfile(BaseModel):
    id:         int
    name:       str
    email:      str
    created_at: str

def hash_pw(pw: str) -> str:
    return hashlib.sha256(pw.encode()).hexdigest()

def create_token(user_id: int) -> str:
    expire  = datetime.utcnow() + timedelta(minutes=ACCESS_TOKEN_EXPIRE_MINUTES)
    return jwt.encode({"sub": str(user_id), "exp": expire}, SECRET_KEY, algorithm=ALGORITHM)

def verify_token(token: str) -> int:
    try:
        payload = jwt.decode(token, SECRET_KEY, algorithms=[ALGORITHM])
        return int(payload["sub"])
    except JWTError:
        raise HTTPException(status_code=401, detail="Invalid token")

def get_by_email(email: str) -> Optional[dict]:
    try:
        r = supabase.table("users").select("*").eq("email", email).execute()
        return r.data[0] if r.data else None
    except:
        return None

def get_by_id(uid: int) -> Optional[dict]:
    try:
        r = supabase.table("users").select("*").eq("id", uid).execute()
        return r.data[0] if r.data else None
    except:
        return None

async def get_current_user(token: str = Depends(oauth2)) -> Optional[dict]:
    if not token:
        return None
    uid = verify_token(token)
    return get_by_id(uid)

async def require_user(user=Depends(get_current_user)):
    if not user:
        raise HTTPException(status_code=401, detail="Authentication required")
    return user

@router.post("/signup", response_model=TokenResponse)
async def signup(body: SignupRequest):
    if get_by_email(body.email):
        raise HTTPException(status_code=400, detail="Email already registered")
    if len(body.password) < 6:
        raise HTTPException(status_code=400, detail="Password too short")
    try:
        r = supabase.table("users").insert({
            "name":            body.name,
            "email":           body.email,
            "hashed_password": hash_pw(body.password),
            "created_at":      datetime.utcnow().isoformat(),
        }).execute()
        return TokenResponse(access_token=create_token(r.data[0]["id"]))
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@router.post("/login", response_model=TokenResponse)
async def login(form: OAuth2PasswordRequestForm = Depends()):
    user = get_by_email(form.username)
    if not user or hash_pw(form.password) != user["hashed_password"]:
        raise HTTPException(status_code=401, detail="Incorrect email or password")
    return TokenResponse(access_token=create_token(user["id"]))

@router.get("/me", response_model=UserProfile)
async def me(user=Depends(require_user)):
    return UserProfile(
        id=user["id"], name=user["name"],
        email=user["email"], created_at=user["created_at"]
    )

def send_reset_email(to_email: str, reset_link: str):
    if not SENDGRID_API_KEY or not SENDGRID_FROM:
        # Not configured — log instead of failing the request, so local/dev
        # testing still works without a real email account set up.
        print(f"[password reset] SENDGRID_API_KEY/SENDGRID_FROM not set. Link for {to_email}: {reset_link}", flush=True)
        return

    html_body = (
        f"<p>Hi,</p>"
        f"<p>We received a request to reset your StreetSmart password. "
        f"Click the link below to set a new one — it expires in {RESET_TOKEN_EXPIRE_MINUTES} minutes:</p>"
        f'<p><a href="{reset_link}">{reset_link}</a></p>'
        f"<p>If you didn't request this, you can safely ignore this email.</p>"
        f"<p>— StreetSmart</p>"
    )

    print(f"[password reset] Attempting to send via SendGrid -> {to_email}", flush=True)
    try:
        resp = httpx.post(
            "https://api.sendgrid.com/v3/mail/send",
            headers={
                "Authorization": f"Bearer {SENDGRID_API_KEY}",
                "Content-Type":  "application/json",
            },
            json={
                "personalizations": [{"to": [{"email": to_email}]}],
                "from":    {"email": SENDGRID_FROM, "name": "StreetSmart"},
                "subject": "Reset your StreetSmart password",
                "content": [{"type": "text/html", "value": html_body}],
            },
            timeout=10,
        )
        if resp.status_code == 202:
            print(f"[password reset] SUCCESS — SendGrid accepted the message for {to_email}", flush=True)
        else:
            print(f"[password reset] SendGrid rejected the request ({resp.status_code}): {resp.text}", flush=True)
    except Exception as e:
        print(f"[password reset] SEND FAILED ({type(e).__name__}): {e}", flush=True)
        raise

@router.post("/forgot-password")
async def forgot_password(body: ForgotPasswordRequest, background_tasks: BackgroundTasks):
    user = get_by_email(body.email)

    # Always return the same generic response whether or not the email is
    # registered — prevents leaking which emails have accounts.
    generic_response = {"message": "If that email is registered, a reset link has been sent."}

    if not user:
        print(f"[password reset] No account found for {body.email} — returning generic response", flush=True)
        return generic_response

    token   = secrets.token_urlsafe(32)
    expires = (datetime.utcnow() + timedelta(minutes=RESET_TOKEN_EXPIRE_MINUTES)).isoformat()

    try:
        supabase.table("users").update({
            "reset_token":         token,
            "reset_token_expires": expires,
        }).eq("id", user["id"]).execute()
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

    reset_link = f"{FRONTEND_URL}/reset-password?token={token}"
    # ✅ Runs AFTER the response is already sent to the browser — the
    # frontend no longer waits on Gmail's SMTP handshake, which is what
    # was causing the 8-second timeout.
    background_tasks.add_task(send_reset_email, user["email"], reset_link)

    return generic_response

@router.post("/reset-password")
async def reset_password(body: ResetPasswordRequest):
    if len(body.new_password) < 6:
        raise HTTPException(status_code=400, detail="Password too short")

    try:
        r = supabase.table("users").select("*").eq("reset_token", body.token).execute()
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

    user = r.data[0] if r.data else None
    if not user or not user.get("reset_token_expires"):
        raise HTTPException(status_code=400, detail="Invalid or expired reset link")

    expires_at = datetime.fromisoformat(user["reset_token_expires"])
    if datetime.utcnow() > expires_at:
        raise HTTPException(status_code=400, detail="This reset link has expired")

    try:
        supabase.table("users").update({
            "hashed_password":     hash_pw(body.new_password),
            "reset_token":         None,
            "reset_token_expires": None,
        }).eq("id", user["id"]).execute()
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

    return {"message": "Password updated successfully"}