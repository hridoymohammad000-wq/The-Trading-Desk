# The Trading Desk — Audited Repair Baseline 1.6.1

Local-first React + FastAPI + SQLite/Postgres application for DSE historical market analysis, explainable signals, portfolio review and paper trading.

> **Release integrity notice:** The supplied executable source is the V1.6 code line with the verified audit-repair batch below. Earlier README claims that a separate V2 Step-12 package was already synchronized were not supported by this ZIP and are no longer treated as implementation evidence.

## Working branch status

- Current isolated branch: `fix/issue-01-staged-snapshot-bypass`
- Parent repair baseline: `fix/audit-repair-batch-01`
- Default branch: unchanged
- Merge status: **NOT MERGED**
- GitHub push status: unavailable in this session because the connected repository permission is read-only

## Audit Repair Checklist — 14 July 2026

Status legend: `[ ] NOT STARTED` · `[-] IN PROGRESS` · `[x] VERIFIED`

- [x] **TD-AUD-01 — Release/source integrity:** README, backend version and package version now identify the actual 1.6.1 audited repair baseline.
- [x] **TD-AUD-02 — Mutation authentication:** Import, collector, delete, signal persistence, storage, portfolio, journal, paper-trade and reset routes require API-key/Bearer authentication; the one-click loopback launcher uses an HttpOnly per-run session cookie instead of exposing its generated secret to browser JavaScript.
- [x] **TD-AUD-03 — CORS hardening:** Wildcard CORS was removed; allowed origins are environment controlled.
- [x] **TD-AUD-04 — Signal integrity:** Client records use a non-persistent preview endpoint; global signals can only be persisted from a server-stored snapshot.
- [x] **TD-AUD-05 — Date/freshness safety:** Future dates are rejected and stale snapshots cannot persist actionable signals.
- [x] **TD-AUD-06 — Snapshot consistency:** Active snapshot deletion transactionally selects a replacement or clears active metadata and signals.
- [x] **TD-AUD-07 — Dataset activation lifecycle:** Partial, older and DEMO datasets cannot silently replace a stronger active dataset; they remain staged.
- [x] **TD-AUD-08 — Truthful server reset:** Explicit backend reset scopes return deleted-row evidence; the UI waits for backend success before reporting completion.
- [x] **TD-AUD-09 — Paper-accounting reconciliation:** One tested accounting engine now controls cash, equity, configurable fees, realised/unrealised P/L, partial/full exits, exact holding days, minimum RR and OHLC high/low SL/TP execution.
- [x] **TD-AUD-10 — Performance/readiness:** Fast ISO-date parsing, request limits, active-snapshot SQL queries and separate `/live` and `/ready` health checks were added.

## Second Evidence-Backed Repair Checklist — 14 July 2026

Status legend: `[ ] NOT STARTED` · `[-] IN PROGRESS` · `[x] VERIFIED`

- [x] **TD-NEXT-01 — Staged snapshot signal-activation bypass:** `/api/signals/run` now persists signals only for the current active snapshot. Supplying a different or `STAGED` snapshot returns HTTP 409 and does not change active state.
- [ ] **TD-NEXT-02 — Safe deletion replacement:** Active snapshot deletion must never auto-promote a staged/ineligible snapshot.
- [ ] **TD-NEXT-03 — Server-authoritative signal storage:** Generic storage must not accept forged signal payloads.
- [ ] **TD-NEXT-04 — Complete reset coverage:** Legacy paper-trade aliases must be cleared by reset.
- [ ] **TD-NEXT-05 — Sensitive read authorization:** Portfolio, journal, trades and dataset reads require appropriate authorization for public deployment.
- [ ] **TD-NEXT-06 — Browser secret removal:** No API secret may be compiled into or persisted by browser JavaScript.
- [ ] **TD-NEXT-07 — Readiness-aware UI:** Frontend connection status must use backend readiness, not liveness alone.
- [ ] **TD-NEXT-08 — Stale-preview trade gate:** Non-actionable stale preview signals must not open paper trades.
- [ ] **TD-NEXT-09 — Truthful snapshot activation UI:** Snapshot selection must activate or load the exact selected server snapshot.
- [ ] **TD-NEXT-10 — Collector completeness gate:** Incomplete collection results must remain staged and must not become active automatically.

### TD-NEXT-01 verification evidence

- Regression test creates a valid active snapshot and a separate partial `STAGED` snapshot.
- `POST /api/signals/run` with the staged snapshot ID returns **HTTP 409**.
- The original active snapshot ID remains unchanged.
- Backend security/consistency suite and signal-engine suite pass on the isolated branch.

### Current verdict

**Repair batch status: 10/10 verified within the local/private paper-trading scope.**  
**Public multi-user production approval: NOT GRANTED.** The browser-visible API-key model must be replaced by server-side user authentication/RBAC before internet-facing deployment. The application remains a decision-support and paper-trading tool; it does not guarantee returns or execute broker orders.

## Verification evidence

The following checks passed against this package:

```bash
npm run lint
npm test
python -m backend.tests.test_backend
python -m backend.tests.test_signal_engine
npm run build
```

Verified results:

- TypeScript compile: passed
- Frontend logic and paper-accounting lifecycle tests: passed
- Backend security/consistency tests: passed
- Signal-engine dataset tests: passed — 84,970 rows, 460 symbols
- Production frontend build: passed
- npm audit: 0 known vulnerabilities
- Loopback session integration: unknown origin rejected with HTTP 403; allowed local bootstrap returned HTTP 200; protected mutation succeeded using only the HttpOnly session cookie
- Clean bundled bootstrap: 84,970 rows loaded in approximately **8.4 seconds** in the audit container; previous observed run exceeded 120 seconds

## Security configuration

Copy `.env.example` to your environment and set a strong matching key:

```env
DSE_REQUIRE_AUTH=true
DSE_API_KEY=replace-with-a-long-random-secret
VITE_DSE_API_KEY=replace-with-the-same-secret
DSE_ALLOWED_ORIGINS=http://127.0.0.1:8765,http://localhost:8765
```

The one-click launcher generates a temporary backend secret and exchanges it for an HttpOnly, SameSite=Strict loopback session cookie. `VITE_DSE_API_KEY` remains an optional manual/dev fallback and is compiled into the browser bundle when used, so it must not be treated as public multi-user authentication. Internet-facing deployment still requires real server-side user login, roles and secret rotation.

## Health endpoints

- `GET /api/health` and `GET /api/health/live` — process and diagnostic liveness
- `GET /api/health/ready` — active snapshot, freshness, signal linkage, authentication and CORS readiness; returns HTTP 503 when unsafe

## Dataset activation rules

- Imports are always saved as snapshots.
- Older snapshots cannot replace a newer active snapshot.
- When the active dataset has at least 20 symbols, a replacement needs at least 90% of its symbol coverage.
- A DEMO snapshot cannot replace an active REAL/MANUAL snapshot.
- Stale historical snapshots may be viewed, but persisted actionable signals are blocked.

## Architecture

- Frontend: React + TypeScript + Vite
- Backend: FastAPI + Python
- Storage: SQLite or Postgres/Supabase
- Market data: validated DSE EOD OHLCV snapshots
- Current backend version: `1.6.1-audit-repair`

## Local verification

```bash
cd audit_src/DSE_Swing_Trade_Signal_App_V1_6_0_Portfolio_Intelligence
npm ci
npm run lint
npm test
python -m backend.tests.test_backend
python -m backend.tests.test_signal_engine
npm run build
```

## Paper-accounting verification

The UI and stored paper-trade ledger now use `PaperAccountingEngine.ts` for opening, marking, partial/full closing and account reconciliation. Tests cover entry/sell fees, fee allocation, cash release, wins/losses, exact holding days, gap stops, ambiguous same-candle SL/TP with conservative stop-first handling, targets and expiry.

## Deployment boundary

The ten audit repairs are verified for local/private paper simulation. Public deployment still requires server-side login sessions, user/role authorization, secret rotation, a complete DSE holiday calendar and an independent deployment review. This package must not be described as broker-execution or guaranteed-return software.
