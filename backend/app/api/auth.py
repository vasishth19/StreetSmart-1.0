from fastapi import APIRouter, Depends, HTTPException
from fastapi.security import OAuth2PasswordBearer, OAuth2PasswordRequestForm
from pydantic import BaseModel
from typing import Optional
from datetime import datetime, timedelta
import hashlib
from jose import JWTError, jwt
import os
from dotenv import load_dotenv
from supabase import create_client

load_dotenv()

router = APIRouter(prefix="/auth", tags=["auth"])

SECRET_KEY = os.getenv("JWT_SECRET_KEY", "streetsmart-secret-key-2026")
ALGORITHM  = "HS256"
ACCESS_TOKEN_EXPIRE_MINUTES = 60 * 24 * 7  # 7 days

SUPABASE_URL = os.getenv("SUPABASE_URL", "https://awoqphdurcbyshkcwllh.supabase.co")
SUPABASE_KEY = os.getenv("SUPABASE_KEY", "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImF3b3FwaGR1cmNieXNoa2N3bGxoIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NDIyMzk2MDksImV4cCI6MjA1NzgxNTYwOX0.xt4BgGCFMMyPSDEMENoFMBiADJOqbMEFfJblcBpD1wY")
supabase     = create_client(SUPABASE_URL, SUPABASE_KEY)

oauth2 = OAuth2PasswordBearer(tokenUrl="/auth/login", auto_error=False)

class SignupRequest(BaseModel):
    name:     str
    email:    str
    password: str

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