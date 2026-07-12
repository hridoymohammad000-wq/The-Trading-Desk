# DSE Swing Trade Signal App V1.5 — Verification

## Core corrections

- Removed symbol-name/character based strategy assignment from production flow.
- Python FastAPI is now the single authoritative signal engine.
- Browser-side signal fallback is disabled; disconnected backend cannot create pseudo-signals.
- Signal generation now groups complete chronological OHLCV history by symbol.
- Added EMA20, EMA50, EMA200, RSI14, ATR14, 20-session average volume, relative volume, swing pivots, support and resistance.
- Strategy classification is based on measured Pullback vs Support Bounce conditions.
- Entry uses the latest completed EOD close.
- Stop loss uses swing/support structure with ATR buffer.
- Target uses the next historical resistance; RR is measured, not manufactured.
- Added candle confirmation, RSI recovery, trend, liquidity and relative-volume checks.
- Added evidence-based confidence score and metrics payload.
- Insufficient-history symbols are explicitly rejected.
- CSV import and DSE collector now send full historical records to the signal engine.

## Verification executed

- Frontend logic tests: PASS
- Vite production build: PASS
- FastAPI/backend integration tests: PASS
- Sample CSV validation: 50,254 valid rows, 0 invalid rows
- Sample historical scan: 218 symbols processed without runtime errors

## Important limitation

This is a decision-support and paper-trading application. It has no broker execution connection and does not guarantee profitable signals.
