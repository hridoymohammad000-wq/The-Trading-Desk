from __future__ import annotations

import hashlib
import hmac
import os
from html import escape
from typing import Any, Dict
from urllib.parse import parse_qs

from fastapi import Body, FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import HTMLResponse, JSONResponse, RedirectResponse

from .safety_core import freshness

SESSION_COOKIE = "dse_session"
ALLOWED_STORAGE_KEYS = {
    "dse_app_settings", "dse_paper_capital", "dse_paper_trades", "dse_paper_trade_journals",
    "dse_portfolio_reviews", "dse_weekly_reviews", "dse_monthly_reviews",
    "dse_active_confirmed_portfolio", "dse_portfolio_history", "dse_signals",
    "dse_market_status", "dse_market_origin", "confirmed_portfolio", "paper_trades", "journal_entries",
}


def token() -> str:
    return os.getenv("DSE_API_TOKEN", "").strip()


def auth_required() -> bool:
    mode = os.getenv("DSE_REQUIRE_AUTH", "auto").strip().lower()
    return mode == "true" or (mode == "auto" and bool(token()))


def cookie_value() -> str:
    secret = os.getenv("SESSION_SECRET", "").strip() or token()
    if not token() or not secret:
        return ""
    return hmac.new(secret.encode(), token().encode(), hashlib.sha256).hexdigest()


def token_matches(value: str) -> bool:
    return bool(token()) and hmac.compare_digest(value, token())


def cookie_matches(value: str) -> bool:
    expected = cookie_value()
    return bool(expected) and hmac.compare_digest(value, expected)


def configure_cors(app: FastAPI) -> None:
    app.user_middleware = [middleware for middleware in app.user_middleware if middleware.cls is not CORSMiddleware]
    origins = [value.strip() for value in os.getenv("DSE_ALLOWED_ORIGINS", "").split(",") if value.strip()]
    if origins:
        app.add_middleware(
            CORSMiddleware,
            allow_origins=origins,
            allow_credentials=True,
            allow_methods=["GET", "POST", "PUT", "PATCH", "DELETE"],
            allow_headers=["Authorization", "Content-Type", "X-API-Key"],
        )
    app.middleware_stack = None


def replace_health_route(app: FastAPI, storage: Any) -> None:
    app.router.routes = [route for route in app.router.routes if getattr(route, "path", None) != "/api/health"]

    @app.get("/api/health")
    def safety_health() -> Dict[str, Any]:
        latest_date = storage.latest_market_trade_date()
        state = freshness([{"trade_date": latest_date}] if latest_date else [])
        return {
            "status": "ok",
            "storage": os.getenv("DSE_STORAGE_MODE", "sqlite"),
            "signal_engine": "historical-ohlcv-v1.6-strict-safety-overlay",
            "latest_data_date": state["latest_date"],
            "stale_days": state["stale_days"],
            "max_signal_age_days": state["max_age_days"],
            "data_freshness": state["data_freshness"],
            "new_entries_allowed": state["actionable"],
            "mutation_auth": "REQUIRED" if auth_required() else "LOCAL_OPEN",
            "product_mode": "SIGNAL_AND_PAPER_TEST_ONLY",
            "broker_execution": False,
        }


def install_auth(app: FastAPI) -> None:
    @app.middleware("http")
    async def safety_middleware(request: Request, call_next):
        path = request.url.path
        if path.startswith("/api/storage/") and path.rsplit("/", 1)[-1] not in ALLOWED_STORAGE_KEYS:
            return JSONResponse({"detail": "Storage key not found."}, status_code=404)

        is_mutation = request.method.upper() in {"POST", "PUT", "PATCH", "DELETE"}
        auth_exempt = path in {"/api/auth/unlock", "/api/auth/lock", "/auth/unlock"}
        if auth_required() and is_mutation and path.startswith("/api/") and not auth_exempt:
            bearer = request.headers.get("authorization", "")
            bearer = bearer[7:].strip() if bearer.lower().startswith("bearer ") else ""
            supplied = request.headers.get("x-api-key", "")
            session = request.cookies.get(SESSION_COOKIE, "")
            if not (token_matches(bearer) or token_matches(supplied) or cookie_matches(session)):
                return JSONResponse({"detail": "Mutation access is locked. Open /auth and enter the DSE_API_TOKEN."}, status_code=401)
        return await call_next(request)

    @app.get("/api/auth/status")
    def auth_status(request: Request) -> Dict[str, bool]:
        return {"required": auth_required(), "unlocked": not auth_required() or cookie_matches(request.cookies.get(SESSION_COOKIE, ""))}

    @app.post("/api/auth/unlock")
    def auth_unlock(payload: Dict[str, Any] = Body(...)) -> JSONResponse:
        if not auth_required():
            return JSONResponse({"status": "open", "required": False})
        if not token_matches(str(payload.get("token", ""))):
            return JSONResponse({"detail": "Invalid server access token."}, status_code=401)
        response = JSONResponse({"status": "unlocked", "required": True})
        response.set_cookie(SESSION_COOKIE, cookie_value(), httponly=True, samesite="strict", secure=os.getenv("DSE_COOKIE_SECURE", "false").lower() == "true", max_age=43200)
        return response

    @app.post("/api/auth/lock")
    def auth_lock() -> JSONResponse:
        response = JSONResponse({"status": "locked", "required": auth_required()})
        response.delete_cookie(SESSION_COOKIE)
        return response

    @app.get("/auth", response_class=HTMLResponse)
    def auth_page(request: Request) -> HTMLResponse:
        state = "Unlocked" if cookie_matches(request.cookies.get(SESSION_COOKIE, "")) else "Locked"
        required = "Yes" if auth_required() else "No"
        html = f"""<!doctype html><html><head><meta charset='utf-8'><meta name='viewport' content='width=device-width'>
        <title>Server Write Access</title><style>body{{font-family:system-ui;background:#0b0e14;color:#e2e8f0;max-width:560px;margin:60px auto;padding:24px}}input,button{{width:100%;padding:12px;margin-top:12px;box-sizing:border-box}}button{{cursor:pointer}}</style></head>
        <body><h1>Server Write Access</h1><p>Authentication required: {required}</p><p>Session: {escape(state)}</p>
        <form method='post' action='/auth/unlock'><input type='password' name='token' placeholder='DSE_API_TOKEN' required><button type='submit'>Unlock writes</button></form>
        <p><a href='/' style='color:#34d399'>Back to app</a></p></body></html>"""
        return HTMLResponse(html)

    @app.post("/auth/unlock")
    async def auth_unlock_form(request: Request):
        supplied = parse_qs((await request.body()).decode("utf-8", errors="replace")).get("token", [""])[0]
        if not token_matches(supplied):
            return HTMLResponse("Invalid token. <a href='/auth'>Try again</a>", status_code=401)
        response = RedirectResponse("/", status_code=303)
        response.set_cookie(SESSION_COOKIE, cookie_value(), httponly=True, samesite="strict", secure=os.getenv("DSE_COOKIE_SECURE", "false").lower() == "true", max_age=43200)
        return response
