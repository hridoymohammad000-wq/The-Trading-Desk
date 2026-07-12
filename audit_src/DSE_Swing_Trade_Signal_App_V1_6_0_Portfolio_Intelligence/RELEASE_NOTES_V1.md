# Release Notes — V1.4 bdshare Collector Integration

- Merged the user-supplied bdshare DSE collector into the Python backend.
- Fixed the original ticker path issue by using the vendored `backend/vendor/bdshare/util/tickers.json` path.
- Added background collection jobs with visible progress.
- Added first-time 365-day backfill and daily incremental update modes.
- Added current DSE symbol refresh with bundled-ticker fallback.
- Added normalized SQLite `market_records` storage for large one-year datasets.
- Added latest-session API, merged CSV export, failed-symbol logging, automatic signal refresh, and ChartLab integration.
- Preserved manual CSV import and explicit demo data as safe fallbacks.

Live DSE fetching remains dependent on DSE website availability and HTML compatibility.

## V1.4 collector source hardening

- Added source preflight before any full-market run: DNS, verified TLS, HTTP response, and historical-table parsing.
- Added `https://www.dse.com.bd/` as the current official-homepage candidate, while retaining legacy candidates for compatibility.
- TLS verification is never disabled.
- Full collection will not start unless one source passes preflight.
- Added fail-fast stop after 3 consecutive symbol failures with zero collected rows.
- Previous validated SQLite market database remains active after any preflight or collection failure.
- Manual CSV import remains the safe fallback when DSE source infrastructure is unavailable.
