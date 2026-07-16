# The Trading Desk — DSE Signal & Paper-Test App

Current verified repository source is the bundled **V1.6 application with a root safety overlay**.

## Product boundary

- DSE signal generation and manual review
- Paper Trading only for testing signal performance
- No real broker connection
- No real order execution
- No profit guarantee

## Safety overlay

- A+ requires score 95–100 and the original premium BUY gates
- A requires score 90–94 and the original qualified BUY gates
- B+ is 85–89 and Watch only
- Below 85 or a hard rejection becomes Reject
- Data older than 7 calendar days is marked `EXPIRED`; new paper-test entries are blocked
- Daily collection stores only rows newer than the previous active market date
- Wildcard CORS is removed; same-origin is the default
- Server mutation routes can be protected with a known `DSE_API_TOKEN`
- Arbitrary storage keys are blocked

The bundled dataset ends on **2026-06-30**, so it is stale on later dates and must not create an actionable BUY.

## Replit

GitHub `master` is the source of truth. Replit is only the run/test workspace.

After a merged PR:

1. Check Replit Git for uncommitted changes.
2. Pull latest `master`.
3. Restart Run.
4. Verify `/api/health` reports `new_entries_allowed: false` while the bundled dataset is stale.

Never pull over uncommitted Replit work.

## Optional write protection

Add a known `DSE_API_TOKEN` in Replit Secrets. Then open `/auth` in the app and enter that token to unlock imports, collector runs, deletes, portfolio saves, journal saves and paper-test saves. `SESSION_SECRET` signs the HttpOnly cookie; it is not the token you type.

## Verification

```bash
cd audit_src/DSE_Swing_Trade_Signal_App_V1_6_0_Portfolio_Intelligence
npm ci
npm run lint
npm test
npm run test:backend
npm run build

cd ../../..
python -m tests.test_safety_overlay
```

## V2 status

The repository does **not** contain verified V2 Step-12 source. V2 must not be reported as completed until its actual code and tests are committed.
