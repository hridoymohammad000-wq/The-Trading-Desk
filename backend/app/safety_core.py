from __future__ import annotations

import importlib
import os
from datetime import date
from typing import Any, Dict, Iterable, List, Optional

NESTED_PACKAGE = "audit_src.DSE_Swing_Trade_Signal_App_V1_6_0_Portfolio_Intelligence.backend.app"


def max_signal_age_days() -> int:
    try:
        return max(0, int(os.getenv("DSE_SIGNAL_MAX_AGE_DAYS", "7")))
    except ValueError:
        return 7


def freshness(records: Iterable[Dict[str, Any]], as_of_date: Optional[date] = None) -> Dict[str, Any]:
    dates = [str(row.get("trade_date") or row.get("date") or "").strip() for row in records]
    dates = [value for value in dates if value]
    threshold = max_signal_age_days()
    if not dates:
        return {"latest_date": None, "stale_days": None, "max_age_days": threshold, "data_freshness": "EMPTY", "actionable": False}
    latest_date = max(dates)
    stale_days = max(0, ((as_of_date or date.today()) - date.fromisoformat(latest_date)).days)
    actionable = stale_days <= threshold
    return {
        "latest_date": latest_date,
        "stale_days": stale_days,
        "max_age_days": threshold,
        "data_freshness": "CURRENT" if actionable else "STALE",
        "actionable": actionable,
    }


def strict_classification(legacy_signal: str, legacy_grade: str, score: int) -> tuple[str, str]:
    if legacy_signal == "BUY" and legacy_grade == "A+" and 95 <= score <= 100:
        return "BUY", "A+"
    if legacy_signal == "BUY" and 90 <= score <= 94:
        return "BUY", "A"
    if legacy_signal != "AVOID" and 85 <= score <= 89:
        return "WATCH", "B+"
    return "AVOID", "Reject"


def install_signal_safety() -> Any:
    signal_module = importlib.import_module(f"{NESTED_PACKAGE}.signal_bridge")
    legacy_generate = signal_module.generate_swing_signals_py

    def strict_generate(
        records: List[Dict[str, Any]],
        min_rr: float = 2.0,
        *,
        as_of_date: Optional[date] = None,
    ) -> List[Dict[str, Any]]:
        signals = legacy_generate(records, min_rr=min_rr)
        state = freshness(records, as_of_date)
        for signal in signals:
            score = int(signal.get("metrics", {}).get("score", signal.get("confidence", 0)) or 0)
            legacy_signal = str(signal.get("signal", "AVOID"))
            legacy_grade = str(signal.get("grade", "AVOID"))
            signal["signal"], signal["grade"] = strict_classification(legacy_signal, legacy_grade, score)
            if signal["grade"] == "B+":
                signal["actionHint"] = "WATCH ONLY"
            elif signal["grade"] == "Reject":
                signal["actionHint"] = "NO NEW ENTRY"

            signal["staleDays"] = state["stale_days"]
            signal["maxSignalAgeDays"] = state["max_age_days"]
            signal["dataFreshness"] = state["data_freshness"]
            signal["actionable"] = bool(
                state["actionable"]
                and signal["signal"] == "BUY"
                and signal["grade"] in {"A+", "A"}
            )
            if not state["actionable"]:
                if signal["signal"] == "BUY":
                    signal["signal"] = "WATCH"
                signal["status"] = "EXPIRED"
                signal["actionable"] = False
                signal["actionHint"] = "STALE · NO NEW ENTRY"
                signal["reason"] = f"Stale dataset ({state['stale_days']} days old): no new paper-test entry. " + str(signal.get("reason", ""))
            else:
                signal["status"] = "ACTIVE"

        rank = {"A+": 4, "A": 3, "B+": 2, "Reject": 1}
        signals.sort(key=lambda item: (rank.get(str(item.get("grade")), 0), int(item.get("confidence", 0) or 0)), reverse=True)
        return signals

    signal_module.generate_swing_signals_py = strict_generate
    return strict_generate


def patch_daily_snapshot_storage() -> None:
    collector = importlib.import_module(f"{NESTED_PACKAGE}.dse_collector")
    storage = importlib.import_module(f"{NESTED_PACKAGE}.storage")
    original_save = collector.save_market_snapshot

    def safe_save(snapshot_id: str, snapshot: Dict[str, Any]) -> bool:
        if snapshot.get("collector_mode") == "daily" and isinstance(snapshot.get("records"), list):
            previous_latest = storage.latest_market_trade_date()
            rows = snapshot["records"]
            if previous_latest:
                rows = [row for row in rows if str(row.get("trade_date") or row.get("date") or "") > previous_latest]
            if rows:
                snapshot = dict(snapshot)
                snapshot["records"] = rows
                snapshot["record_count"] = len(rows)
                snapshot["total_symbols"] = len({str(row.get("symbol", "")).upper() for row in rows})
                snapshot["start_date"] = min(str(row.get("trade_date") or row.get("date")) for row in rows)
                snapshot["end_date"] = max(str(row.get("trade_date") or row.get("date")) for row in rows)
                snapshot["date"] = snapshot["end_date"]
        return original_save(snapshot_id, snapshot)

    collector.save_market_snapshot = safe_save
