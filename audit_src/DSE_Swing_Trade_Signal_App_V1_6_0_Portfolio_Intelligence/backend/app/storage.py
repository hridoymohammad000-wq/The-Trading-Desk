from __future__ import annotations

import json
import os
import sqlite3
import threading
from datetime import datetime, timezone
from typing import Any, Dict, List, Optional

try:
    import psycopg
    from psycopg.rows import dict_row
except ImportError:  # pragma: no cover - sqlite mode does not require psycopg
    psycopg = None
    dict_row = None

from .config import DATABASE_URL, DSE_DATABASE_PATH, DSE_STORAGE_MODE, DSE_STORAGE_PATH

_LOCK = threading.RLock()
_USE_POSTGRES = DSE_STORAGE_MODE == "supabase"


def _now() -> str:
    return datetime.now(timezone.utc).isoformat()


def _sqlite_conn() -> sqlite3.Connection:
    os.makedirs(DSE_STORAGE_PATH, exist_ok=True)
    con = sqlite3.connect(DSE_DATABASE_PATH, timeout=60, check_same_thread=False)
    con.row_factory = sqlite3.Row
    con.execute("PRAGMA journal_mode=WAL")
    con.execute("PRAGMA synchronous=NORMAL")
    return con


def _pg_conn():
    if psycopg is None:
        raise RuntimeError("Supabase/Postgres mode requires psycopg. Add it to backend requirements.")
    if not DATABASE_URL:
        raise RuntimeError("DATABASE_URL is required when DSE_STORAGE_MODE=supabase.")
    return psycopg.connect(DATABASE_URL, row_factory=dict_row)


def _ensure_pg_json(value: Any) -> str:
    return json.dumps(value, default=str)


def init_storage() -> None:
    if _USE_POSTGRES:
        _init_postgres_storage()
        return
    _init_sqlite_storage()


def _init_sqlite_storage() -> None:
    with _LOCK, _sqlite_conn() as con:
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


def _init_postgres_storage() -> None:
    with _LOCK, _pg_conn() as con:
        with con.cursor() as cur:
            cur.execute(
                """
                CREATE TABLE IF NOT EXISTS kv_store(
                    key TEXT PRIMARY KEY,
                    value JSONB NOT NULL,
                    origin TEXT NOT NULL DEFAULT 'REAL',
                    updated_at TIMESTAMPTZ NOT NULL
                );
                CREATE TABLE IF NOT EXISTS market_snapshots(
                    id TEXT PRIMARY KEY,
                    trade_date TEXT NOT NULL,
                    origin TEXT NOT NULL,
                    payload JSONB NOT NULL,
                    created_at TIMESTAMPTZ NOT NULL
                );
                CREATE TABLE IF NOT EXISTS market_records(
                    snapshot_id TEXT NOT NULL REFERENCES market_snapshots(id) ON DELETE CASCADE,
                    symbol TEXT NOT NULL,
                    trade_date TEXT NOT NULL,
                    open DOUBLE PRECISION NOT NULL,
                    high DOUBLE PRECISION NOT NULL,
                    low DOUBLE PRECISION NOT NULL,
                    close DOUBLE PRECISION NOT NULL,
                    volume BIGINT NOT NULL,
                    sector TEXT NOT NULL DEFAULT 'Unknown',
                    origin TEXT NOT NULL,
                    created_at TIMESTAMPTZ NOT NULL,
                    PRIMARY KEY(snapshot_id, symbol, trade_date)
                );
                CREATE INDEX IF NOT EXISTS idx_market_symbol_date ON market_records(symbol, trade_date);
                CREATE INDEX IF NOT EXISTS idx_market_date ON market_records(trade_date);
                CREATE TABLE IF NOT EXISTS signals(
                    id BIGSERIAL PRIMARY KEY,
                    origin TEXT NOT NULL,
                    payload JSONB NOT NULL,
                    created_at TIMESTAMPTZ NOT NULL
                );
                CREATE TABLE IF NOT EXISTS collector_jobs(
                    id TEXT PRIMARY KEY,
                    payload JSONB NOT NULL,
                    updated_at TIMESTAMPTZ NOT NULL
                );
                CREATE TABLE IF NOT EXISTS logs(
                    id BIGSERIAL PRIMARY KEY,
                    level TEXT NOT NULL,
                    message TEXT NOT NULL,
                    created_at TIMESTAMPTZ NOT NULL
                );
                """
            )
        con.commit()
    set_value("schema_version", {"version": "1.6.0"}, "REAL")


def set_value(key: str, value: Any, origin: str = "REAL", con=None) -> None:
    if _USE_POSTGRES:
        _pg_set_value(key, value, origin, con)
        return
    _sqlite_set_value(key, value, origin, con)


def _sqlite_set_value(key: str, value: Any, origin: str = "REAL", con: Optional[sqlite3.Connection] = None) -> None:
    own = con is None
    con = con or _sqlite_conn()
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


def _pg_set_value(key: str, value: Any, origin: str = "REAL", con=None) -> None:
    own = con is None
    con = con or _pg_conn()
    con.execute(
        """
        INSERT INTO kv_store(key,value,origin,updated_at) VALUES(%s,%s::jsonb,%s,%s::timestamptz)
        ON CONFLICT(key) DO UPDATE SET
          value=excluded.value,
          origin=excluded.origin,
          updated_at=excluded.updated_at
        """,
        (key, _ensure_pg_json(value), origin, _now()),
    )
    if own:
        con.commit()
        con.close()


def get_value(key: str, default: Any = None) -> Any:
    if _USE_POSTGRES:
        return _pg_get_value(key, default)
    return _sqlite_get_value(key, default)


def _sqlite_get_value(key: str, default: Any = None) -> Any:
    with _LOCK, _sqlite_conn() as con:
        row = con.execute("SELECT value,origin,updated_at FROM kv_store WHERE key=?", (key,)).fetchone()
        if not row:
            return default
        return {"data": json.loads(row["value"]), "origin": row["origin"], "updated_at": row["updated_at"]}


def _pg_get_value(key: str, default: Any = None) -> Any:
    with _LOCK, _pg_conn() as con:
        row = con.execute("SELECT value,origin,updated_at FROM kv_store WHERE key=%s", (key,)).fetchone()
        if not row:
            return default
        return {"data": row["value"], "origin": row["origin"], "updated_at": row["updated_at"].isoformat()}


def delete_value(key: str) -> None:
    if _USE_POSTGRES:
        with _LOCK, _pg_conn() as con:
            con.execute("DELETE FROM kv_store WHERE key=%s", (key,))
            con.commit()
        return
    with _LOCK, _sqlite_conn() as con:
        con.execute("DELETE FROM kv_store WHERE key=?", (key,))


def save_market_snapshot(snapshot_id: str, snapshot_data: Dict[str, Any]) -> bool:
    if _USE_POSTGRES:
        return _pg_save_market_snapshot(snapshot_id, snapshot_data)
    return _sqlite_save_market_snapshot(snapshot_id, snapshot_data)


def _snapshot_metadata(snapshot_data: Dict[str, Any]) -> tuple[str, Dict[str, Any], List[Dict[str, Any]], str]:
    origin = snapshot_data.get("origin", "MANUAL_IMPORT")
    records = snapshot_data.get("records", []) or []
    metadata = {k: v for k, v in snapshot_data.items() if k != "records"}
    metadata["record_count"] = len(records)
    symbols = {str(r.get("symbol", "")).upper() for r in records if r.get("symbol")}
    metadata["total_symbols"] = len(symbols)
    return origin, metadata, records, snapshot_data.get("created_time") or _now()


def _sqlite_save_market_snapshot(snapshot_id: str, snapshot_data: Dict[str, Any]) -> bool:
    origin, metadata, records, created_at = _snapshot_metadata(snapshot_data)
    with _LOCK, _sqlite_conn() as con:
        con.execute("PRAGMA foreign_keys=ON")
        con.execute(
            "INSERT OR REPLACE INTO market_snapshots(id,trade_date,origin,payload,created_at) VALUES(?,?,?,?,?)",
            (snapshot_id, snapshot_data.get("date", ""), origin, json.dumps(metadata, default=str), created_at),
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


def _pg_save_market_snapshot(snapshot_id: str, snapshot_data: Dict[str, Any]) -> bool:
    origin, metadata, records, created_at = _snapshot_metadata(snapshot_data)
    with _LOCK, _pg_conn() as con:
        with con.cursor() as cur:
            cur.execute(
                """
                INSERT INTO market_snapshots(id,trade_date,origin,payload,created_at)
                VALUES(%s,%s,%s,%s::jsonb,%s::timestamptz)
                ON CONFLICT(id) DO UPDATE SET
                  trade_date=excluded.trade_date,
                  origin=excluded.origin,
                  payload=excluded.payload,
                  created_at=excluded.created_at
                """,
                (snapshot_id, snapshot_data.get("date", ""), origin, _ensure_pg_json(metadata), created_at),
            )
            cur.execute("DELETE FROM market_records WHERE snapshot_id=%s", (snapshot_id,))
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
                cur.executemany(
                    """
                    INSERT INTO market_records(
                        snapshot_id,symbol,trade_date,open,high,low,close,volume,sector,origin,created_at
                    ) VALUES(%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s::timestamptz)
                    ON CONFLICT(snapshot_id, symbol, trade_date) DO UPDATE SET
                      open=excluded.open,
                      high=excluded.high,
                      low=excluded.low,
                      close=excluded.close,
                      volume=excluded.volume,
                      sector=excluded.sector,
                      origin=excluded.origin,
                      created_at=excluded.created_at
                    """,
                    rows,
                )
        active_meta = dict(metadata)
        active_meta["id"] = snapshot_id
        _pg_set_value("active_market_dataset", active_meta, origin, con)
        con.commit()
    return True


def _sqlite_records_for_snapshot(con: sqlite3.Connection, snapshot_id: str) -> List[Dict[str, Any]]:
    rows = con.execute(
        """
        SELECT symbol,trade_date,open,high,low,close,volume,sector,origin,created_at
        FROM market_records WHERE snapshot_id=? ORDER BY symbol,trade_date
        """,
        (snapshot_id,),
    ).fetchall()
    return [dict(row) | {"source": row["origin"]} for row in rows]


def _pg_records_for_snapshot(con, snapshot_id: str) -> List[Dict[str, Any]]:
    rows = con.execute(
        """
        SELECT symbol,trade_date,open,high,low,close,volume,sector,origin,created_at
        FROM market_records WHERE snapshot_id=%s ORDER BY symbol,trade_date
        """,
        (snapshot_id,),
    ).fetchall()
    return [
        dict(row)
        | {"source": row["origin"], "created_at": row["created_at"].isoformat() if row.get("created_at") else None}
        for row in rows
    ]


def load_market_snapshot(snapshot_id: str, include_records: bool = True) -> Optional[Dict[str, Any]]:
    if _USE_POSTGRES:
        return _pg_load_market_snapshot(snapshot_id, include_records)
    return _sqlite_load_market_snapshot(snapshot_id, include_records)


def _sqlite_load_market_snapshot(snapshot_id: str, include_records: bool = True) -> Optional[Dict[str, Any]]:
    with _LOCK, _sqlite_conn() as con:
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
            records = _sqlite_records_for_snapshot(con, snapshot_id)
            if not records and isinstance(payload.get("records"), list):
                records = payload["records"]
            payload["records"] = records
        else:
            payload.pop("records", None)
        return payload


def _pg_load_market_snapshot(snapshot_id: str, include_records: bool = True) -> Optional[Dict[str, Any]]:
    with _LOCK, _pg_conn() as con:
        row = con.execute(
            "SELECT id,trade_date,origin,payload,created_at FROM market_snapshots WHERE id=%s",
            (snapshot_id,),
        ).fetchone()
        if not row:
            return None
        payload = row["payload"]
        payload.setdefault("id", row["id"])
        payload.setdefault("date", row["trade_date"])
        payload.setdefault("origin", row["origin"])
        payload.setdefault("created_time", row["created_at"].isoformat())
        if include_records:
            records = _pg_records_for_snapshot(con, snapshot_id)
            if not records and isinstance(payload.get("records"), list):
                records = payload["records"]
            payload["records"] = records
        else:
            payload.pop("records", None)
        return payload


def list_market_snapshots() -> List[Dict[str, Any]]:
    if _USE_POSTGRES:
        return _pg_list_market_snapshots()
    return _sqlite_list_market_snapshots()


def _sqlite_list_market_snapshots() -> List[Dict[str, Any]]:
    with _LOCK, _sqlite_conn() as con:
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


def _pg_list_market_snapshots() -> List[Dict[str, Any]]:
    with _LOCK, _pg_conn() as con:
        rows = con.execute(
            "SELECT id,trade_date,origin,payload,created_at FROM market_snapshots ORDER BY created_at DESC"
        ).fetchall()
        out: List[Dict[str, Any]] = []
        for row in rows:
            payload = row["payload"]
            stat = con.execute(
                """
                SELECT COUNT(*) AS record_count, COUNT(DISTINCT symbol) AS total_symbols,
                       MIN(trade_date) AS start_date, MAX(trade_date) AS end_date
                FROM market_records WHERE snapshot_id=%s
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
                    "created_time": row["created_at"].isoformat(),
                    "status": payload.get("status", "PASSED"),
                    "source": payload.get("source", "manual"),
                }
            )
        return out


def delete_market_snapshot(snapshot_id: str) -> bool:
    if _USE_POSTGRES:
        with _LOCK, _pg_conn() as con:
            con.execute("DELETE FROM market_records WHERE snapshot_id=%s", (snapshot_id,))
            cur = con.execute("DELETE FROM market_snapshots WHERE id=%s", (snapshot_id,))
            con.commit()
            return cur.rowcount > 0
    with _LOCK, _sqlite_conn() as con:
        con.execute("DELETE FROM market_records WHERE snapshot_id=?", (snapshot_id,))
        cur = con.execute("DELETE FROM market_snapshots WHERE id=?", (snapshot_id,))
        return cur.rowcount > 0


def query_symbol_ohlcv(symbol: str, snapshot_id: Optional[str] = None) -> List[Dict[str, Any]]:
    if _USE_POSTGRES:
        return _pg_query_symbol_ohlcv(symbol, snapshot_id)
    return _sqlite_query_symbol_ohlcv(symbol, snapshot_id)


def _sqlite_query_symbol_ohlcv(symbol: str, snapshot_id: Optional[str] = None) -> List[Dict[str, Any]]:
    symbol = symbol.upper().strip()
    with _LOCK, _sqlite_conn() as con:
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


def _pg_query_symbol_ohlcv(symbol: str, snapshot_id: Optional[str] = None) -> List[Dict[str, Any]]:
    symbol = symbol.upper().strip()
    with _LOCK, _pg_conn() as con:
        params: List[Any] = [symbol]
        where = "WHERE mr.symbol=%s"
        if snapshot_id:
            where += " AND mr.snapshot_id=%s"
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
    if _USE_POSTGRES:
        with _LOCK, _pg_conn() as con:
            return [row["symbol"] for row in con.execute("SELECT DISTINCT symbol FROM market_records ORDER BY symbol")]
    with _LOCK, _sqlite_conn() as con:
        return [row["symbol"] for row in con.execute("SELECT DISTINCT symbol FROM market_records ORDER BY symbol")]


def latest_market_trade_date() -> Optional[str]:
    if _USE_POSTGRES:
        with _LOCK, _pg_conn() as con:
            row = con.execute("SELECT MAX(trade_date) AS d FROM market_records").fetchone()
            return row["d"] if row and row["d"] else None
    with _LOCK, _sqlite_conn() as con:
        row = con.execute("SELECT MAX(trade_date) AS d FROM market_records").fetchone()
        return row["d"] if row and row["d"] else None


def all_market_records() -> List[Dict[str, Any]]:
    if _USE_POSTGRES:
        with _LOCK, _pg_conn() as con:
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
    with _LOCK, _sqlite_conn() as con:
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
    if _USE_POSTGRES:
        with _LOCK, _pg_conn() as con:
            con.execute(
                "INSERT INTO signals(origin,payload,created_at) VALUES(%s,%s::jsonb,%s::timestamptz)",
                (origin, _ensure_pg_json(signals), _now()),
            )
            _pg_set_value("dse_signals", signals, origin, con)
            con.commit()
        return
    with _LOCK, _sqlite_conn() as con:
        con.execute(
            "INSERT INTO signals(origin,payload,created_at) VALUES(?,?,?)",
            (origin, json.dumps(signals, default=str), _now()),
        )
        _sqlite_set_value("dse_signals", signals, origin, con)


def latest_signals() -> List[Dict[str, Any]]:
    if _USE_POSTGRES:
        with _LOCK, _pg_conn() as con:
            row = con.execute("SELECT payload FROM signals ORDER BY id DESC LIMIT 1").fetchone()
            return row["payload"] if row else []
    with _LOCK, _sqlite_conn() as con:
        row = con.execute("SELECT payload FROM signals ORDER BY id DESC LIMIT 1").fetchone()
        return json.loads(row["payload"]) if row else []


def save_collector_job(job: Dict[str, Any]) -> None:
    if _USE_POSTGRES:
        with _LOCK, _pg_conn() as con:
            con.execute(
                """
                INSERT INTO collector_jobs(id,payload,updated_at) VALUES(%s,%s::jsonb,%s::timestamptz)
                ON CONFLICT(id) DO UPDATE SET payload=excluded.payload, updated_at=excluded.updated_at
                """,
                (job["id"], _ensure_pg_json(job), _now()),
            )
            con.commit()
        return
    with _LOCK, _sqlite_conn() as con:
        con.execute(
            "INSERT OR REPLACE INTO collector_jobs(id,payload,updated_at) VALUES(?,?,?)",
            (job["id"], json.dumps(job, default=str), _now()),
        )


def load_collector_job(job_id: str) -> Optional[Dict[str, Any]]:
    if _USE_POSTGRES:
        with _LOCK, _pg_conn() as con:
            row = con.execute("SELECT payload FROM collector_jobs WHERE id=%s", (job_id,)).fetchone()
            return row["payload"] if row else None
    with _LOCK, _sqlite_conn() as con:
        row = con.execute("SELECT payload FROM collector_jobs WHERE id=?", (job_id,)).fetchone()
        return json.loads(row["payload"]) if row else None


def save_log(level: str, message: str) -> None:
    print(f"[{level}] {message}")
    try:
        if _USE_POSTGRES:
            with _LOCK, _pg_conn() as con:
                con.execute(
                    "INSERT INTO logs(level,message,created_at) VALUES(%s,%s,%s::timestamptz)",
                    (level, message, _now()),
                )
                con.commit()
            return
        with _LOCK, _sqlite_conn() as con:
            con.execute(
                "INSERT INTO logs(level,message,created_at) VALUES(?,?,?)",
                (level, message, _now()),
            )
    except Exception:
        pass
