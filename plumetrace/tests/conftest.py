"""
OWNER    : Yasho1
DUE      : D1 12:00
TASK     :
  Add engine/, fleet/ parent and contracts/python to sys.path; set PT_LOCAL=1; shared fixtures (constant wind field, synthetic fires).
DONE WHEN: `pytest` runs from repo root.
GUIDE    : docs/team/YASHO1.md  |  brief: docs/PROJECT_BRIEF.md
STATUS   : DONE
"""

import os
import sys
from pathlib import Path

import numpy as np
import pandas as pd
import pytest

# --- make the packages importable from the repo root (no install needed) ---
ROOT = Path(__file__).resolve().parents[1]
for sub in ("engine", "fleet", "contracts/python"):
    p = str(ROOT / sub)
    if p not in sys.path:
        sys.path.insert(0, p)

# everything runs in local mode during tests (no AWS)
os.environ.setdefault("PT_LOCAL", "1")


@pytest.fixture
def cfg():
    from plumetrace_engine.config import load_config
    load_config.cache_clear()
    return load_config()


@pytest.fixture
def constant_wind():
    """A uniform, time-constant wind field builder (u, v in m/s)."""
    from plumetrace_engine.trajectories.winds import constant_wind_field
    return constant_wind_field


@pytest.fixture
def synthetic_fires():
    """A small fires DataFrame around a point, for fire-load tests.

    Columns match the curated fires contract: latitude, longitude, frp,
    acq_ts (UTC), district.
    """
    def _make(lat=30.0, lon=76.0, frp=50.0, n=1, acq_ts="2026-10-09T00:00:00Z",
              district="Sangrur"):
        return pd.DataFrame(
            {
                "latitude": np.full(n, lat, dtype="float64"),
                "longitude": np.full(n, lon, dtype="float64"),
                "frp": np.full(n, frp, dtype="float64"),
                "acq_ts": pd.to_datetime([acq_ts] * n, utc=True),
                "district": [district] * n,
            }
        )
    return _make
