# Pipra Deployment Guide

## Preferred: Pipra supports Python/FastAPI

Requirements:

- Python 3.10+
- ASGI process support
- Writable persistent directory
- Environment-variable configuration

Steps:

1. Upload the full repository.
2. Install `backend/requirements.txt`.
3. Install backend dependencies with `pip install -r backend/requirements.txt`. This includes pandas, requests, BeautifulSoup, and lxml for the collector.
4. Build the frontend with `npm ci && npm run build` if rebuilding is required. A verified `dist/` is already included.
5. Start:

```bash
python -m uvicorn backend.app.main:app --host 0.0.0.0 --port $PORT
```

6. Configure:

```env
DSE_STORAGE_MODE=sqlite
DSE_STORAGE_PATH=./storage
DSE_DATABASE_PATH=./storage/dse_swing_v1.sqlite3
```

7. Ensure the process user can read/write the storage directory.

FastAPI serves the frontend and `/api` from the same origin. The process must be allowed to make outbound HTTPS requests to DSE public pages for the bdshare collector. Long-running collection jobs also require the hosting process to remain alive.

## Alternative: separate frontend and backend domains

Set this only when the backend is hosted on a different origin:

```env
VITE_DSE_BACKEND_URL=https://api.example.com/api
```

Rebuild the frontend after changing the Vite variable.

## Static hosting only

Upload `dist/*` to the web root. The following remain available:

- interface preview
- manual CSV/text validation
- browser-local snapshots
- client-side signals
- manual statement-text portfolio parsing
- browser-local paper trading and journal

The following are unavailable:

- SQLite server persistence
- server hydration across browsers/devices
- backend routes
- integrated bdshare Python collector and daily updater

Do not describe a static-only deployment as full-stack or server-persistent.
