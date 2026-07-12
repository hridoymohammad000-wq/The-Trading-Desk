# V1.6.0 Verification

## Build and tests

- TypeScript type-check: PASS
- Frontend logic tests: PASS
- Vite production build: PASS
- FastAPI/SQLite backend tests: PASS
- Signal engine master-data tests: PASS
- Homepage HTTP status: 200
- Compiled JavaScript asset HTTP status: 200

## Master dataset

- Rows: 84,970
- Symbols: 460
- Unique sessions: 239
- Range: 2025-07-02 to 2026-06-30
- Duplicate keys: 0
- Conflicting overlapping rows: 0

## Signal distribution on 2026-06-30 master state

- BUY review candidates: 23
- WATCH: 263
- AVOID: 174

## Data limitation

The supplied data ends on 2026-06-30. On 2026-07-12 it is 12 calendar days stale. The UI and API therefore flag it as stale. No July OHLCV values were invented.
