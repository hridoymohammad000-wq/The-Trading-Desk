from __future__ import annotations

import json
import os
import sqlite3
import threading
from datetime import datetime, timezone
from typing import Any, Dict, List, Optional

from .config import DSE_DATABASE_PATH, DSE_STORAGE_PATH

_LOCK = threading.RLock()


def _conn() -> sqlite3.Connection:
    os.makedirs(DSE_STORAGE_PATH, exist_ok=True)
    con = sqlite3.connect(DSE_DATABASE_PATH, timeout=60, check_same_thread=False)
    con.row_factory = sqlite3.Row
    con.execute("PRAGMA journal_mode=WAL")
    con.execute("PRAGMA synchronous=NORMAL")
    return con


def _now() -> str:
    return datetime.now(timezone.utc).isoformat()


def init_storage() -> None:
    with _LOCK, _conn() as con:
        con.executescript(
            """
            CREATE TABLE IF NOT EXISTS kv_store(
                key TEXT PRIMARY KEY,
                value TEXT NOT NULL,
                origin TEXT NOT NULL DEFAULT 'REAL',
                updated_at TEXT NOT NULL
            );
            CREATE TABLE IF NOT EXISTS market_snapshots(
                id TEXT PRIMARY KEY,
                trade_date TEXT NOT NULL,
                origin TEXT NOT NULL,
                payload TEXT NOT NULL,
                created_at TEXT NOT NULL
            );
            CREATE TABLE IF NOT EXISTS market_records(
                snapshot_id TEXT NOT NULL,
                symbol TEXT NOT NULL,
                trade_date TEXT NOT NULL,
                open REAL NOT NULL,
                high REAL NOT NULL,
                low REAL NOT NULL,
                close REAL NOT NULL,
                volume INTEGER NOT NULL,
                sector TEXT NOT NULL DEFAULT 'Unknown',
                origin TEXT NOT NULL,
                created_at TEXT NOT NULL,
                PRIMARY KEY(snapshot_id, symbol, trade_date),
                FOREIGN KEY(snapshot_id) REFERENCES market_snapshots(id) ON DELETE CASCADE
            );
            CREATE INDEX IF NOT EXISTS idx_market_symbol_date ON market_records(symbol, trade_date);
            CREATE INDEX IF NOT EXISTS idx_market_date ON market_records(trade_date);
            CREATE TABLE IF NOT EXISTS signals(
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                origin TEXT NOT NULL,
                payload TEXT NOT NULL,
                created_at TEXT NOT NULL
            );
            CREATE TABLE IF NOT EXISTS collector_jobs(
                id TEXT PRIMARY KEY,
                payload TEXT NOT NULL,
                updated_at TEXT NOT NULL
            );
            CREATE TABLE IF NOT EXISTS logs(
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                level TEXT NOT NULL,
                message TEXT NOT NULL,
                created_at TEXT NOT NULL
            );
            """
        )
        con.execute("PRAGMA foreign_keys=ON")
        set_value("schema_version", {"version": "1.6.0"}, "REAL", con)


def set_value(key: str, value: Any, origin: str = "REAL", con: Optional[sqlite3.Connection] = None) -> None:
    own = con is None
    con = con or _conn()
    con.execute(
        """
        INSERT INTO kv_store(key,value,origin,updated_at) VALUES(?,?,?,?)
        ON CONFLICT(key) DO UPDATE SET
          value=excluded.value,
          origin=excluded.origin,
          updated_at=excluded.updated_at
        """,
        (key, json.dumps(value, default=str), origin, _now()),
    )
    if own:
        con.commit()
        con.close()


def get_value(key: str, default: Any = None) -> Any:
    with _LOCK, _conn() as con:
        row = con.execute("SELECT value,origin,updated_at FROM kv_store WHERE key=?", (key,)).fetchone()
        if not row:
            return default
        return {"data": json.loads(row["value"]), "origin": row["origin"], "updated_at": row["updated_at"]}


def delete_value(key: str) -> None:
    with _LOCK, _conn() as con:
        con.execute("DELETE FROM kv_store WHERE key=?", (key,))


def save_market_snapshot(snapshot_id: str, snapshot_data: Dict[str, Any]) -> bool:
    origin = snapshot_data.get("origin", "MANUAL_IMPORT")
    records = snapshot_data.get("records", []) or []
    metadata = {k: v for k, v in snapshot_data.items() if k != "records"}
    metadata["record_count"] = len(records)
    symbols = {str(r.get("symbol", "")).upper() for r in records if r.get("symbol")}
    metadata["total_symbols"] = len(symbols)

    with _LOCK, _conn() as con:
        con.execute("PRAGMA foreign_keys=ON")
        con.execute(
            "INSERT OR REPLACE INTO market_snapshots(id,trade_date,origin,payload,created_at) VALUES(?,?,?,?,?)",
            (
                snapshot_id,
                snapshot_data.get("date", ""),
                origin,
                json.dumps(metadata, default=str),
                snapshot_data.get("created_time") or _now(),
            ),
        )
        con.execute("DELETE FROM market_records WHERE snapshot_id=?", (snapshot_id,))
        now = _now()
        rows = []
        for rec in records:
            rows.append(
                (
                    snapshot_id,
                    str(rec.get("symbol", "")).upper(),
                    str(rec.get("trade_date") or rec.get("date") or ""),
                    float(rec.get("open", 0)),
                    float(rec.get("high", 0)),
                    float(rec.get("low", 0)),
                    float(rec.get("close", 0)),
                    int(float(rec.get("volume", 0))),
                    rec.get("sector") or "Unknown",
                    rec.get("source") or origin,
                    rec.get("created_at") or now,
                )
            )
        if rows:
            con.executemany(
                """
                INSERT OR REPLACE INTO market_records(
                    snapshot_id,symbol,trade_date,open,high,low,close,volume,sector,origin,created_at
                ) VALUES(?,?,?,?,?,?,?,?,?,?,?)
                """,
                rows,
            )
        active_meta = dict(metadata)
        active_meta["id"] = snapshot_id
        set_value("active_market_dataset", active_meta, origin, con)
    return True


def _records_for_snapshot(con: sqlite3.Connection, snapshot_id: str) -> List[Dict[str, Any]]:
    rows = con.execute(
        """
        SELECT symbol,trade_date,open,high,low,close,volume,sector,origin,created_at
        FROM market_records WHERE snapshot_id=? ORDER BY symbol,trade_date
        """,
        (snapshot_id,),
    ).fetchall()
    return [dict(row) | {"source": row["origin"]} for row in rows]


def load_market_snapshot(snapshot_id: str, include_records: bool = True) -> Optional[Dict[str, Any]]:
    with _LOCK, _conn() as con:
        row = con.execute(
            "SELECT id,trade_date,origin,payload,created_at FROM market_snapshots WHERE id=?",
            (snapshot_id,),
        ).fetchone()
        if not row:
            return None
        payload = json.loads(row["payload"])
        payload.setdefault("id", row["id"])
        payload.setdefault("date", row["trade_date"])
        payload.setdefault("origin", row["origin"])
        payload.setdefault("created_time", row["created_at"])
        if include_records:
            records = _records_for_snapshot(con, snapshot_id)
            # Backward compatibility with older ZIPs whose records were embedded in JSON.
            if not records and isinstance(payload.get("records"), list):
                records = payload["records"]
            payload["records"] = records
        else:
            payload.pop("records", None)
        return payload


def list_market_snapshots() -> List[Dict[str, Any]]:
    with _LOCK, _conn() as con:
        rows = con.execute(
            "SELECT id,trade_date,origin,payload,created_at FROM market_snapshots ORDER BY created_at DESC"
        ).fetchall()
        out: List[Dict[str, Any]] = []
        for row in rows:
            payload = json.loads(row["payload"])
            stat = con.execute(
                """
                SELECT COUNT(*) AS record_count, COUNT(DISTINCT symbol) AS total_symbols,
                       MIN(trade_date) AS start_date, MAX(trade_date) AS end_date
                FROM market_records WHERE snapshot_id=?
                """,
                (row["id"],),
            ).fetchone()
            embedded_records = payload.get("records") if isinstance(payload.get("records"), list) else []
            record_count = stat["record_count"] or len(embedded_records)
            total_symbols = stat["total_symbols"] or len({r.get("symbol") for r in embedded_records})
            out.append(
                {
                    "id": row["id"],
                    "date": row["trade_date"],
                    "origin": row["origin"],
                    "total_symbols": total_symbols,
                    "record_count": record_count,
                    "start_date": stat["start_date"] or payload.get("start_date"),
                    "end_date": stat["end_date"] or payload.get("end_date") or row["trade_date"],
                    "engine_version": payload.get("engine_version", "V1.4"),
                    "created_time": row["created_at"],
                    "status": payload.get("status", "PASSED"),
                    "source": payload.get("source", "manual"),
                }
            )
        return out


def delete_market_snapshot(snapshot_id: str) -> bool:
    with _LOCK, _conn() as con:
        con.execute("DELETE FROM market_records WHERE snapshot_id=?", (snapshot_id,))
        cur = con.execute("DELETE FROM market_snapshots WHERE id=?", (snapshot_id,))
        return cur.rowcount > 0


def query_symbol_ohlcv(symbol: str, snapshot_id: Optional[str] = None) -> List[Dict[str, Any]]:
    symbol = symbol.upper().strip()
    with _LOCK, _conn() as con:
        params: List[Any] = [symbol]
        where = "WHERE mr.symbol=?"
        if snapshot_id:
            where += " AND mr.snapshot_id=?"
            params.append(snapshot_id)
        rows = con.execute(
            f"""
            SELECT mr.trade_date AS time,mr.open,mr.high,mr.low,mr.close,mr.volume,mr.origin,
                   ms.created_at,mr.snapshot_id
            FROM market_records mr
            JOIN market_snapshots ms ON ms.id=mr.snapshot_id
            {where}
            ORDER BY mr.trade_date ASC, ms.created_at ASC
            """,
            params,
        ).fetchall()
        # Latest-created snapshot wins for duplicate symbol/date rows.
        by_date: Dict[str, Dict[str, Any]] = {}
        for row in rows:
            by_date[row["time"]] = {
                "time": row["time"],
                "open": row["open"],
                "high": row["high"],
                "low": row["low"],
                "close": row["close"],
                "volume": row["volume"],
                "origin": row["origin"],
                "snapshot_id": row["snapshot_id"],
            }
        return [by_date[k] for k in sorted(by_date)]


def list_symbols() -> List[str]:
    with _LOCK, _conn() as con:
        return [row["symbol"] for row in con.execute("SELECT DISTINCT symbol FROM market_records ORDER BY symbol")]


def latest_market_trade_date() -> Optional[str]:
    with _LOCK, _conn() as con:
        row = con.execute("SELECT MAX(trade_date) AS d FROM market_records").fetchone()
        return row["d"] if row and row["d"] else None


def all_market_records() -> List[Dict[str, Any]]:
    with _LOCK, _conn() as con:
        rows = con.execute(
            """
            SELECT mr.symbol,mr.trade_date,mr.open,mr.high,mr.low,mr.close,mr.volume,mr.sector,mr.origin,
                   ms.created_at
            FROM market_records mr
            JOIN market_snapshots ms ON ms.id=mr.snapshot_id
            ORDER BY mr.symbol,mr.trade_date,ms.created_at
            """
        ).fetchall()
        unique: Dict[tuple[str, str], Dict[str, Any]] = {}
        for row in rows:
            key = (row["symbol"], row["trade_date"])
            unique[key] = {
                "symbol": row["symbol"],
                "trade_date": row["trade_date"],
                "open": row["open"],
                "high": row["high"],
                "low": row["low"],
                "close": row["close"],
                "volume": row["volume"],
                "sector": row["sector"],
                "source": row["origin"],
            }
        return list(unique.values())


def latest_day_records() -> List[Dict[str, Any]]:
    latest = latest_market_trade_date()
    if not latest:
        return []
    return [row for row in all_market_records() if row["trade_date"] == latest]


def save_signals(signals: Any, origin: str = "REAL") -> None:
    with _LOCK, _conn() as con:
        con.execute(
            "INSERT INTO signals(origin,payload,created_at) VALUES(?,?,?)",
            (origin, json.dumps(signals, default=str), _now()),
        )
        set_value("dse_signals", signals, origin, con)


def latest_signals() -> List[Dict[str, Any]]:
    with _LOCK, _conn() as con:
        row = con.execute("SELECT payload FROM signals ORDER BY id DESC LIMIT 1").fetchone()
        return json.loads(row["payload"]) if row else []


def save_collector_job(job: Dict[str, Any]) -> None:
    with _LOCK, _conn() as con:
        con.execute(
            "INSERT OR REPLACE INTO collector_jobs(id,payload,updated_at) VALUES(?,?,?)",
            (job["id"], json.dumps(job, default=str), _now()),
        )


def load_collector_job(job_id: str) -> Optional[Dict[str, Any]]:
    with _LOCK, _conn() as con:
        row = con.execute("SELECT payload FROM collector_jobs WHERE id=?", (job_id,)).fetchone()
        return json.loads(row["payload"]) if row else None


def save_log(level: str, message: str) -> None:
    print(f"[{level}] {message}")
    try:
        with _LOCK, _conn() as con:
            con.execute(
                "INSERT INTO logs(level,message,created_at) VALUES(?,?,?)",
                (level, message, _now()),
            )
    except Exception:
        pass
