from __future__ import annotations

import os
import subprocess
import sys
import time
import urllib.request
import webbrowser
from pathlib import Path

ROOT = Path(__file__).resolve().parent
VENV = ROOT / ".venv"
REQUIREMENTS = ROOT / "backend" / "requirements.txt"
HOST = "127.0.0.1"
PORT = 8765
URL = f"http://{HOST}:{PORT}"
HEALTH_URL = f"{URL}/api/health"


def venv_python() -> Path:
    return VENV / ("Scripts/python.exe" if os.name == "nt" else "bin/python")


def health_ok(timeout: float = 1.0) -> bool:
    try:
        with urllib.request.urlopen(HEALTH_URL, timeout=timeout) as response:
            return response.status == 200
    except Exception:
        return False


def ensure_runtime() -> Path:
    python = venv_python()
    if not python.exists():
        print("[SETUP] Creating isolated Python environment...")
        subprocess.check_call([sys.executable, "-m", "venv", str(VENV)], cwd=ROOT)

    check = subprocess.run(
        [str(python), "-c", "import fastapi, uvicorn, pydantic, requests, bs4, pandas, lxml"],
        cwd=ROOT,
        stdout=subprocess.DEVNULL,
        stderr=subprocess.DEVNULL,
    )
    if check.returncode != 0:
        print("[SETUP] Installing required local server packages (first run only)...")
        subprocess.check_call(
            [str(python), "-m", "pip", "install", "--disable-pip-version-check", "-r", str(REQUIREMENTS)],
            cwd=ROOT,
        )
    return python


def main() -> int:
    os.chdir(ROOT)
    if health_ok():
        print(f"[READY] DSE app is already running at {URL}")
        webbrowser.open_new_tab(URL)
        return 0

    if not (ROOT / "dist" / "index.html").exists():
        print("[ERROR] Verified frontend build is missing: dist/index.html")
        print("Run 'npm install' and 'npm run build', then try again.")
        return 1

    try:
        python = ensure_runtime()
    except (OSError, subprocess.CalledProcessError) as exc:
        print(f"[ERROR] Could not prepare Python runtime: {exc}")
        print("Check your internet connection for the first run and confirm Python 3.10+ is installed.")
        return 1

    env = os.environ.copy()
    env.setdefault("DSE_STORAGE_MODE", "sqlite")
    env.setdefault("DSE_STORAGE_PATH", str(ROOT / "storage"))
    env.setdefault("DSE_DATABASE_PATH", str(ROOT / "storage" / "dse_swing_v1.sqlite3"))

    print("[START] Launching DSE Swing Trade Signal App...")
    process = subprocess.Popen(
        [
            str(python),
            "-m",
            "uvicorn",
            "backend.app.main:app",
            "--host",
            HOST,
            "--port",
            str(PORT),
        ],
        cwd=ROOT,
        env=env,
    )

    try:
        for _ in range(120):
            if process.poll() is not None:
                print("[ERROR] Local server stopped before startup completed.")
                return process.returncode or 1
            if health_ok():
                print(f"[READY] Opening one browser tab: {URL}")
                webbrowser.open_new_tab(URL)
                print("Keep this window open while using the app. Press Ctrl+C to stop.")
                return process.wait()
            time.sleep(0.25)
        print("[ERROR] Timed out waiting for the local server.")
        process.terminate()
        return 1
    except KeyboardInterrupt:
        print("\n[STOP] Shutting down local app...")
        process.terminate()
        try:
            process.wait(timeout=5)
        except subprocess.TimeoutExpired:
            process.kill()
        return 0


if __name__ == "__main__":
    raise SystemExit(main())
