# Python Backend V1.4

FastAPI serves both the compiled React app and `/api` from one local process. SQLite stores normalized market snapshots and OHLCV records.

## Collector

The integrated collector uses the vendored user-supplied bdshare library:

- `POST /api/market/collect` with `{ "mode": "backfill" }`
- `POST /api/market/collect` with `{ "mode": "daily" }`
- `GET /api/market/collect/{job_id}` for progress
- `GET /api/market/latest` for the newest session
- `GET /api/market/export.csv` for a merged export

The initial backfill defaults to 365 calendar days. The daily mode requires an existing historical database.

## Manual run

```bash
pip install -r backend/requirements.txt
python -m uvicorn backend.app.main:app --host 127.0.0.1 --port 8765
```
