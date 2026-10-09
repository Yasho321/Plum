"""
OWNER    : Yasho1
DUE      : D2 15:00
TASK     :
  Mandatory: fire_share in [0,1] for random inputs; district shares sum to fire_share.
DONE WHEN: -
GUIDE    : docs/team/YASHO1.md  |  brief: docs/PROJECT_BRIEF.md
STATUS   : DONE
"""

import numpy as np
import pandas as pd

from plumetrace_engine.config import CONFIG
from plumetrace_engine.features.build_features import FEATURES
from plumetrace_engine.model.attribution import (
    aggregate_attribution,
    district_shares,
    fire_share,
)


class _ToyFireModel:
    """A deterministic model where PM2.5 rises with fire_load, so zeroing the
    fire features lowers the prediction and yields a positive, bounded share."""

    model_version = "toy"

    def predict_quantiles(self, df):
        base = 40.0 + 5.0 * df["lead_h"].to_numpy(dtype="float64") / 72.0
        fire = 80.0 * df["fire_load"].to_numpy(dtype="float64")  # log1p fire load
        p50 = base + fire
        return np.column_stack([0.8 * p50, p50, 1.3 * p50])


def _feat(n, rng):
    df = pd.DataFrame({f: rng.normal(size=n) for f in FEATURES if f != "station_id"})
    df["station_id"] = pd.Categorical(["S1"] * n)
    df["lead_h"] = rng.integers(0, 73, n)
    df["fire_load"] = np.log1p(rng.uniform(0, 500, n))
    df["fire_load_p90"] = df["fire_load"] * 1.1
    df["valid_hour"] = "2026-10-09T00:00:00Z"
    df["fl_Sangrur"] = rng.uniform(0, 300, n)
    df["fl_Patiala"] = rng.uniform(0, 200, n)
    return df


def test_fire_share_within_0_1_for_random_inputs():
    rng = np.random.default_rng(0)
    df = _feat(500, rng)
    out = fire_share(df, model=_ToyFireModel())
    for q in ("p10", "p50", "p90"):
        col = out[f"fire_share_{q}"].to_numpy()
        assert np.all(col >= 0.0) and np.all(col <= 1.0)
    # quantiles are ordered
    assert np.all(out["fire_share_p10"] <= out["fire_share_p50"] + 1e-9)
    assert np.all(out["fire_share_p50"] <= out["fire_share_p90"] + 1e-9)


def test_no_fire_gives_zero_share():
    rng = np.random.default_rng(1)
    df = _feat(50, rng)
    df["fire_load"] = 0.0
    df["fire_load_p90"] = 0.0
    out = fire_share(df, model=_ToyFireModel())
    assert np.allclose(out["fire_share_p50"], 0.0)


def test_district_shares_sum_to_fire_share():
    rng = np.random.default_rng(2)
    df = _feat(1, rng)
    out = fire_share(df, model=_ToyFireModel())
    row = out.iloc[0]
    parts = district_shares(row, ["fl_Sangrur", "fl_Patiala"])
    # shares are rounded to 4 dp for clean output, so allow that much slack
    assert abs(sum(p["share"] for p in parts) - row["fire_share_p50"]) < 5e-4
    assert all(0.0 <= p["share"] <= 1.0 for p in parts)


def test_aggregate_attribution_shape_and_bounds():
    rng = np.random.default_rng(3)
    df = _feat(146, rng)  # 2 stations worth of leads
    df["valid_hour"] = "2026-10-10T02:00:00Z"
    out = fire_share(df, model=_ToyFireModel())
    fires = pd.DataFrame({
        "latitude": [30.0, 30.1], "longitude": [76.0, 76.2], "frp": [40.0, 25.0],
        "acq_ts": pd.to_datetime(["2026-10-10T01:00:00Z", "2026-10-10T01:30:00Z"], utc=True),
        "district": ["Sangrur", "Patiala"],
    })
    att = aggregate_attribution(out, fires, ["S1"], CONFIG)
    assert not att.empty
    for c in ("share_p10", "share_p50", "share_p90"):
        assert att[c].between(0, 1).all()
    assert set(att["district"]) <= {"Sangrur", "Patiala"}
