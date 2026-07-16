from __future__ import annotations

import os
import tempfile
from datetime import date

root = tempfile.mkdtemp(prefix="dse-safety-")
os.environ["DSE_STORAGE_PATH"] = root
os.environ["DSE_DATABASE_PATH"] = os.path.join(root, "test.sqlite3")
os.environ["DSE_BOOTSTRAP_BUNDLED"] = "false"
os.environ["DSE_API_TOKEN"] = "known-token"
os.environ["SESSION_SECRET"] = "cookie-secret"
os.environ["DSE_REQUIRE_AUTH"] = "auto"

from fastapi.testclient import TestClient
from backend.app.main import app
from backend.app.safety_core import NESTED_PACKAGE, strict_classification
import importlib

assert strict_classification("BUY", "A+", 95) == ("BUY", "A+")
assert strict_classification("BUY", "A+", 94) == ("BUY", "A")
assert strict_classification("BUY", "A", 90) == ("BUY", "A")
assert strict_classification("WATCH", "WATCH", 89) == ("WATCH", "B+")
assert strict_classification("BUY", "A", 95) == ("AVOID", "Reject")
assert strict_classification("WATCH", "WATCH", 84) == ("AVOID", "Reject")

signal_module = importlib.import_module(f"{NESTED_PACKAGE}.signal_bridge")
storage = importlib.import_module(f"{NESTED_PACKAGE}.storage")
collector = importlib.import_module(f"{NESTED_PACKAGE}.dse_collector")

records = []
for idx in range(80):
    day = date(2026, 4, 12).toordinal() + idx
    trade_date = date.fromordinal(day).isoformat()
    close = 100 + idx * 0.5
    records.append({"symbol": "TEST", "trade_date": trade_date, "open": close - 0.4, "high": close + 1.0, "low": close - 1.0, "close": close, "volume": 200_000, "sector": "Test", "source": "REAL"})

stale = signal_module.generate_swing_signals_py(records, as_of_date=date(2026, 7, 16))
assert stale and all(item["status"] == "EXPIRED" for item in stale)
assert all(item["signal"] != "BUY" and item["actionable"] is False for item in stale)
assert all(item["grade"] in {"A+", "A", "B+", "Reject"} for item in stale)

client = TestClient(app)
with client:
    health = client.get("/api/health")
    assert health.status_code == 200
    assert health.json()["broker_execution"] is False
    assert health.json()["mutation_auth"] == "REQUIRED"
    assert client.post("/api/portfolio", json={"origin": "REAL", "holdings": []}).status_code == 401
    assert client.post("/api/auth/unlock", json={"token": "wrong"}).status_code == 401
    assert client.post("/api/auth/unlock", json={"token": "known-token"}).status_code == 200
    assert client.post("/api/portfolio", json={"origin": "REAL", "holdings": []}).status_code == 200
    assert client.get("/api/storage/not-allowed").status_code == 404

    base_snapshot = {
        "id": "BASE", "date": "2026-07-15", "origin": "REAL", "source": "TEST", "collector_mode": "backfill",
        "records": [
            {"symbol": "TEST", "trade_date": "2026-07-15", "open": 100, "high": 102, "low": 99, "close": 101, "volume": 100000, "sector": "Test", "source": "REAL"}
        ],
    }
    storage.save_market_snapshot("BASE", base_snapshot)
    daily_snapshot = {
        "id": "DAILY", "date": "2026-07-16", "origin": "REAL", "source": "TEST", "collector_mode": "daily",
        "records": [
            base_snapshot["records"][0],
            {"symbol": "TEST", "trade_date": "2026-07-16", "open": 101, "high": 103, "low": 100, "close": 102, "volume": 120000, "sector": "Test", "source": "REAL"},
        ],
    }
    collector.save_market_snapshot("DAILY", daily_snapshot)
    stored = storage.load_market_snapshot("DAILY")
    assert stored is not None and len(stored["records"]) == 1
    assert stored["records"][0]["trade_date"] == "2026-07-16"

print("safety overlay tests passed")
