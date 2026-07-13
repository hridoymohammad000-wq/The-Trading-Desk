import os
from urllib.parse import quote_plus, urlparse


def _default_database_url() -> str:
    explicit = os.getenv("DATABASE_URL", "").strip()
    if explicit:
        return explicit

    supabase_url = os.getenv("SUPABASE_URL", "").strip()
    password = os.getenv("SUPABASE_DB_PASSWORD", "").strip()
    if not supabase_url or not password:
        return ""

    host = urlparse(supabase_url).hostname or ""
    project_ref = host.split(".")[0] if host.endswith(".supabase.co") else ""
    if not project_ref:
        return ""

    return f"postgresql://postgres:{quote_plus(password)}@db.{project_ref}.supabase.co:5432/postgres"


DSE_STORAGE_MODE = os.getenv("DSE_STORAGE_MODE", "sqlite").lower()
DSE_STORAGE_PATH = os.getenv("DSE_STORAGE_PATH", "./storage")
DSE_DATABASE_PATH = os.getenv("DSE_DATABASE_PATH", os.path.join(DSE_STORAGE_PATH, "dse_swing_v1.sqlite3"))
SUPABASE_URL = os.getenv("SUPABASE_URL", "").strip()
SUPABASE_ANON_KEY = os.getenv("SUPABASE_ANON_KEY", "").strip()
SUPABASE_SERVICE_ROLE_KEY = os.getenv("SUPABASE_SERVICE_ROLE_KEY", "").strip()
SUPABASE_DB_PASSWORD = os.getenv("SUPABASE_DB_PASSWORD", "").strip()
DATABASE_URL = _default_database_url()
HOST = os.getenv("HOST", "0.0.0.0")
PORT = int(os.getenv("PORT", "8000"))
DEBUG = os.getenv("DEBUG", "false").lower() == "true"
