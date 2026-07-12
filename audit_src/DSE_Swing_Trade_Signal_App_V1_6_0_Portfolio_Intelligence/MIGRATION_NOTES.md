# Migration Notes — V1.2

- On startup with the Python server available, known app records and market snapshots are hydrated from SQLite into the browser session before React renders.
- Browser-local records created while the server was unavailable are mirrored to SQLite after the app reconnects and state changes are saved.
- Demo market snapshots and paper trades carry `DEMO` origin where created through the explicit demo flow.
- Old hardcoded demo signals and historical strategy rows are no longer loaded.
- For a fully clean test, use Settings → Full Sandbox Reset, then import a validated market CSV.
