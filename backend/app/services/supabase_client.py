"""
Single shared Supabase client. Every API module should import `supabase`
from here instead of creating its own client — keeps credential handling
in exactly one place.
"""
from supabase import create_client
from app.config import settings

if not settings.SUPABASE_URL or not settings.SUPABASE_KEY:
    raise RuntimeError(
        "\n\n"
        "==========================================================\n"
        " SUPABASE_URL / SUPABASE_KEY are not set.\n"
        " Add them to backend/.env — see backend/.env.example.\n"
        "==========================================================\n"
    )

supabase = create_client(settings.SUPABASE_URL, settings.SUPABASE_KEY)
