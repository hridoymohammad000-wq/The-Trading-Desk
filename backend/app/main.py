from __future__ import annotations

import importlib.util
import sys
from pathlib import Path


ROOT = Path(__file__).resolve().parents[2]
NESTED_ROOT = ROOT / "audit_src" / "DSE_Swing_Trade_Signal_App_V1_6_0_Portfolio_Intelligence"
TARGET = NESTED_ROOT / "backend" / "app" / "main.py"

if str(NESTED_ROOT) not in sys.path:
    sys.path.insert(0, str(NESTED_ROOT))

if not TARGET.exists():
    raise RuntimeError(f"Nested app entrypoint not found: {TARGET}")

spec = importlib.util.spec_from_file_location("nested_dse_backend_main", TARGET)
if spec is None or spec.loader is None:
    raise RuntimeError(f"Could not load nested app module from: {TARGET}")

module = importlib.util.module_from_spec(spec)
spec.loader.exec_module(module)
app = module.app
