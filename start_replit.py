from __future__ import annotations

import os
import shutil
import subprocess
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parent
APP_ROOT = ROOT / "audit_src" / "DSE_Swing_Trade_Signal_App_V1_6_0_Portfolio_Intelligence"
DIST_INDEX = APP_ROOT / "dist" / "index.html"


def latest_source_mtime() -> float:
    paths = [APP_ROOT / "src", APP_ROOT / "index.html", APP_ROOT / "package.json", APP_ROOT / "package-lock.json", APP_ROOT / "vite.config.ts"]
    values: list[float] = []
    for path in paths:
        if path.is_dir():
            values.extend(item.stat().st_mtime for item in path.rglob("*") if item.is_file())
        elif path.exists():
            values.append(path.stat().st_mtime)
    return max(values, default=0.0)


def ensure_frontend() -> None:
    if DIST_INDEX.exists() and DIST_INDEX.stat().st_mtime >= latest_source_mtime():
        return
    npm = shutil.which("npm")
    if not npm:
        raise RuntimeError("Node.js/npm is required to build the frontend.")
    if not (APP_ROOT / "node_modules").exists():
        subprocess.check_call([npm, "ci"], cwd=APP_ROOT)
    subprocess.check_call([npm, "run", "build"], cwd=APP_ROOT)


def main() -> None:
    ensure_frontend()
    os.chdir(ROOT)
    port = os.getenv("PORT", "5000")
    os.execvp(sys.executable, [sys.executable, "-m", "uvicorn", "backend.app.main:app", "--host", "0.0.0.0", "--port", port])


if __name__ == "__main__":
    main()
