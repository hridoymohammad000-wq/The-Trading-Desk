DSE Swing Trade Signal App V1.6.0 — Portfolio Intelligence
A local React + FastAPI + SQLite DSE swing-analysis application. V1.6.0 focuses on verified historical data, conservative signal classification, portfolio concentration control, and transparent stale-data warnings.

Included verified dataset
sample-data/dse_1y_ohlcv_master_app_ready.csv

84,970 validated OHLCV rows
460 symbols
239 unique sessions
2025-07-02 through 2026-06-30
Zero duplicate conflicts between the two supplied source datasets
Includes AL-HAJTEX, BDFINANCE, KBPPWBIL and RAHIMAFOOD
The master preserves the supplied data exactly. It does not invent missing sessions. The 218-symbol completed source contains Sunday sessions that were absent from the larger 460-symbol source, so per-symbol coverage differs. See reports/master_data_quality.json.

V1.6.0 changes
One-click startup automatically loads the bundled master into SQLite when the database is empty.
Dashboard hydrates server signals without requiring a visit to Data Engine.
Conservative historical signal engine uses nearest structural support/resistance, EMA20/50/200, RSI14, ATR14, relative volume, liquidity and risk percentage.
A/A+ BUY labels are review candidates only and require structural targets. They are not auto-execution instructions.
Portfolio screen provides HOLD / WAIT / NO AVERAGE / REDUCE CONCENTRATION / EXIT-REDUCE REVIEW classifications.
Portfolio valuation always uses the holding's market price, never a potentially stale signal entry.
Signals older than seven days are clearly marked stale.
/api/market/quality reports coverage, freshness and watchlist history.
Run on Windows
Extract the ZIP.
Double-click START_DSE_APP.bat.
Keep the terminal window open.
The app opens at http://127.0.0.1:8765.
The first run may install Python dependencies. Node.js is not required for normal use because the verified frontend build is included.

Verification commands
npm run lint
npm test
npm run test:backend
npm run build
Important limitation
The bundled dataset ends on 2026-06-30. Refresh/import a completed DSE EOD dataset before using signals for a later date. The application must be used as a decision-support and risk-c
