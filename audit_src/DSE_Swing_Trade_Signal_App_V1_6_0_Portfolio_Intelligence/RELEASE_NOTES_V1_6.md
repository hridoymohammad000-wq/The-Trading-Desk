# Release Notes — V1.6.0 Portfolio Intelligence

- Built deterministic 84,970-row master OHLCV dataset from the two validated supplied sources.
- Added automatic bundled dataset bootstrap and server-state hydration.
- Reworked support, stop, target and grading logic to avoid the previous near-resistance RR rejection defect.
- Added explicit stale-data detection and data-quality API.
- Added portfolio concentration and no-average-down safeguards.
- Added tests for master integrity, watchlist coverage and conservative BUY invariants.
