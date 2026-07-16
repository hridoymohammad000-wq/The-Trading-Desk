from __future__ import annotations

import os
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parent
DIST_INDEX = ROOT / "audit_src" / "DSE_Swing_Trade_Signal_App_V1_6_0_Portfolio_Intelligence" / "dist" / "index.html"


def main() -> None:
    if not DIST_INDEX.exists():
        raise RuntimeError("Bundled frontend build is missing. Run npm ci && npm run build in the nested app directory.")
    os.chdir(ROOT)
    port = os.getenv("PORT", "5000")
    os.execvp(sys.executable, [sys.executable, "-m", "uvicorn", "backend.app.main:app", "--host", "0.0.0.0", "--port", port])


if __name__ == "__main__":
    main()
