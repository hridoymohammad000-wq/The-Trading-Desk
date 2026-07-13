from __future__ import annotations

import csv
import io
import json
import sys
import socket
import threading
import time
import uuid
from datetime import date, datetime, timedelta, timezone
from pathlib import Path
from typing import Any, Dict, List, Optional, Set, Tuple

import pandas as pd
import requests
from bs4 import BeautifulSoup

from .config import DSE_ALT_SOURCE_NAME, DSE_ALT_SOURCE_URL, DSE_STORAGE_PATH
from .sector_map import get_sector_by_symbol
from .signal_bridge import calculate_market_bias, generate_swing_signals_py
from .storage import (
    all_market_records,
    latest_day_records,
    latest_market_trade_date,
    load_collector_job,
    save_collector_job,
    save_log,
    save_market_snapshot,
    save_signals,
)

# Vendored bdshare library supplied by the user. Keeping it under backend/vendor
# makes the Windows one-click ZIP self-contained apart from pip dependencies.
VENDOR_ROOT = Path(__file__).resolve().parents[1] / "vendor"
if str(VENDOR_ROOT) not in sys.path:
    sys.path.insert(0, str(VENDOR_ROOT))

from bdshare.stock.trading import get_current_trading_code, get_historical_data  # type: ignore  # noqa: E402
from bdshare.util import vars as bdshare_vars  # type: ignore  # noqa: E402
from bdshare.util.helper import BDShareError  # type: ignore  # noqa: E402


# Candidate official/legacy DSE hosts. The collector never disables TLS verification.
# A source is selected only after DNS, HTTPS, and historical-table preflight pass.
DSE_SOURCE_CANDIDATES = [
    "https://www.dse.com.bd/",
    "https://dsebd.org/",
    "https://dsebd.com.bd/",
]
SOURCE_PREFLIGHT_SYMBOL = "GP"
FAIL_FAST_CONSECUTIVE = 3


def _classify_source_error(exc: Exception) -> str:
    text = str(exc)
    lowered = text.lower()
    if "certificate_verify_failed" in lowered or "ssl" in lowered:
        return "TLS_CERTIFICATE_ERROR"
    if "getaddrinfo failed" in lowered or "name resolution" in lowered or "failed to resolve" in lowered:
        return "DNS_RESOLUTION_ERROR"
    if "timeout" in lowered:
        return "TIMEOUT"
    if "403" in lowered:
        return "HTTP_403"
    if "404" in lowered:
        return "HTTP_404"
    if "table" in lowered or "historical data" in lowered:
        return "PARSER_OR_EMPTY_DATA"
    return "NETWORK_OR_SOURCE_ERROR"


def _historical_preflight(base_url: str) -> Dict[str, Any]:
    host = base_url.split("//", 1)[-1].split("/", 1)[0]
    started = time.monotonic()
    try:
        socket.getaddrinfo(host, 443)
    except OSError as exc:
        return {"base_url": base_url, "ok": False, "stage": "DNS", "code": "DNS_RESOLUTION_ERROR", "error": str(exc), "elapsed_ms": int((time.monotonic()-started)*1000)}

    end_day = date.today() - timedelta(days=1)
    start_day = end_day - timedelta(days=14)
    endpoint = base_url.rstrip("/") + "/day_end_archive.php"
    params = {"startDate": str(start_day), "endDate": str(end_day), "inst": SOURCE_PREFLIGHT_SYMBOL, "archive": "data"}
    headers = {
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) DSE-Swing-Trade-Signal/1.4",
        "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
    }
    try:
        response = requests.get(endpoint, params=params, headers=headers, timeout=(5, 15), allow_redirects=True)
        response.raise_for_status()
        soup = BeautifulSoup(response.content, "lxml")
        table = soup.find("table", attrs={"class": "table table-bordered background-white shares-table fixedHeader"}) or soup.find("table")
        if table is None:
            raise RuntimeError("Historical archive table was not found in the response.")
        data_rows = [row for row in table.find_all("tr")[1:] if len(row.find_all("td")) >= 12]
        if not data_rows:
            raise RuntimeError("Historical archive returned no parseable rows for source preflight.")
        return {"base_url": base_url, "ok": True, "stage": "READY", "code": "OK", "rows": len(data_rows), "final_url": response.url, "elapsed_ms": int((time.monotonic()-started)*1000)}
    except Exception as exc:
        return {"base_url": base_url, "ok": False, "stage": "HTTPS_OR_PARSE", "code": _classify_source_error(exc), "error": str(exc)[:500], "elapsed_ms": int((time.monotonic()-started)*1000)}


def select_working_dse_source() -> Tuple[Optional[str], List[Dict[str, Any]]]:
    diagnostics: List[Dict[str, Any]] = []
    for base_url in DSE_SOURCE_CANDIDATES:
        result = _historical_preflight(base_url)
        diagnostics.append(result)
        if result.get("ok"):
            # Configure vendored bdshare to use the verified host only.
            bdshare_vars.DSE_URL = base_url
            bdshare_vars.DSE_ALT_URL = base_url
            return base_url, diagnostics
    return None, diagnostics

TICKERS_PATH = VENDOR_ROOT / "bdshare" / "util" / "tickers.json"
EXPORT_DIR = Path(DSE_STORAGE_PATH) / "exports"

_JOB_LOCK = threading.RLock()
_JOBS: Dict[str, Dict[str, Any]] = {}


def _utc_now() -> str:
    return datetime.now(timezone.utc).isoformat()


def _safe_float(value: Any) -> Optional[float]:
    try:
        if value is None or value == "":
            return None
        result = float(str(value).replace(",", "").strip())
        return result if pd.notna(result) else None
    except (TypeError, ValueError):
        return None


def _safe_int(value: Any) -> Optional[int]:
    number = _safe_float(value)
    return int(number) if number is not None else None


def _normalize_date(value: Any) -> Optional[str]:
    try:
        parsed = pd.to_datetime(value, errors="coerce", dayfirst=False)
        if pd.isna(parsed):
            parsed = pd.to_datetime(value, errors="coerce", dayfirst=True)
        if pd.isna(parsed):
            return None
        return parsed.date().isoformat()
    except Exception:
        return None


def _validate_ohlcv(symbol: str, trade_date: str, o: float, h: float, l: float, c: float, v: int) -> Optional[str]:
    if not symbol:
        return "missing symbol"
    if not trade_date:
        return "invalid date"
    if min(o, h, l, c) <= 0:
        return "OHLC prices must be positive"
    if v < 0:
        return "volume cannot be negative"
    if h < max(o, c, l):
        return "high is below open/close/low"
    if l > min(o, c, h):
        return "low is above open/close/high"
    return None


def parse_and_validate_csv_data(
    csv_content: str,
    default_date: Optional[str] = None,
) -> Tuple[List[Dict[str, Any]], List[Dict[str, Any]], Dict[str, int]]:
    """Parse SYMBOL,DATE/TRADE_DATE,OPEN,HIGH,LOW,CLOSE,VOLUME CSV data."""
    valid_records: List[Dict[str, Any]] = []
    invalid_rows: List[Dict[str, Any]] = []
    duplicate_rows_count = 0
    missing_values_count = 0

    reader = csv.reader(io.StringIO(csv_content.strip()))
    try:
        headers = next(reader)
    except StopIteration:
        return [], [{"row_number": 1, "raw_data": "", "errors": ["Empty CSV dataset"], "type": "INVALID"}], {"duplicates": 0, "missing": 0}

    headers_upper = [h.strip().upper() for h in headers]
    required = ["SYMBOL", "OPEN", "HIGH", "LOW", "CLOSE", "VOLUME"]
    date_header = "DATE" if "DATE" in headers_upper else ("TRADE_DATE" if "TRADE_DATE" in headers_upper else None)
    missing_headers = [h for h in required if h not in headers_upper]
    if date_header is None:
        missing_headers.append("DATE or TRADE_DATE")
    if missing_headers:
        return [], [{"row_number": 1, "raw_data": ",".join(headers), "errors": [f"Missing required columns: {', '.join(missing_headers)}"], "type": "INVALID"}], {"duplicates": 0, "missing": 0}

    idx = {name: headers_upper.index(name) for name in required}
    idx["DATE"] = headers_upper.index(date_header)
    seen: Set[str] = set()

    for row_number, row in enumerate(reader, start=2):
        if not row or not "".join(row).strip():
            continue
        errors: List[str] = []
        try:
            symbol = row[idx["SYMBOL"]].strip().upper()
            trade_date = row[idx["DATE"]].strip() or (default_date or "")
            o = _safe_float(row[idx["OPEN"]])
            h = _safe_float(row[idx["HIGH"]])
            l = _safe_float(row[idx["LOW"]])
            c = _safe_float(row[idx["CLOSE"]])
            v = _safe_int(row[idx["VOLUME"]])
        except IndexError:
            symbol, trade_date, o, h, l, c, v = "", "", None, None, None, None, None
            errors.append("Column count mismatch")

        if not symbol:
            errors.append("SYMBOL is empty")
        normalized_date = _normalize_date(trade_date)
        if not normalized_date:
            errors.append("DATE is empty or invalid")
        if any(value is None for value in (o, h, l, c, v)):
            errors.append("One or more required numeric values are missing or invalid")
            missing_values_count += 1
        elif normalized_date:
            validation_error = _validate_ohlcv(symbol, normalized_date, o, h, l, c, v)
            if validation_error:
                errors.append(validation_error)

        key = f"{symbol}_{normalized_date}"
        if symbol and normalized_date and key in seen:
            duplicate_rows_count += 1
            invalid_rows.append({"row_number": row_number, "raw_data": ",".join(row), "errors": [f"Duplicate record ignored: {symbol} on {normalized_date}"], "type": "DUPLICATE"})
            continue
        seen.add(key)

        if errors:
            invalid_rows.append({"row_number": row_number, "raw_data": ",".join(row), "errors": errors, "type": "INVALID"})
            continue

        valid_records.append({
            "symbol": symbol,
            "trade_date": normalized_date,
            "open": o,
            "high": h,
            "low": l,
            "close": c,
            "volume": v,
            "sector": get_sector_by_symbol(symbol),
            "source": "MANUAL_IMPORT",
            "created_at": _utc_now(),
        })

    return valid_records, invalid_rows, {"duplicates": duplicate_rows_count, "missing": missing_values_count}


def fetch_alternate_source_history(start: str, end: str) -> Tuple[List[Dict[str, Any]], int, Dict[str, Any]]:
    if not DSE_ALT_SOURCE_URL:
        raise RuntimeError("No alternate source URL is configured.")

    headers = {
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) DSE-Swing-Trade-Signal/1.6",
        "Accept": "text/csv,text/plain,application/octet-stream,*/*;q=0.8",
    }
    response = requests.get(DSE_ALT_SOURCE_URL, headers=headers, timeout=(10, 45), allow_redirects=True)
    response.raise_for_status()

    csv_text = response.content.decode("utf-8-sig", errors="replace")
    valid_rows, invalid_rows, stats = parse_and_validate_csv_data(csv_text)
    if not valid_rows:
        raise RuntimeError("Alternate CSV source returned no valid OHLCV rows.")

    start_iso = date.fromisoformat(start)
    end_iso = date.fromisoformat(end)
    filtered_rows: List[Dict[str, Any]] = []
    for row in valid_rows:
        trade_day = date.fromisoformat(str(row["trade_date"]))
        if start_iso <= trade_day <= end_iso:
            row["source"] = "REAL"
            row["created_at"] = _utc_now()
            filtered_rows.append(row)

    if not filtered_rows:
        raise RuntimeError(
            f"Alternate CSV source is reachable, but no rows were inside the requested date range {start} to {end}."
        )

    meta = {
        "source_name": DSE_ALT_SOURCE_NAME,
        "source_url": DSE_ALT_SOURCE_URL,
        "downloaded_rows": len(valid_rows),
        "filtered_rows": len(filtered_rows),
        "invalid_rows": len(invalid_rows),
        "stats": stats,
    }
    return filtered_rows, len(invalid_rows), meta


def load_bundled_symbols() -> List[str]:
    if not TICKERS_PATH.exists():
        raise FileNotFoundError(f"Bundled ticker list not found: {TICKERS_PATH}")
    payload = json.loads(TICKERS_PATH.read_text(encoding="utf-8"))
    values = payload.get("tickers", []) if isinstance(payload, dict) else []
    seen: Set[str] = set()
    symbols: List[str] = []
    for value in values:
        symbol = str(value).strip().upper()
        if symbol and symbol not in seen:
            seen.add(symbol)
            symbols.append(symbol)
    return symbols


def load_symbols(refresh_from_dse: bool = True) -> Tuple[List[str], str]:
    """Refresh current codes from DSE; use bundled bdshare tickers if unavailable."""
    if refresh_from_dse:
        try:
            frame = get_current_trading_code(retry_count=2, pause=0.4)
            values = frame["symbol"].dropna().astype(str).str.strip().str.upper().tolist()
            symbols = list(dict.fromkeys(value for value in values if value))
            if symbols:
                return symbols, "DSE_CURRENT_TRADING_CODES"
        except Exception as exc:
            save_log("WARN", f"Could not refresh current DSE symbols; using bundled list: {exc}")
    return load_bundled_symbols(), "BUNDLED_BDSHARE_TICKERS"


def normalize_historical_frame(frame: pd.DataFrame, symbol: str) -> Tuple[List[Dict[str, Any]], List[str]]:
    if frame is None or frame.empty:
        return [], ["No rows returned"]
    work = frame.reset_index()
    work.columns = [str(col).strip().lower() for col in work.columns]
    records: List[Dict[str, Any]] = []
    errors: List[str] = []

    for idx, raw in work.iterrows():
        row_symbol = str(raw.get("symbol") or symbol).strip().upper()
        trade_date = _normalize_date(raw.get("date"))
        o = _safe_float(raw.get("open"))
        h = _safe_float(raw.get("high"))
        l = _safe_float(raw.get("low"))
        c = _safe_float(raw.get("close"))
        v = _safe_int(raw.get("volume"))
        if trade_date is None or any(value is None for value in (o, h, l, c, v)):
            errors.append(f"row {idx + 1}: incomplete OHLCV")
            continue
        validation_error = _validate_ohlcv(row_symbol, trade_date, o, h, l, c, v)
        if validation_error:
            errors.append(f"row {idx + 1}: {validation_error}")
            continue
        records.append({
            "symbol": row_symbol,
            "trade_date": trade_date,
            "open": o,
            "high": h,
            "low": l,
            "close": c,
            "volume": v,
            "sector": get_sector_by_symbol(row_symbol),
            "source": "REAL",
            "created_at": _utc_now(),
        })

    unique = {(row["symbol"], row["trade_date"]): row for row in records}
    return sorted(unique.values(), key=lambda row: (row["symbol"], row["trade_date"])), errors


def fetch_symbol_history(symbol: str, start: str, end: str) -> Tuple[List[Dict[str, Any]], List[str]]:
    frame = get_historical_data(start=start, end=end, code=symbol, retry_count=3, pause=0.5)
    return normalize_historical_frame(frame, symbol)


def _set_job(job: Dict[str, Any]) -> None:
    with _JOB_LOCK:
        _JOBS[job["id"]] = dict(job)
    save_collector_job(job)


def get_collection_job(job_id: str) -> Optional[Dict[str, Any]]:
    with _JOB_LOCK:
        if job_id in _JOBS:
            return dict(_JOBS[job_id])
    return load_collector_job(job_id)


def _update_job(job_id: str, **changes: Any) -> Dict[str, Any]:
    job = get_collection_job(job_id) or {"id": job_id}
    job.update(changes)
    job["updated_at"] = _utc_now()
    _set_job(job)
    return job


def _write_export(records: List[Dict[str, Any]], errors: List[Dict[str, str]], prefix: str) -> Dict[str, str]:
    EXPORT_DIR.mkdir(parents=True, exist_ok=True)
    master = EXPORT_DIR / f"{prefix}_ohlcv.csv"
    error_file = EXPORT_DIR / f"{prefix}_errors.csv"
    with master.open("w", newline="", encoding="utf-8-sig") as handle:
        writer = csv.DictWriter(handle, fieldnames=["symbol", "trade_date", "open", "high", "low", "close", "volume", "sector", "source"])
        writer.writeheader()
        for row in records:
            writer.writerow({key: row.get(key) for key in writer.fieldnames})
    with error_file.open("w", newline="", encoding="utf-8-sig") as handle:
        writer = csv.DictWriter(handle, fieldnames=["symbol", "error"])
        writer.writeheader()
        writer.writerows(errors)
    return {"master_csv": str(master), "error_csv": str(error_file)}


def _run_collection(job_id: str, mode: str, days_back: int, requested_symbols: Optional[List[str]], refresh_symbols: bool, pause_seconds: float) -> None:
    try:
        today = date.today()
        if mode == "daily":
            latest = latest_market_trade_date()
            if not latest:
                raise RuntimeError("No historical database exists. Run the 1-year backfill first.")
            start_date = date.fromisoformat(latest) + timedelta(days=1)
            if start_date > today:
                _update_job(job_id, status="COMPLETED", stage="UP_TO_DATE", progress=100, message=f"Market database is already current through {latest}.", result={"new_records": 0, "latest_date": latest})
                return
        else:
            start_date = today - timedelta(days=max(60, min(days_back, 730)))

        _update_job(job_id, status="RUNNING", stage="SOURCE_CHECK", progress=1, message="Checking DSE source DNS, TLS certificate, and historical archive response before full collection.")
        selected_source, source_diagnostics = select_working_dse_source()
        using_alt_source = False
        alt_source_meta: Dict[str, Any] = {}
        if not selected_source and not DSE_ALT_SOURCE_URL:
            codes = ", ".join(f"{item['base_url']}={item.get('code')}" for item in source_diagnostics)
            raise RuntimeError(
                "No verified DSE historical source is currently reachable. "
                f"Source checks: {codes}. Full-market collection was stopped before symbol processing. "
                "Use validated CSV import and retry later; TLS verification was not bypassed."
            )
        if selected_source:
            _update_job(job_id, stage="SOURCE_READY", progress=2, message=f"Verified DSE source: {selected_source}", selected_source=selected_source, source_diagnostics=source_diagnostics)
        else:
            using_alt_source = True
            _update_job(
                job_id,
                stage="ALT_SOURCE",
                progress=2,
                message=f"Official DSE sources are unreachable. Trying alternate CSV source: {DSE_ALT_SOURCE_NAME}.",
                source_diagnostics=source_diagnostics,
                alternate_source_url=DSE_ALT_SOURCE_URL,
            )

        all_records: List[Dict[str, Any]] = []
        failed: List[Dict[str, str]] = []
        invalid_count = 0
        symbol_source = "ALT_CSV_SOURCE"
        symbols: List[str] = []
        if using_alt_source:
            all_records, invalid_count, alt_source_meta = fetch_alternate_source_history(str(start_date), str(today))
            if requested_symbols:
                requested = {str(value).strip().upper() for value in requested_symbols if str(value).strip()}
                all_records = [row for row in all_records if row["symbol"] in requested]
            symbols = sorted({row["symbol"] for row in all_records})
            if not symbols:
                raise RuntimeError("Alternate source returned no rows for the requested symbols/date range.")
            _update_job(
                job_id,
                status="RUNNING",
                stage="ALT_SOURCE_READY",
                progress=88,
                total_symbols=len(symbols),
                completed_symbols=len(symbols),
                successful_symbols=len(symbols),
                failed_symbols=0,
                records_collected=len(all_records),
                symbol_source=symbol_source,
                start_date=str(start_date),
                end_date=str(today),
                message=f"Loaded {len(all_records)} validated rows from alternate source {DSE_ALT_SOURCE_NAME}.",
            )
        else:
            if requested_symbols:
                symbols = list(dict.fromkeys(str(value).strip().upper() for value in requested_symbols if str(value).strip()))
                symbol_source = "REQUESTED_SYMBOLS"
            else:
                symbols, symbol_source = load_symbols(refresh_from_dse=refresh_symbols)

            if not symbols:
                raise RuntimeError("No DSE symbols were available for collection.")

            _update_job(job_id, status="RUNNING", stage="FETCHING", progress=1, message=f"Collecting {len(symbols)} symbols from {start_date} to {today}.", total_symbols=len(symbols), completed_symbols=0, symbol_source=symbol_source, start_date=str(start_date), end_date=str(today))

            consecutive_failures = 0

            for index, symbol in enumerate(symbols, start=1):
                try:
                    rows, errors = fetch_symbol_history(symbol, str(start_date), str(today))
                    all_records.extend(rows)
                    invalid_count += len(errors)
                    if not rows:
                        failed.append({"symbol": symbol, "error": errors[0] if errors else "No valid rows returned"})
                        consecutive_failures += 1
                    else:
                        consecutive_failures = 0
                except Exception as exc:
                    failed.append({"symbol": symbol, "error": str(exc).replace("\n", " ")[:600]})
                    consecutive_failures += 1
                progress = min(88, max(2, int(index / len(symbols) * 88)))
                _update_job(job_id, progress=progress, completed_symbols=index, current_symbol=symbol, successful_symbols=index - len(failed), failed_symbols=len(failed), records_collected=len(all_records), consecutive_failures=consecutive_failures, message=f"Processed {index}/{len(symbols)} symbols. Latest: {symbol}")
                if consecutive_failures >= FAIL_FAST_CONSECUTIVE and not all_records:
                    recent = failed[-FAIL_FAST_CONSECUTIVE:]
                    summary = " | ".join(f"{item['symbol']}: {item['error'][:180]}" for item in recent)
                    raise RuntimeError(
                        f"Collector stopped after {FAIL_FAST_CONSECUTIVE} consecutive symbol failures with zero rows. "
                        f"Verified source became unusable or its page format changed. Recent failures: {summary}. "
                        "Previous validated market database remains active."
                    )
                if pause_seconds > 0 and index < len(symbols):
                    time.sleep(max(0.0, min(pause_seconds, 3.0)))

        if not all_records:
            if mode == "daily":
                latest = latest_market_trade_date()
                result = {
                    "mode": mode,
                    "new_records": 0,
                    "latest_date": latest,
                    "total_symbols": 0,
                    "failed_symbols": len(failed),
                    "message": "No new DSE EOD rows were available for the requested date range.",
                    "errors": failed[:50],
                }
                _update_job(
                    job_id,
                    status="COMPLETED",
                    stage="NO_NEW_DATA",
                    progress=100,
                    message=f"No new EOD rows found. Previous database remains active through {latest}.",
                    result=result,
                )
                return
            raise RuntimeError(f"DSE collection returned zero validated OHLCV rows. Failed symbols: {len(failed)}")

        new_unique = {(row["symbol"], row["trade_date"]): row for row in all_records}
        new_records = sorted(new_unique.values(), key=lambda row: (row["symbol"], row["trade_date"]))
        if mode == "daily":
            # Daily refresh must preserve the validated historical base and append/overwrite
            # only the newly collected symbol/date rows.
            merged = {(row["symbol"], row["trade_date"]): row for row in all_market_records()}
            merged.update(new_unique)
            records = sorted(merged.values(), key=lambda row: (row["symbol"], row["trade_date"]))
        else:
            records = new_records
        latest_date = max(row["trade_date"] for row in records)
        snapshot_id = f"DSE-REAL-{mode.upper()}-{latest_date.replace('-', '')}-{uuid.uuid4().hex[:6]}"
        status = "PASSED_WITH_WARNINGS" if failed or invalid_count else "PASSED"
        snapshot = {
            "id": snapshot_id,
            "date": latest_date,
            "start_date": min(row["trade_date"] for row in records),
            "end_date": latest_date,
            "origin": "REAL",
            "source": DSE_ALT_SOURCE_NAME if using_alt_source else "DSE_DAY_END_ARCHIVE_VIA_BDSHARE",
            "collector": "alt_csv_source" if using_alt_source else "bdshare",
            "collector_mode": mode,
            "total_symbols": len({row["symbol"] for row in records}),
            "record_count": len(records),
            "engine_version": "V1.6",
            "created_time": _utc_now(),
            "status": status,
            "records": records,
        }
        _update_job(job_id, stage="STORING", progress=91, message=f"Saving {len(records)} validated rows to active server storage.")
        save_market_snapshot(snapshot_id, snapshot)

        day_records = [row for row in records if row["trade_date"] == latest_date]
        signal_records = records if mode == "backfill" else all_market_records()
        if not signal_records:
            signal_records = records
        _update_job(job_id, stage="SIGNALS", progress=95, message=f"Running historical signal engine on {len(signal_records)} OHLCV rows.")
        signals = generate_swing_signals_py(signal_records)
        save_signals(signals, "REAL")
        exports = _write_export(records, failed, f"dse_{mode}_{latest_date}")
        result = {
            "snapshot_id": snapshot_id,
            "mode": mode,
            "source": (
                f"Alternate CSV source ({DSE_ALT_SOURCE_NAME})"
                if using_alt_source
                else f"DSE day-end archive via vendored bdshare ({selected_source})"
            ),
            "symbol_source": symbol_source,
            "total_symbols": len({row["symbol"] for row in records}),
            "successful_symbols": len(symbols) - len(failed),
            "failed_symbols": len(failed),
            "records_collected": len(records),
            "new_records_collected": len(new_records),
            "invalid_rows": invalid_count,
            "start_date": snapshot["start_date"],
            "end_date": latest_date,
            "market_bias": calculate_market_bias(day_records),
            "signals_generated": len(signals),
            "exports": exports,
            "errors": failed[:50],
        }
        if alt_source_meta:
            result["alternate_source"] = alt_source_meta
        summary_message = (
            f"Collection complete: {len(new_records)} new rows merged into {len(records)} total rows across "
            f"{result['total_symbols']} symbols."
            if mode == "daily"
            else f"Collection complete: {len(records)} rows across {result['total_symbols']} symbols."
        )
        _update_job(job_id, status="COMPLETED", stage="COMPLETED", progress=100, message=summary_message, result=result)
        save_log("INFO", f"Collector job {job_id} completed: {result}")
    except Exception as exc:
        message = str(exc).replace("\n", " ")[:1000]
        _update_job(job_id, status="FAILED", stage="FAILED", progress=0, message=message, error=message)
        save_log("ERROR", f"Collector job {job_id} failed: {message}")


def start_collection_job(
    mode: str = "backfill",
    days_back: int = 365,
    symbols: Optional[List[str]] = None,
    refresh_symbols: bool = True,
    pause_seconds: float = 0.8,
) -> Dict[str, Any]:
    normalized_mode = mode.lower().strip()
    if normalized_mode not in {"backfill", "daily"}:
        raise ValueError("Collector mode must be 'backfill' or 'daily'.")
    with _JOB_LOCK:
        active = next((job for job in _JOBS.values() if job.get("status") in {"QUEUED", "RUNNING"}), None)
    if active:
        raise ValueError(f"Collector job {active['id']} is already running.")
    job_id = f"COLLECT-{datetime.now().strftime('%Y%m%d%H%M%S')}-{uuid.uuid4().hex[:5]}"
    job = {
        "id": job_id,
        "status": "QUEUED",
        "stage": "QUEUED",
        "mode": normalized_mode,
        "progress": 0,
        "message": "Collector job queued.",
        "created_at": _utc_now(),
        "updated_at": _utc_now(),
    }
    _set_job(job)
    thread = threading.Thread(
        target=_run_collection,
        args=(job_id, normalized_mode, days_back, symbols, refresh_symbols, pause_seconds),
        name=f"dse-collector-{job_id}",
        daemon=True,
    )
    thread.start()
    return job


def trigger_scraped_collection_placeholder() -> Dict[str, Any]:
    """Report collector capability without claiming the source is currently reachable."""
    return {
        "status": "PREFLIGHT_REQUIRED",
        "message": "DSE collector is integrated, but every run first verifies DNS, TLS, and archive parsing. Full collection starts only after source preflight passes.",
        "modes": ["backfill", "daily"],
        "candidate_sources": DSE_SOURCE_CANDIDATES,
        "tls_verification": "ENABLED",
        "fail_fast_consecutive": FAIL_FAST_CONSECUTIVE,
    }
