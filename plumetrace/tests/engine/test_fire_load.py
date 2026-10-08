"""
OWNER    : Yasho1
DUE      : D1 22:00
TASK     :
  Mandatory: no fires -> 0; same FRP closer -> larger FL; beyond 50 km -> 0; |Δt| > 12 h -> 0.
DONE WHEN: -
GUIDE    : docs/team/YASHO1.md  |  brief: docs/PROJECT_BRIEF.md
STATUS   : DONE
"""

import numpy as np
import pandas as pd

from plumetrace_engine.config import CONFIG
from plumetrace_engine.features.fire_load import (
    compute_fire_load,
    extend_future_fires,
    fire_load_for_points,
)
from plumetrace_engine.trajectories.ensemble import run_trajectories
from plumetrace_engine.trajectories.winds import constant_wind_field


def _one_point(lat, lon, t, T, alive=True):
    return (
        np.array([lat], "float64"),
        np.array([lon], "float64"),
        np.array([np.datetime64(t)]),
        np.array([np.datetime64(T)]),
        np.array([alive]),
    )


def _fires(lat, lon, frp=50.0, acq="2026-10-09T00:00:00Z", district="Sangrur"):
    return pd.DataFrame({
        "latitude": [lat], "longitude": [lon], "frp": [frp],
        "acq_ts": pd.to_datetime([acq], utc=True), "district": [district],
    })


def test_no_fires_is_zero():
    args = _one_point(30.0, 76.0, "2026-10-09T00:00:00", "2026-10-09T00:00:00")
    fl, fld, dists = fire_load_for_points(*args, fires=pd.DataFrame(), cfg=CONFIG)
    assert fl[0] == 0.0
    fl2, _, _ = fire_load_for_points(*args, fires=None, cfg=CONFIG)
    assert fl2[0] == 0.0


def test_closer_fire_gives_larger_load():
    T = "2026-10-09T00:00:00"
    near = _one_point(30.0, 76.0, T, T)
    far = _one_point(30.0, 76.10, T, T)  # ~9.6 km east at lat 30
    fires = _fires(30.0, 76.0, frp=50.0, acq=T)
    fl_near, _, _ = fire_load_for_points(*near, fires=fires, cfg=CONFIG)
    fl_far, _, _ = fire_load_for_points(*far, fires=fires, cfg=CONFIG)
    assert fl_near[0] > fl_far[0] > 0.0


def test_beyond_cutoff_is_zero():
    T = "2026-10-09T00:00:00"
    # fire ~70 km north of the point (> 50 km cutoff)
    pt = _one_point(30.0, 76.0, T, T)
    fires = _fires(30.63, 76.0, frp=100.0, acq=T)  # 0.63 deg lat ~= 70 km
    fl, _, _ = fire_load_for_points(*pt, fires=fires, cfg=CONFIG)
    assert fl[0] == 0.0


def test_time_window_excludes_old_fires():
    # parcel at t = 00:00; fire detected 20 h earlier -> |Δt| > 12 h -> excluded
    pt = _one_point(30.0, 76.0, "2026-10-09T00:00:00", "2026-10-09T00:00:00")
    fires = _fires(30.0, 76.0, frp=50.0, acq="2026-10-08T04:00:00Z")
    fl, _, _ = fire_load_for_points(*pt, fires=fires, cfg=CONFIG)
    assert fl[0] == 0.0


def test_age_decay_reduces_older_arrival():
    # same fire/point, but larger (T - t_k) age -> smaller w_age
    fires = _fires(30.0, 76.0, frp=50.0, acq="2026-10-09T00:00:00Z")
    fresh = _one_point(30.0, 76.0, "2026-10-09T00:00:00", "2026-10-09T00:00:00")
    aged = _one_point(30.0, 76.0, "2026-10-09T00:00:00", "2026-10-10T00:00:00")  # 24 h old
    fl_fresh, _, _ = fire_load_for_points(*fresh, fires=fires, cfg=CONFIG)
    fl_aged, _, _ = fire_load_for_points(*aged, fires=fires, cfg=CONFIG)
    assert fl_fresh[0] > fl_aged[0] > 0.0
    assert np.isclose(fl_aged[0] / fl_fresh[0], np.exp(-1.0), rtol=0.05)  # τ=24h, age=24h


def test_future_fire_persistence_scales_down():
    fires = _fires(30.0, 76.0, frp=100.0, acq="2026-10-09T00:00:00Z")
    extended = extend_future_fires(fires, "2026-10-11T00:00:00", CONFIG)
    assert len(extended) > len(fires)
    future = extended[extended.get("is_future", False) == True]  # noqa: E712
    # day+1 clone should be 0.8x, day+2 0.64x of the original FRP
    assert set(np.round(future["frp"].to_numpy(), 2)) <= {80.0, 64.0}


def test_district_breakdown_sums_to_total():
    T = "2026-10-09T00:00:00"
    pt = _one_point(30.0, 76.0, T, T)
    fires = pd.concat([_fires(30.0, 76.0, 50, T, "Sangrur"),
                       _fires(30.02, 76.0, 30, T, "Patiala")], ignore_index=True)
    fl, fld, dists = fire_load_for_points(*pt, fires=fires, cfg=CONFIG)
    assert np.isclose(fld[0].sum(), fl[0])
    assert set(dists) == {"Sangrur", "Patiala"}


def test_compute_fire_load_over_trajectory_set():
    # End-to-end on a tiny ensemble: a fire sitting under the receptor.
    wind = constant_wind_field(2.0, 0.0, hours=6)
    stations = [{"station_id": "S1", "lat": 30.0, "lon": 76.0}]
    tset = run_trajectories("2026-10-09T00Z", stations, wind,
                            "2026-10-09T00:00:00", leads=3)
    fires = _fires(30.0, 76.0, frp=50.0, acq="2026-10-09T00:00:00Z")
    df = compute_fire_load(tset, fires, CONFIG)
    assert len(df) == 1 * 4 * CONFIG.n_members  # 1 station x 4 valid hours x 9 members
    assert (df["fl"] >= 0).all()
    assert df["fl"].sum() > 0
    assert "fl_Sangrur" in df.columns
