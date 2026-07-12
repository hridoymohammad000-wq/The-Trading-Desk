from __future__ import annotations

import argparse
import csv
import json
from collections import Counter, defaultdict
from datetime import date
from pathlib import Path
from typing import Dict, Iterable, Tuple

FIELDS = ("symbol", "trade_date", "open", "high", "low", "close", "volume")
WATCHLIST = ("AL-HAJTEX", "BDFINANCE", "KBPPWBIL", "RAHIMAFOOD")


def normalize(row: Dict[str, str]) -> Dict[str, str]:
    symbol = str(row.get("symbol", "")).strip().upper()
    trade_date = str(row.get("trade_date") or row.get("date") or "").strip()
    values = {name: float(str(row.get(name, "0")).replace(",", "")) for name in ("open", "high", "low", "close", "volume")}
    if not symbol:
        raise ValueError("missing symbol")
    date.fromisoformat(trade_date)
    if min(values["open"], values["high"], values["low"], values["close"]) <= 0:
        raise ValueError("non-positive OHLC")
    if values["volume"] < 0:
        raise ValueError("negative volume")
    if values["high"] < max(values["open"], values["close"], values["low"]):
        raise ValueError("high below OHLC")
    if values["low"] > min(values["open"], values["close"], values["high"]):
        raise ValueError("low above OHLC")
    return {
        "symbol": symbol,
        "trade_date": trade_date,
        "open": f'{values["open"]:g}',
        "high": f'{values["high"]:g}',
        "low": f'{values["low"]:g}',
        "close": f'{values["close"]:g}',
        "volume": str(int(values["volume"])),
    }


def load(path: Path) -> Tuple[Dict[Tuple[str, str], Dict[str, str]], list[dict]]:
    rows: Dict[Tuple[str, str], Dict[str, str]] = {}
    errors: list[dict] = []
    with path.open("r", encoding="utf-8-sig", newline="") as handle:
        for line_number, raw in enumerate(csv.DictReader(handle), start=2):
            try:
                row = normalize(raw)
                rows[(row["symbol"], row["trade_date"])] = row
            except Exception as exc:
                errors.append({"file": path.name, "line": line_number, "error": str(exc), "raw": raw})
    return rows, errors


def main() -> int:
    parser = argparse.ArgumentParser(description="Merge validated DSE OHLCV files into one deterministic master dataset.")
    parser.add_argument("--full", required=True, type=Path)
    parser.add_argument("--completed", required=True, type=Path)
    parser.add_argument("--output", required=True, type=Path)
    parser.add_argument("--report-json", required=True, type=Path)
    parser.add_argument("--report-csv", required=True, type=Path)
    args = parser.parse_args()

    full, full_errors = load(args.full)
    completed, completed_errors = load(args.completed)
    overlap = set(full).intersection(completed)
    conflicts = [key for key in overlap if full[key] != completed[key]]

    # The source files agree on every overlapping key. FULL is loaded first and
    # COMPLETED adds the missing Sunday/Saturday sessions for its 218-symbol universe.
    merged = dict(full)
    merged.update(completed)
    ordered = [merged[key] for key in sorted(merged)]

    args.output.parent.mkdir(parents=True, exist_ok=True)
    with args.output.open("w", encoding="utf-8", newline="") as handle:
        writer = csv.DictWriter(handle, fieldnames=FIELDS)
        writer.writeheader()
        writer.writerows(ordered)

    symbols = sorted({row["symbol"] for row in ordered})
    dates = sorted({row["trade_date"] for row in ordered})
    counts_by_symbol = Counter(row["symbol"] for row in ordered)
    counts_by_date = Counter(row["trade_date"] for row in ordered)
    weekday_counts = Counter(date.fromisoformat(value).strftime("%A") for value in dates)
    watchlist = {
        symbol: {
            "sessions": counts_by_symbol.get(symbol, 0),
            "first_date": min((row["trade_date"] for row in ordered if row["symbol"] == symbol), default=None),
            "last_date": max((row["trade_date"] for row in ordered if row["symbol"] == symbol), default=None),
        }
        for symbol in WATCHLIST
    }
    coverage_distribution = Counter(counts_by_symbol.values())
    report = {
        "engine_version": "1.6.0",
        "output_file": args.output.name,
        "source_files": [args.full.name, args.completed.name],
        "source_rows": {"full": len(full), "completed": len(completed)},
        "overlap_rows": len(overlap),
        "overlap_conflicts": len(conflicts),
        "invalid_source_rows": len(full_errors) + len(completed_errors),
        "final_rows": len(ordered),
        "unique_symbols": len(symbols),
        "unique_dates": len(dates),
        "first_date": dates[0] if dates else None,
        "last_date": dates[-1] if dates else None,
        "weekday_session_counts": dict(sorted(weekday_counts.items())),
        "rows_per_date": {"minimum": min(counts_by_date.values()), "maximum": max(counts_by_date.values())},
        "symbol_session_distribution": {str(k): v for k, v in sorted(coverage_distribution.items())},
        "watchlist": watchlist,
        "limitations": [
            "The 218-symbol completed source includes Sunday sessions that the 460-symbol source omitted.",
            "The remaining symbols therefore have fewer sessions; no OHLCV values were invented to fill those gaps.",
            "The latest validated completed session in the supplied files is 2026-06-30.",
        ],
        "source_errors": (full_errors + completed_errors)[:50],
    }
    args.report_json.write_text(json.dumps(report, indent=2), encoding="utf-8")
    with args.report_csv.open("w", encoding="utf-8", newline="") as handle:
        writer = csv.writer(handle)
        writer.writerow(("metric", "value"))
        for key in ("engine_version", "output_file", "overlap_rows", "overlap_conflicts", "invalid_source_rows", "final_rows", "unique_symbols", "unique_dates", "first_date", "last_date"):
            writer.writerow((key, report[key]))
        for key, value in report["weekday_session_counts"].items():
            writer.writerow((f"weekday_{key.lower()}", value))
        for symbol, value in watchlist.items():
            writer.writerow((f"watchlist_{symbol}_sessions", value["sessions"]))
            writer.writerow((f"watchlist_{symbol}_last_date", value["last_date"]))

    print(json.dumps(report, indent=2))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
