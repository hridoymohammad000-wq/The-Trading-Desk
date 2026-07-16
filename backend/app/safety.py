from __future__ import annotations

import importlib

from fastapi import FastAPI

from .safety_auth import configure_cors, install_auth, replace_health_route
from .safety_core import NESTED_PACKAGE, install_signal_safety, patch_daily_snapshot_storage


def build_app() -> FastAPI:
    strict_generate = install_signal_safety()
    nested_main = importlib.import_module(f"{NESTED_PACKAGE}.main")
    app: FastAPI = nested_main.app
    storage = importlib.import_module(f"{NESTED_PACKAGE}.storage")

    patch_daily_snapshot_storage()
    configure_cors(app)
    replace_health_route(app, storage)
    install_auth(app)

    @app.on_event("startup")
    def refresh_signals_with_safety_gate() -> None:
        existing = storage.latest_signals()
        already_hardened = bool(existing) and all("actionable" in signal and "dataFreshness" in signal for signal in existing)
        if already_hardened:
            return
        records = storage.all_market_records()
        if records:
            storage.save_signals(strict_generate(records), "REAL")

    catch_all = [route for route in app.router.routes if getattr(route, "path", None) == "/{full_path:path}"]
    app.router.routes = [route for route in app.router.routes if route not in catch_all] + catch_all
    return app
