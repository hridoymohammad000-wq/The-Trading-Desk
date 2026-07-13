from __future__ import annotations

import csv
import io
import os
import uuid
from collections import Counter
from datetime import date, datetime, timezone
from pathlib import Path
from typing import Any, Dict, List, Optional

from fastapi import Body, FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse, StreamingResponse
from fastapi.staticfiles import StaticFiles

from .config import DSE_STORAGE_MODE
from .dse_collector import get_collection_job, parse_and_validate_csv_data, start_collection_job, trigger_scraped_collection_placeholder
from .models import CSVUploadRequest, CollectionRequest
from .signal_bridge import calculate_market_bias, generate_swing_signals_py
from .storage import (
    all_market_records,
    delete_market_snapshot,
    delete_value,
    get_value,
    init_storage,
    latest_day_records,
    latest_market_trade_date,
    latest_signals,
    list_market_snapshots,
    list_symbols,
    load_market_snapshot,
    query_symbol_ohlcv,
    save_market_snapshot,
    save_signals,
    set_value,
)

PROJECT_ROOT = Path(__file__).resolve().parents[2]
BUNDLED_MASTER = PROJECT_ROOT / "sample-data" / "dse_1y_ohlcv_master_app_ready.csv"

app = FastAPI(title="DSE Swing Trade Signal App Backend", version="1.6.0")
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=False,
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.on_event("startup")
def startup() -> None:
    init_storage()
    if os.getenv("DSE_BOOTSTRAP_BUNDLED", "true").lower() == "true":
        bootstrap_bundled_master()


@app.get("/api/health")
def health() -> Dict[str, Any]:
    latest_date = latest_market_trade_date()
    stale_days = (date.today() - date.fromisoformat(latest_date)).days if latest_date else None
    return {
        "status": "ok",
        "storage": DSE_STORAGE_MODE,
        "collector": "bdshare-preflight-required",
        "collector_modes": ["backfill", "daily"],
        "signal_engine": "historical-ohlcv-v1.6-conservative",
        "latest_data_date": latest_date,
        "stale_days": stale_days,
        "data_freshness": "STALE" if stale_days is not None and stale_days > 7 else ("CURRENT" if latest_date else "EMPTY"),
        "timestamp": datetime.now(timezone.utc).isoformat(),
    }


def _import(payload: CSVUploadRequest, origin: str = "MANUAL_IMPORT", source_label: Optional[str] = None) -> Dict[str, Any]:
    if not payload.csv_data.strip():
        raise HTTPException(400, "CSV/text import payload is empty.")
    date_str = payload.date or datetime.now().strftime("%Y-%m-%d")
    valid, invalid, stats = parse_and_validate_csv_data(payload.csv_data, date_str)
    if not valid:
        raise HTTPException(400, {"message": "Import failed validation.", "errors": invalid[:10], "stats": stats})
    for record in valid:
        record["source"] = origin
    dates = [record["trade_date"] for record in valid]
    snapshot_id = f"DSE-{origin}-{max(dates).replace('-', '')}-{uuid.uuid4().hex[:6]}"
    snapshot = {
        "id": snapshot_id,
        "date": max(dates),
        "start_date": min(dates),
        "end_date": max(dates),
        "origin": origin,
        "source": source_label or ("manual-import" if origin != "DEMO" else "explicit-demo-dataset"),
        "total_symbols": len({record["symbol"] for record in valid}),
        "record_count": len(valid),
        "engine_version": "V1.6",
        "created_time": datetime.now(timezone.utc).isoformat(),
        "status": "PASSED_WITH_WARNINGS" if invalid else "PASSED",
        "records": valid,
    }
    save_market_snapshot(snapshot_id, snapshot)
    latest_date = max(dates)
    latest_records = [record for record in valid if record["trade_date"] == latest_date]
    signals = generate_swing_signals_py(valid)
    save_signals(signals, origin)
    return {
        "status": "SUCCESS",
        "message": f"Imported {len(valid)} validated records.",
        "snapshot_id": snapshot_id,
        "origin": origin,
        "invalid_rows_count": len(invalid),
        "invalid_rows": invalid[:5],
        "stats": stats,
        "signals_generated": len(signals),
        "market_bias": calculate_market_bias(valid),
    }


def bootstrap_bundled_master() -> Optional[Dict[str, Any]]:
    """Load the verified bundled master dataset only when the database is empty."""
    if latest_market_trade_date() or not BUNDLED_MASTER.exists():
        return None
    payload = CSVUploadRequest(csv_data=BUNDLED_MASTER.read_text(encoding="utf-8"), origin="REAL")
    return _import(payload, "REAL", "bundled-master-verified")


@app.get("/api/market/quality")
def market_quality() -> Dict[str, Any]:
    records = all_market_records()
    if not records:
        return {"status": "EMPTY", "warnings": ["No validated market dataset is active."]}
    symbols = Counter(str(row["symbol"]).upper() for row in records)
    dates = Counter(str(row["trade_date"]) for row in records)
    latest_date = max(dates)
    stale_days = (date.today() - date.fromisoformat(latest_date)).days
    watchlist = {}
    for symbol in ("AL-HAJTEX", "BDFINANCE", "KBPPWBIL", "RAHIMAFOOD"):
        rows = [row for row in records if str(row["symbol"]).upper() == symbol]
        watchlist[symbol] = {
            "sessions": len(rows),
            "first_date": min((row["trade_date"] for row in rows), default=None),
            "last_date": max((row["trade_date"] for row in rows), default=None),
        }
    warnings: List[str] = []
    if stale_days > 7:
        warnings.append(f"Dataset is stale by {stale_days} calendar days; refresh before acting on signals.")
    if min(symbols.values()) < 60:
        warnings.append("Some symbols have fewer than 60 sessions and are ineligible for signals.")
    return {
        "status": "PASSED_WITH_WARNINGS" if warnings else "PASSED",
        "rows": len(records),
        "symbols": len(symbols),
        "dates": len(dates),
        "first_date": min(dates),
        "last_date": latest_date,
        "stale_days": stale_days,
        "rows_per_date": {"minimum": min(dates.values()), "maximum": max(dates.values())},
        "sessions_per_symbol": {"minimum": min(symbols.values()), "maximum": max(symbols.values())},
        "watchlist": watchlist,
        "warnings": warnings,
    }


@app.post("/api/market/import")
def market_import(payload: CSVUploadRequest) -> Dict[str, Any]:
    origin = payload.origin if payload.origin in {"REAL", "MANUAL_IMPORT", "DEMO"} else "MANUAL_IMPORT"
    return _import(payload, origin)


@app.post("/api/collect-dse-data")
def legacy_collect(payload: Optional[CollectionRequest] = None) -> Dict[str, Any]:
    request = payload or CollectionRequest()
    return start_collection_job(
        mode=request.mode,
        days_back=request.days_back,
        symbols=request.symbols,
        refresh_symbols=request.refresh_symbols,
        pause_seconds=request.pause_seconds,
    )


@app.post("/api/market/collect")
def collect(payload: CollectionRequest = CollectionRequest()) -> Dict[str, Any]:
    try:
        return start_collection_job(
            mode=payload.mode,
            days_back=payload.days_back,
            symbols=payload.symbols,
            refresh_symbols=payload.refresh_symbols,
            pause_seconds=payload.pause_seconds,
        )
    except ValueError as exc:
        raise HTTPException(400, str(exc)) from exc


@app.get("/api/market/collector/status")
def collector_status() -> Dict[str, Any]:
    return trigger_scraped_collection_placeholder()


@app.get("/api/market/collect/{job_id}")
def collection_job(job_id: str) -> Dict[str, Any]:
    job = get_collection_job(job_id)
    if not job:
        raise HTTPException(404, "Collector job not found.")
    return job


@app.get("/api/market/snapshots")
@app.get("/api/market-snapshots")
def snapshots() -> List[Dict[str, Any]]:
    return list_market_snapshots()


@app.get("/api/market/snapshots/{snapshot_id}")
@app.get("/api/market-snapshots/{snapshot_id}")
def snapshot(snapshot_id: str, include_records: bool = True) -> Dict[str, Any]:
    data = load_market_snapshot(snapshot_id, include_records=include_records)
    if not data:
        raise HTTPException(404, "Market snapshot not found.")
    return data


@app.delete("/api/market/snapshots/{snapshot_id}")
@app.delete("/api/market-snapshots/{snapshot_id}")
def delete_snapshot(snapshot_id: str) -> Dict[str, str]:
    if not delete_market_snapshot(snapshot_id):
        raise HTTPException(404, "Market snapshot not found.")
    return {"status": "ok"}


@app.get("/api/symbols")
def symbols() -> List[str]:
    return list_symbols()


@app.get("/api/symbols/{symbol}/ohlcv")
def ohlcv(symbol: str, snapshot_id: Optional[str] = None) -> List[Dict[str, Any]]:
    return query_symbol_ohlcv(symbol, snapshot_id)


@app.get("/api/market/latest")
def latest_market() -> Dict[str, Any]:
    records = latest_day_records()
    return {
        "date": records[0]["trade_date"] if records else None,
        "total_symbols": len(records),
        "market_bias": calculate_market_bias(records),
        "records": records,
    }


@app.get("/api/market/export.csv")
def export_market_csv() -> StreamingResponse:
    records = all_market_records()
    if not records:
        raise HTTPException(404, "No validated market records are available for export.")
    output = io.StringIO()
    fields = ["symbol", "trade_date", "open", "high", "low", "close", "volume", "sector", "source"]
    writer = csv.DictWriter(output, fieldnames=fields)
    writer.writeheader()
    for record in records:
        writer.writerow({field: record.get(field) for field in fields})
    filename = f"dse_ohlcv_export_{datetime.now().strftime('%Y%m%d')}.csv"
    return StreamingResponse(
        iter([output.getvalue()]),
        media_type="text/csv",
        headers={"Content-Disposition": f'attachment; filename="{filename}"'},
    )


@app.post("/api/signals/run")
@app.post("/api/run-signal-engine")
def run_signals(records: Optional[List[Dict[str, Any]]] = Body(default=None)) -> Dict[str, Any]:
    source_records = records or all_market_records()
    if not source_records:
        raise HTTPException(400, "Market records are required.")
    for record in source_records:
        if "trade_date" not in record and "date" in record:
            record["trade_date"] = record["date"]
    signals = generate_swing_signals_py(source_records)
    save_signals(signals, source_records[0].get("source", "MANUAL_IMPORT"))
    return {
        "market_bias": calculate_market_bias(source_records),
        "total_symbols": len({str(r.get("symbol", "")).upper() for r in source_records if r.get("symbol")}),
        "signals_generated": len(signals),
        "signals": signals,
    }


@app.get("/api/signals")
def signals() -> List[Dict[str, Any]]:
    return latest_signals()


def crud_get(key: str, default: Any) -> Dict[str, Any]:
    value = get_value(key)
    return value or {"data": default, "origin": "REAL"}


def crud_post(key: str, payload: Any) -> Dict[str, Any]:
    origin = payload.get("origin", "REAL") if isinstance(payload, dict) else "REAL"
    set_value(key, payload, origin)
    return {"status": "saved", "origin": origin}


@app.get("/api/portfolio")
def get_portfolio() -> Dict[str, Any]:
    return crud_get("confirmed_portfolio", {})


@app.post("/api/portfolio")
def post_portfolio(payload: Dict[str, Any]) -> Dict[str, Any]:
    return crud_post("confirmed_portfolio", payload)


@app.get("/api/paper-trades")
def get_paper() -> Dict[str, Any]:
    return crud_get("paper_trades", [])


@app.post("/api/paper-trades")
def post_paper(payload: Any = Body(...)) -> Dict[str, Any]:
    return crud_post("paper_trades", payload)


@app.get("/api/journal")
def get_journal() -> Dict[str, Any]:
    return crud_get("journal_entries", [])


@app.post("/api/journal")
def post_journal(payload: Any = Body(...)) -> Dict[str, Any]:
    return crud_post("journal_entries", payload)


@app.get("/api/storage/{key}")
def storage_get(key: str) -> Dict[str, Any]:
    value = get_value(key)
    if not value:
        raise HTTPException(404, "Storage key not found.")
    return value


@app.put("/api/storage/{key}")
def storage_put(key: str, payload: Dict[str, Any]) -> Dict[str, str]:
    set_value(key, payload.get("data"), payload.get("origin", "REAL"))
    return {"status": "saved"}


@app.delete("/api/storage/{key}")
def storage_delete(key: str) -> Dict[str, str]:
    delete_value(key)
    return {"status": "deleted"}


# Serve the verified Vite production build from one FastAPI process.
DIST_DIR = PROJECT_ROOT / "dist"
ASSETS_DIR = DIST_DIR / "assets"
if ASSETS_DIR.exists():
    app.mount("/assets", StaticFiles(directory=str(ASSETS_DIR)), name="assets")


@app.get("/")
def frontend_index() -> FileResponse:
    index_file = DIST_DIR / "index.html"
    if not index_file.exists():
        raise HTTPException(503, "Frontend build is missing. Run npm run build.")
    return FileResponse(str(index_file))


@app.get("/{full_path:path}")
def frontend_spa(full_path: str) -> FileResponse:
    if full_path.startswith("api/"):
        raise HTTPException(404, "API route not found.")
    requested = DIST_DIR / full_path
    if requested.is_file() and DIST_DIR in requested.resolve().parents:
        return FileResponse(str(requested))
    index_file = DIST_DIR / "index.html"
    if not index_file.exists():
        raise HTTPException(503, "Frontend build is missing. Run npm run build.")
    return FileResponse(str(index_file))
