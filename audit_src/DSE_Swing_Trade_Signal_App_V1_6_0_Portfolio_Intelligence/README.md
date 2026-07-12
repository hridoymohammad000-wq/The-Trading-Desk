# DSE Swing Trade Signal App V1.6.0 — Portfolio Intelligence

A local React + FastAPI + SQLite DSE swing-analysis application. V1.6.0 focuses on verified historical data, conservative signal classification, portfolio concentration control, and transparent stale-data warnings.

## Included verified dataset

`sample-data/dse_1y_ohlcv_master_app_ready.csv`

- 84,970 validated OHLCV rows
- 460 symbols
- 239 unique sessions
- 2025-07-02 through 2026-06-30
- Zero duplicate conflicts between the two supplied source datasets
- Includes AL-HAJTEX, BDFINANCE, KBPPWBIL and RAHIMAFOOD

The master preserves the supplied data exactly. It does **not** invent missing sessions. The 218-symbol completed source contains Sunday sessions that were absent from the larger 460-symbol source, so per-symbol coverage differs. See `reports/master_data_quality.json`.

## V1.6.0 changes

- One-click startup automatically loads the bundled master into SQLite when the database is empty.
- Dashboard hydrates server signals without requiring a visit to Data Engine.
- Conservative historical signal engine uses nearest structural support/resistance, EMA20/50/200, RSI14, ATR14, relative volume, liquidity and risk percentage.
- A/A+ BUY labels are review candidates only and require structural targets. They are not auto-execution instructions.
- Portfolio screen provides HOLD / WAIT / NO AVERAGE / REDUCE CONCENTRATION / EXIT-REDUCE REVIEW classifications.
- Portfolio valuation always uses the holding's market price, never a potentially stale signal entry.
- Signals older than seven days are clearly marked stale.
- `/api/market/quality` reports coverage, freshness and watchlist history.

## Full project plan

### Phase 1 - Foundation and local runtime

- Keep the app runnable as a self-contained Windows bundle.
- Maintain React frontend + FastAPI backend + SQLite local persistence.
- Preserve one-click startup and bundled production build flow.

### Phase 2 - Market data pipeline

- Support validated CSV import for manual and demo datasets.
- Support DSE historical collection with source preflight, symbol refresh, snapshot storage and CSV export.
- Keep data quality visible through freshness, duplicate handling, invalid-row reporting and watchlist coverage checks.

### Phase 3 - Signal engine

- Use the backend historical engine as the single source of truth for swing signals.
- Generate conservative `BUY`, `WATCH`, and `AVOID` outcomes from full OHLCV history.
- Keep risk controls visible: support, stop-loss, target, RR, RSI, liquidity, stale-data flag and confidence score.

### Phase 4 - Portfolio intelligence

- Import, review and confirm holdings from statement text or demo flow.
- Match live holdings against the active signal set.
- Surface holding actions such as concentration warning, hold/wait, avoid averaging down and exit/reduce review.

### Phase 5 - Paper trading and journal

- Maintain paper-trade lifecycle, capital tracking and trade history.
- Store review notes, journal items and portfolio history locally/server-side.
- Use the journal to support post-trade review and discipline tracking.

### Phase 6 - Reliability hardening

- Keep frontend and backend state consistent after import, reload, delete and rerun actions.
- Remove stale-cache and stale-signal inconsistencies.
- Expand automated coverage for collector modes, snapshot deletion flows and storage synchronization.

### Phase 7 - Release readiness

- Clean encoding/UI text issues.
- Re-run lint, frontend tests, backend tests and build verification.
- Ship a cleaned release with updated docs and known limitations.

## Progress status

### Overall completion

- Estimated overall progress: **about 75% complete**
- Core product is already built and runnable.
- Main remaining work is reliability hardening, consistency fixes and release cleanup.

### Completed so far

- Frontend application structure is in place.
- FastAPI + SQLite backend is in place.
- Bundled one-year validated market dataset is included.
- Historical signal engine is implemented on the backend.
- Manual CSV import, demo flow, snapshot management and export flow exist.
- Portfolio review, holding classification, paper trading and journal modules exist.
- Windows launcher and packaged frontend build are included.
- Initial audit is completed and key risks are identified.

### Remaining work

- Fix daily collector failure path in the backend.
- Stop partial/demo imports from overwriting the global active signal state.
- Recompute or clear derived server state when backend snapshots are deleted.
- Align storage keys/state flows so frontend hydration and backend records stay consistent.
- Clean mojibake/encoding issues in visible UI text and docs.
- Add missing automated tests for daily collection, snapshot mutation and server-state refresh.
- Re-run full verification after fixes.

### Short status by area

- App architecture: **90% done**
- Market data import and snapshots: **80% done**
- DSE collector: **70% done**
- Signal engine: **85% done**
- Portfolio intelligence: **80% done**
- Paper trading and journal: **75% done**
- QA / regression coverage: **55% done**
- Release cleanup: **60% done**

## V2 roadmap

### What V2 should add

- **Daily auto-refresh workflow**
  - Add scheduled end-of-day refresh so the app updates DSE data without manual CSV upload every time.
- **Multi-timeframe chart intelligence**
  - Add weekly trend confirmation, daily setup validation, and cleaner ChartLab overlays.
- **Stronger portfolio analytics**
  - Add sector exposure, concentration heatmap, drawdown view, and risk-per-position dashboard.
- **Better signal scoring**
  - Add signal ranking by trend quality, liquidity quality, freshness, and reward-to-risk durability.
- **Trade execution planning**
  - Add position sizing calculator, max-loss calculator, and staged entry/exit planning.
- **Watchlist and alerts**
  - Add personal watchlists, favorite symbols, and trigger alerts for setup conditions.
- **Cleaner broker statement ingestion**
  - Add more robust portfolio import for real broker PDFs/CSV exports and symbol normalization.
- **Full deployment readiness**
  - Add cloud-safe storage config, environment-based settings, and Render-friendly persistence defaults.
- **Admin / diagnostics panel**
  - Add collector diagnostics, storage health, latest snapshot status, and stale-data warnings in one place.
- **Higher trust testing**
  - Add regression tests for collector, signal engine, portfolio sync, and snapshot lifecycle.

### How V2 should be implemented

#### 1. Daily auto-refresh

- Add a background collection mode for the next trading date only.
- Store last successful refresh timestamp in SQLite.
- Expose a small admin action to rerun failed refresh jobs.
- Later, move this into a cron-based cloud flow when hosted.

#### 2. Multi-timeframe chart intelligence

- Extend the backend signal engine to derive weekly candles from daily OHLCV.
- Add weekly EMA and trend-state checks before allowing premium grades.
- Update `ChartLab.tsx` to show support, stop, target, and timeframe badges visually.

#### 3. Stronger portfolio analytics

- Extend `PortfolioEngine.ts` with sector totals, top-5 exposure, and drawdown-aware metrics.
- Add a portfolio risk card in `Dashboard.tsx` and `PortfolioView.tsx`.
- Mark symbols that exceed user-defined max allocation or weak sector exposure rules.

#### 4. Better signal scoring

- Refactor score calculation in `backend/app/signal_bridge.py` into smaller rule blocks.
- Split signal score into trend score, structure score, liquidity score, and confirmation score.
- Store those components in `metrics` so the UI can explain exactly why a setup is ranked high or low.

#### 5. Trade execution planning

- Add a position size engine based on user capital and per-trade risk percentage.
- Show suggested shares, max capital use, and stop-based loss before paper trade entry.
- Reuse the same logic in Paper Trading and Portfolio review so risk is consistent everywhere.

#### 6. Watchlist and alerts

- Create SQLite-backed watchlist tables and matching frontend storage hooks.
- Let users pin symbols and save notes/reasons for tracking.
- In V2 local mode, alerts can be dashboard flags first; later versions can add email/Telegram/webhook delivery.

#### 7. Better broker ingestion

- Expand the current statement parser into adapter-style modules per broker format.
- Add a symbol alias table so company-name mismatch is easier to correct automatically.
- Allow import from structured CSV as well as statement text/PDF fallback.

#### 8. Deployment and cloud readiness

- Separate local-storage assumptions from server-persistent storage logic.
- Add one production config path for Render with explicit disk-backed SQLite settings.
- Add startup validation that warns if persistent storage is missing in production.

#### 9. Diagnostics and trust layer

- Add a dedicated diagnostics endpoint for source health, last collector run, active snapshot, and signal freshness.
- Show this in a small `System Status` panel in the frontend.
- Make failures explicit instead of silently falling back when data becomes stale or incomplete.

#### 10. Testing and release hardening

- Add backend tests for daily collector mode, snapshot deletion effects, and active-signal consistency.
- Add frontend tests for portfolio sync, snapshot reload behavior, and risk widgets.
- Add one V2 verification checklist before every release build.

### Suggested V2 release order

- **V2.0**
  - Fix current reliability issues, clean encoding, improve deployment readiness, add diagnostics.
- **V2.1**
  - Add stronger portfolio analytics, position sizing, and watchlist support.
- **V2.2**
  - Add multi-timeframe confirmation and improved signal ranking.
- **V2.3**
  - Add scheduled refresh/alert workflow and stronger broker ingestion adapters.

### Highest-value V2 priorities

- First priority: data freshness and state consistency
- Second priority: position sizing and portfolio risk visibility
- Third priority: multi-timeframe signal quality upgrade
- Fourth priority: watchlist, alerts, and broker-import polish

## Run on Windows

1. Extract the ZIP.
2. Double-click `START_DSE_APP.bat`.
3. Keep the terminal window open.
4. The app opens at `http://127.0.0.1:8765`.

The first run may install Python dependencies. Node.js is not required for normal use because the verified frontend build is included.

## Verification commands

```bash
npm run lint
npm test
npm run test:backend
npm run build
```

## Important limitation

The bundled dataset ends on **2026-06-30**. Refresh/import a completed DSE EOD dataset before using signals for a later date. The application must be used as a decision-support and risk-control tool, not as a profit guarantee.
