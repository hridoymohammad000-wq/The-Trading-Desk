from __future__ import annotations

import os
import tempfile
import time

import pandas as pd

root = tempfile.mkdtemp(prefix="dse-test-")
os.environ["DSE_STORAGE_PATH"] = root
os.environ["DSE_DATABASE_PATH"] = os.path.join(root, "test.sqlite3")
os.environ["DSE_BOOTSTRAP_BUNDLED"] = "false"

from fastapi.testclient import TestClient
from backend.app import dse_collector
from backend.app.main import app


def fake_codes(*args, **kwargs):
    return pd.DataFrame([{"symbol": "GP"}, {"symbol": "BRACBANK"}])


def fake_history(start=None, end=None, code="GP", **kwargs):
    dates = pd.date_range("2026-06-20", periods=5, freq="D")
    base = 250 if code == "GP" else 50
    frame = pd.DataFrame(
        {
            "symbol": [code] * 5,
            "open": [base + i for i in range(5)],
            "high": [base + i + 3 for i in range(5)],
            "low": [base + i - 2 for i in range(5)],
            "close": [base + i + 1 for i in range(5)],
            "volume": [1000000 + i * 1000 for i in range(5)],
        },
        index=[d.date().isoformat() for d in dates],
    )
    frame.index.name = "date"
    return frame


dse_collector.get_current_trading_code = fake_codes
dse_collector.get_historical_data = fake_history
dse_collector.select_working_dse_source = lambda: ("https://www.dse.com.bd/", [{"base_url": "https://www.dse.com.bd/", "ok": True, "code": "OK", "stage": "READY"}])

client = TestClient(app)
with client:
    health = client.get("/api/health")
    assert health.status_code == 200
    assert health.json()["collector"] == "bdshare-preflight-required"
    assert health.json()["signal_engine"] == "historical-ohlcv-v1.6-conservative"

    # Manual import remains available.
    csv_text = "symbol,date,open,high,low,close,volume\nGP,2026-06-26,250,255,248,253,100000"
    imported = client.post("/api/market/import", json={"csv_data": csv_text, "date": "2026-06-26"})
    assert imported.status_code == 200, imported.text
    sid = imported.json()["snapshot_id"]
    detail = client.get(f"/api/market/snapshots/{sid}")
    assert detail.status_code == 200
    assert len(detail.json()["records"]) == 1

    # Deterministic mocked real collector job.
    started = client.post(
        "/api/market/collect",
        json={"mode": "backfill", "days_back": 365, "symbols": ["GP", "BRACBANK"], "refresh_symbols": False, "pause_seconds": 0},
    )
    assert started.status_code == 200, started.text
    job_id = started.json()["id"]
    job = None
    for _ in range(100):
        response = client.get(f"/api/market/collect/{job_id}")
        assert response.status_code == 200
        job = response.json()
        if job["status"] in {"COMPLETED", "FAILED"}:
            break
        time.sleep(0.05)
    assert job is not None and job["status"] == "COMPLETED", job
    assert job["result"]["records_collected"] == 10
    assert job["result"]["total_symbols"] == 2

    symbols = client.get("/api/symbols").json()
    assert "GP" in symbols and "BRACBANK" in symbols
    assert len(client.get("/api/symbols/GP/ohlcv").json()) >= 5
    latest = client.get("/api/market/latest").json()
    assert latest["total_symbols"] >= 1
    assert client.get("/api/signals").status_code == 200
    assert client.get("/api/market/export.csv").status_code == 200

    assert client.post("/api/portfolio", json={"origin": "MANUAL_IMPORT", "holdings": []}).status_code == 200
    assert client.get("/api/portfolio").json()["origin"] == "MANUAL_IMPORT"
    assert client.post("/api/paper-trades", json={"origin": "REAL", "trades": []}).status_code == 200
    assert client.post("/api/journal", json={"origin": "REAL", "entries": []}).status_code == 200

print("backend tests passed")
