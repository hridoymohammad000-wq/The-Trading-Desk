# Windows One-Click Local Run — V1.4

1. Extract the ZIP to a normal writable folder.
2. Double-click `START_DSE_APP.bat`.
3. The first run creates `.venv` and installs FastAPI, pandas, requests, BeautifulSoup, and lxml. Internet is required on the first run.
4. One browser tab opens at `http://127.0.0.1:8765`.
5. Keep the launcher window open while using the app.
6. Press `Ctrl+C`, or run `STOP_DSE_APP.bat`, to stop the app.

## First data load

Open **Data Engine**:

- Click **Collect 1-Year Data** for the initial historical backfill.
- Watch the progress bar and current symbol. A full-market run can take several minutes.
- After the first backfill, use **Update Latest EOD** on later trading days.
- If the DSE site is unavailable, use CSV/text import. The previous validated database is preserved.

Collected data is stored in `storage/dse_swing_v1.sqlite3`. CSV exports and failed-symbol logs are written under `storage/exports/`.
