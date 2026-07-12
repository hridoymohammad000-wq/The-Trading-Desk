# The Trading Desk — DSE Swing Trade Signal App V2

A local-first React + FastAPI + SQLite application for DSE market analysis, explainable swing signals, portfolio intelligence, paper trading, risk control, and validated EOD data management.

## Current verified project status

- Active development line: **V2.0**
- Completed roadmap tasks: **V2-001 through V2-012**
- Roadmap completion: **12/15 tasks (80%)**
- Next task: **V2-013 — SQLite-backed Watchlist and Alerts**
- Production release status: **Not yet approved**

The latest verified working package is:

`DSE_Swing_Trade_Signal_App_V2_STEP_12_PORTFOLIO_ANALYTICS.zip`

> Important: the repository source must be synchronized with the verified V2 Step 12 package before V2-013 development continues on GitHub.

## Completed V2 work

### V2-001 — Documentation and roadmap baseline
- V2 scope, audit findings, delivery sequence, and release gates documented.

### V2-002 — Global latest-market-date signal gate
- Outdated per-symbol data cannot appear as an active BUY.
- Stale symbols are classified as non-actionable.

### V2-003 — Stale-data circuit breaker
- Backend, Dashboard, Signal Board, and Paper Trading block new trades when the active dataset is stale.
- Existing trades can still be reviewed and closed.

### V2-004 — Explainable Rule Score
- Unsupported confidence and accuracy claims removed.
- Signals use explainable rule-score components.

### V2-005 — Security hardening
- Environment-controlled CORS.
- Bearer token and API-key support.
- Mutation, import, collector, delete, storage, portfolio, journal, and paper-trade routes protected.

### V2-006 — Honest broker import
- Simulated PDF parsing removed.
- Real CSV and statement-text parsing with validation added.

### V2-007 — Paper-trading accounting repair
- Starting capital, cash, equity, realized P/L, unrealized P/L, partial exits, reset behavior, and holding duration reconciled.

### V2-008 — Diagnostics and System Health
- Backend, storage, SQLite, market freshness, collector, snapshot, signal, authentication, CORS, and deployment readiness visibility added.

### V2-009 — Daily automatic EOD refresh
- Asia/Dhaka scheduler.
- DSE Sunday–Thursday trading-day awareness.
- Retry, failure reporting, last-success tracking, validation, and active-dataset preservation.

### V2-010 — Multi-timeframe signal logic
- Weekly candles and weekly EMA trend context.
- Daily/weekly timeframe conflict prevents premium BUY classification.

### V2-011 — Position sizing and portfolio risk controls
- Capital-based risk budget.
- Stop-distance quantity.
- Cash, exposure, concentration, and minimum-RR gates.
- Shared calculation across Signal Board, Portfolio, and Paper Trading.

### V2-012 — Stronger Portfolio Analytics
- Sector exposure.
- Largest-position concentration.
- Top-five exposure.
- Comparable-snapshot drawdown.
- Total open risk and risk-budget utilisation.
- No-average-down warnings.

## Remaining roadmap

1. **V2-013 — Watchlist and Alerts**
   - Favourite symbols
   - Personal notes
   - Target, support-zone, grade-change, and stale-signal alerts
   - Dashboard notifications

2. **V2-014 — Stronger Testing**
   - Broader regression coverage
   - Browser E2E coverage
   - Failure-path and migration verification

3. **V2-015 — Deployment Readiness and Release Closure**
   - Final environment validation
   - Persistent storage verification
   - Security and release audit
   - Production release documentation

## Verified bundled dataset

- File: `sample-data/dse_1y_ohlcv_master_app_ready.csv`
- 84,970 validated OHLCV rows
- 460 symbols
- 239 sessions
- Coverage: 2025-07-02 through 2026-06-30

The bundled dataset is historical and must be refreshed with a completed, validated DSE EOD dataset before acting on later-date signals.

## Architecture

- Frontend: React + TypeScript + Vite
- Backend: FastAPI + Python
- Storage: SQLite
- Market data: validated DSE EOD OHLCV snapshots
- Product role: decision support, portfolio analysis, risk review, and paper trading

This application does not guarantee returns, execute broker orders, or provide verified investment advice.

## Local Windows run

1. Extract the verified release package.
2. Double-click `START_DSE_APP.bat`.
3. Keep the terminal window open.
4. Open `http://127.0.0.1:8765` if the browser does not open automatically.

## Verification commands

```bash
npm install
npm run lint
npm test
npm run test:backend
npm run build
```

## Release rule

A task is complete only when implementation, tests, safety gates, UI/backend agreement, documentation, and verification evidence all pass. V2 reaches 100% only after V2-015 final release closure passes.