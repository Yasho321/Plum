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

    Position arrays are shaped (N, steps+1); column 0 is the release point and
    column k is the parcel position k hours earlier. ``times`` is a matching
    (N, steps+1) ``datetime64[ns]`` matrix (each row descending from its own
    release time — rows may differ because parcels are released at different
    valid hours). ``alive`` is False once a parcel has left the AOI+margin; its
    position is then frozen at the last valid spot.
    """

    lat: np.ndarray        # (N, steps+1) float32
    lon: np.ndarray        # (N, steps+1) float32
    times: np.ndarray      # (N, steps+1) datetime64[ns]
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


def _apply_perturbation(u, v, speed_factor, rot_rad):
    """Scale wind speed and rotate direction per parcel (ensemble spread)."""
    if speed_factor is not None:
        u = u * speed_factor
        v = v * speed_factor
    if rot_rad is not None:
        c, s = np.cos(rot_rad), np.sin(rot_rad)
        u, v = c * u - s * v, s * u + c * v
    return u, v


def back_track(
    start_lat,
    start_lon,
    issue_time,
    winds: WindField,
    config: Config = CONFIG,
    *,
    speed_factor=None,
    rot_rad=None,
) -> BackTrajectories:
    """Trace N air parcels backwards (brief §10.1).

    Parameters
    ----------
    start_lat, start_lon : array-like (N,)   release positions, (lat, lon) order
    issue_time           : scalar OR array-like (N,) — the valid hour T each
                           parcel is released at (UTC). Per-parcel times let the
                           ensemble batch every station x valid-hour in one call.
    winds                : WindField providing the transport wind
    speed_factor         : optional (N,) per-parcel wind-speed multiplier
    rot_rad              : optional (N,) per-parcel wind-direction rotation (rad)
    """
    cfg = config
    lat0 = np.atleast_1d(np.asarray(start_lat, dtype="float64"))
    lon0 = np.atleast_1d(np.asarray(start_lon, dtype="float64"))
    n = lat0.size
    steps = cfg.backtrack_hours
    dt = cfg.backtrack_step_s

    # Per-parcel release times (broadcast a scalar to all parcels).
    T = pd.to_datetime(np.atleast_1d(issue_time))
    if T.size == 1:
        T = pd.to_datetime(np.repeat(T.values, n))
    if T.size != n:
        raise ValueError(f"issue_time length {T.size} != n parcels {n}")
    T_ns = T.values.astype("datetime64[ns]")
    step_ns = np.timedelta64(dt, "s").astype("timedelta64[ns]")
    # times[:, k] = T - k*dt
    times = T_ns[:, None] - step_ns * np.arange(steps + 1)[None, :]

    if speed_factor is not None:
        speed_factor = np.broadcast_to(np.asarray(speed_factor, "float64"), (n,))
    if rot_rad is not None:
        rot_rad = np.broadcast_to(np.asarray(rot_rad, "float64"), (n,))

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
        u, v = winds.transport_uv(cur_lat, cur_lon, times[:, k])
        u, v = _apply_perturbation(u, v, speed_factor, rot_rad)
        u = np.where(live, u, 0.0)
        v = np.where(live, v, 0.0)
        us[:, k] = u
        vs[:, k] = v
        # Backward Euler step; cos uses the CURRENT latitude (brief §10.1).
        new_lat = cur_lat - (v * dt) / deg_lat
        denom = deg_lat * np.cos(np.radians(cur_lat))
        new_lon = cur_lon - (u * dt) / denom
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
