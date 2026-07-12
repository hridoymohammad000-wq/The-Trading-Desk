# bdshare Collector Merge Verification — V1.4

## Implemented

- Vendored the user-supplied bdshare package under `backend/vendor/bdshare`.
- Included the upstream license.
- Fixed the original ticker-file path problem by resolving `backend/vendor/bdshare/util/tickers.json` directly.
- Added background collector jobs with progress polling.
- Added two collection modes:
  - `backfill`: 365-calendar-day historical collection;
  - `daily`: incremental collection beginning after the latest stored date.
- Added current DSE symbol refresh with bundled 397-symbol fallback.
- Added strict OHLCV validation and centralized sector mapping.
- Added normalized SQLite `market_records` storage and deduplication.
- Added latest-session API, signal refresh, ChartLab OHLCV retrieval, CSV export, and failed-symbol export.
- Preserved the last validated database when collection fails or no new daily rows are found.

## Tests executed

- `npm install`: PASS
- `npm audit`: PASS — 0 vulnerabilities
- `npm run lint`: PASS
- `npm test`: PASS
- `npm run build`: PASS
- Python compileall: PASS
- Fresh isolated Python venv dependency installation: PASS
- FastAPI app startup and `/api/health`: PASS
- Same-process frontend serving: PASS
- Mocked bdshare backfill job: PASS
- SQLite normalized OHLCV save/load: PASS
- Symbol OHLCV API: PASS
- Latest-session API: PASS
- Signal refresh: PASS
- CSV export API: PASS

## External-network limitation

The packaging environment could not resolve DSE domains, so a live request to the current DSE website could not be executed here. The collector was integration-tested using deterministic mocked bdshare responses. On Windows, the first real backfill requires internet access and remains dependent on DSE's public HTML archive structure and availability.
