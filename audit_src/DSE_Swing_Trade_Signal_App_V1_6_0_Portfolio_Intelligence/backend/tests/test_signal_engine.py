from __future__ import annotations

import csv
from collections import Counter
from pathlib import Path

from backend.app.signal_bridge import generate_swing_signals_py

ROOT = Path(__file__).resolve().parents[2]
MASTER = ROOT / "sample-data" / "dse_1y_ohlcv_master_app_ready.csv"

with MASTER.open("r", encoding="utf-8-sig", newline="") as handle:
    records = list(csv.DictReader(handle))

assert len(records) == 84_970
assert len({(row["symbol"], row["trade_date"]) for row in records}) == len(records)
assert len({row["symbol"] for row in records}) == 460
assert max(row["trade_date"] for row in records) == "2026-06-30"

signals = generate_swing_signals_py(records)
assert len(signals) == 460
counts = Counter(signal["signal"] for signal in signals)
assert counts["BUY"] > 0
assert counts["WATCH"] > 0
assert counts["AVOID"] > 0

by_symbol = {signal["symbol"]: signal for signal in signals}
for symbol in ("AL-HAJTEX", "BDFINANCE", "KBPPWBIL", "RAHIMAFOOD"):
    assert symbol in by_symbol
    assert by_symbol[symbol]["date"] == "2026-06-30"

for signal in signals:
    if signal["signal"] == "BUY":
        assert signal["grade"] in {"A", "A+"}
        assert signal["targetSource"] == "STRUCTURE"
        assert signal["rr"] >= 2.0
        assert signal["metrics"]["risk_percent"] <= 7.0

print("signal engine v1.6 tests passed", dict(counts))
