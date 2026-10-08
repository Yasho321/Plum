"""
OWNER    : Yasho1
DUE      : D1 16:00
TASK     :
  Exact §10.1 algorithm, vectorised over N parcels: 48 hourly backward steps, lat -= v*3600/111320, lon -= u*3600/(111320*cos(lat)); mask parcels that leave AOI+1°. Returns arrays lat[N,49], lon[N,49], t[49], alive[N,49].
DONE WHEN: tests/engine/test_trajectory.py passes (constant wind -> expected distance).
GUIDE    : docs/team/YASHO1.md  |  brief: docs/PROJECT_BRIEF.md
STATUS   : DONE
"""

from __future__ import annotations

from dataclasses import dataclass

import numpy as np
import pandas as pd

from plumetrace_engine.config import CONFIG, Config
from plumetrace_engine.trajectories.winds import WindField


@dataclass
class BackTrajectories:
    """Result of back-tracking N parcels for ``steps`` hours.

    Arrays are shaped (N, steps+1); column 0 is the release point at time T and
    column k is the parcel position k hours earlier. ``times`` is the matching
    (steps+1,) datetime array (descending). ``alive`` is False once a parcel has
    left the AOI+margin; its position is then frozen at the last valid spot.
    """

    lat: np.ndarray        # (N, steps+1) float32
    lon: np.ndarray        # (N, steps+1) float32
    times: pd.DatetimeIndex  # (steps+1,)
    alive: np.ndarray      # (N, steps+1) bool
    u: np.ndarray          # (N, steps) m/s, transport wind used at each step
    v: np.ndarray          # (N, steps) m/s

    @property
    def n(self) -> int:
        return self.lat.shape[0]


def _in_aoi(lat, lon, cfg: Config) -> np.ndarray:
    w, s, e, n = cfg.aoi
    m = cfg.aoi_margin_deg
    return (lon >= w - m) & (lon <= e + m) & (lat >= s - m) & (lat <= n + m)


def back_track(
    start_lat,
    start_lon,
    issue_time,
    winds: WindField,
    config: Config = CONFIG,
) -> BackTrajectories:
    """Trace N air parcels backwards (brief §10.1).

    Parameters
    ----------
    start_lat, start_lon : array-like (N,)   release positions (lat, lon) order
    issue_time           : the valid hour T the parcels are released at (UTC)
    winds                : WindField providing the transport wind
    """
    cfg = config
    lat0 = np.atleast_1d(np.asarray(start_lat, dtype="float64"))
    lon0 = np.atleast_1d(np.asarray(start_lon, dtype="float64"))
    n = lat0.size
    steps = cfg.backtrack_hours
    dt = cfg.backtrack_step_s

    T = pd.to_datetime(issue_time)
    times = pd.DatetimeIndex([T - pd.Timedelta(seconds=dt * k) for k in range(steps + 1)])

    lat = np.empty((n, steps + 1), dtype="float64")
    lon = np.empty((n, steps + 1), dtype="float64")
    alive = np.ones((n, steps + 1), dtype=bool)
    us = np.full((n, steps), np.nan, dtype="float64")
    vs = np.full((n, steps), np.nan, dtype="float64")

    lat[:, 0] = lat0
    lon[:, 0] = lon0
    alive[:, 0] = _in_aoi(lat0, lon0, cfg)

    deg_lat = cfg.m_per_deg_lat
    for k in range(steps):
        cur_lat = lat[:, k]
        cur_lon = lon[:, k]
        live = alive[:, k]
        # Sample the transport wind at the CURRENT position and time t_k.
        u, v = winds.transport_uv(cur_lat, cur_lon, times[k])
        u = np.where(live, u, 0.0)
        v = np.where(live, v, 0.0)
        us[:, k] = u
        vs[:, k] = v
        # Backward Euler step: subtract the displacement the wind would carry.
        # cos uses the CURRENT latitude (brief §10.1).
        new_lat = cur_lat - (v * dt) / deg_lat
        denom = deg_lat * np.cos(np.radians(cur_lat))
        new_lon = cur_lon - (u * dt) / denom
        # Parcels already dead stay frozen in place.
        new_lat = np.where(live, new_lat, cur_lat)
        new_lon = np.where(live, new_lon, cur_lon)
        still = _in_aoi(new_lat, new_lon, cfg) & live
        lat[:, k + 1] = np.where(still, new_lat, cur_lat)
        lon[:, k + 1] = np.where(still, new_lon, cur_lon)
        alive[:, k + 1] = still

    return BackTrajectories(
        lat=lat.astype("float32"),
        lon=lon.astype("float32"),
        times=times,
        alive=alive,
        u=us.astype("float32"),
        v=vs.astype("float32"),
    )
