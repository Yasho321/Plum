"""
OWNER    : Yasho1
DUE      : D1 15:00
TASK     :
  WindField: loads a stack of NetCDF hours (GFS run, earlier-cycle analyses for past hours, or ERA5 for training — all share the same var names)
  into one xarray Dataset (time, lat, lon). uv(lat[], lon[], t[]) -> (u[], v[]) vectorised: bilinear in space, linear in time,
  transport rule from config (mean of 925 hPa & 10 m; 10 m only where hpbl < 300 m). Also hpbl/t2m/rh2m/wind10 samplers for features.
DONE WHEN: Constant-field test returns the constant; interpolation test passes.
GUIDE    : docs/team/YASHO1.md  |  brief: docs/PROJECT_BRIEF.md
STATUS   : DONE
"""

from __future__ import annotations

from typing import Sequence

import numpy as np
import pandas as pd
import xarray as xr

from plumetrace_engine.config import CONFIG, Config

# Variable names are the CONTRACT with Tejas's ingest/gfs.py and training/backfill/era5.py
# (brief §6.3). GFS forecasts, earlier-cycle analyses and ERA5 reanalysis all expose these.
REQUIRED_VARS = ("u10", "v10", "u925", "v925", "u850", "v850", "hpbl", "t2m", "rh2m")


class WindField:
    """A time-space stack of wind and surface fields, with pointwise sampling.

    The dataset must have dims/coords ``time`` (datetime64), ``latitude`` and
    ``longitude`` (both ascending), and the variables in ``REQUIRED_VARS``.
    All sampling is vectorised and done pointwise: you pass equal-length arrays
    of lats, lons and times and get back equal-length arrays of values —
    bilinear in space, linear in time (``xarray`` ``.interp``).
    """

    def __init__(self, ds: xr.Dataset, config: Config = CONFIG):
        missing = [v for v in REQUIRED_VARS if v not in ds]
        if missing:
            raise ValueError(f"WindField dataset missing variables: {missing}")
        for coord in ("time", "latitude", "longitude"):
            if coord not in ds.coords:
                raise ValueError(f"WindField dataset missing coord: {coord}")
        # Ensure ascending lat/lon so .interp extrapolation clamps predictably.
        if ds.latitude.values[0] > ds.latitude.values[-1]:
            ds = ds.sortby("latitude")
        if ds.longitude.values[0] > ds.longitude.values[-1]:
            ds = ds.sortby("longitude")
        self.ds = ds
        self.cfg = config
        self._t0 = pd.to_datetime(ds.time.values[0])
        self._t1 = pd.to_datetime(ds.time.values[-1])

    # -- low-level pointwise sampler ---------------------------------------
    def sample(self, varnames: Sequence[str], lat, lon, t) -> dict[str, np.ndarray]:
        """Interpolate the named variables at points (lat[i], lon[i], t[i]).

        ``t`` may be datetimes (array / Series / scalar). Returns {var: ndarray}.
        Points outside the domain clamp to the edge (``.interp`` default is NaN;
        we fill NaN with the nearest edge so parcels that graze the boundary
        still get a wind until the caller marks them dead)."""
        lat = np.atleast_1d(np.asarray(lat, dtype="float64"))
        lon = np.atleast_1d(np.asarray(lon, dtype="float64"))
        tt = pd.to_datetime(np.atleast_1d(t))
        # xarray.interp needs tz-naive datetime64; our datasets store naive UTC.
        if getattr(tt, "tz", None) is not None:
            tt = tt.tz_convert("UTC").tz_localize(None)
        n = max(lat.size, lon.size, tt.size)
        lat = np.broadcast_to(lat, (n,))
        lon = np.broadcast_to(lon, (n,))
        tt = tt if tt.size == n else pd.to_datetime(np.broadcast_to(tt.values, (n,)))

        idx = xr.Dataset(
            {
                "latitude": ("points", lat),
                "longitude": ("points", lon),
                "time": ("points", tt),
            }
        )
        interp = self.ds[list(varnames)].interp(
            latitude=idx.latitude,
            longitude=idx.longitude,
            time=idx.time,
            method="linear",
            kwargs={"fill_value": None},  # None => extrapolate/hold edge in time
        )
        out = {}
        for v in varnames:
            arr = np.asarray(interp[v].values, dtype="float64")
            out[v] = arr
        return out

    # -- transport wind for trajectories (brief §10.1) ---------------------
    def transport_uv(self, lat, lon, t):
        """Return (u, v) m/s at the transport level per the config rule.

        Default "mean_925_10m": 0.5*(u925+u10); where hpbl < hpbl_shallow_m use
        the 10 m wind only (a shallow boundary layer decouples 925 hPa)."""
        mode = self.cfg.transport_mode
        if mode == "10m_only":
            s = self.sample(("u10", "v10"), lat, lon, t)
            return s["u10"], s["v10"]
        if mode == "925_only":
            s = self.sample(("u925", "v925"), lat, lon, t)
            return s["u925"], s["v925"]
        # mean_925_10m (default)
        s = self.sample(("u10", "v10", "u925", "v925", "hpbl"), lat, lon, t)
        u = 0.5 * (s["u925"] + s["u10"])
        v = 0.5 * (s["v925"] + s["v10"])
        shallow = s["hpbl"] < self.cfg.hpbl_shallow_m
        u = np.where(shallow, s["u10"], u)
        v = np.where(shallow, s["v10"], v)
        return u, v

    # -- feature samplers (brief §10.3) ------------------------------------
    def surface_features(self, lat, lon, t) -> dict[str, np.ndarray]:
        s = self.sample(("u10", "v10", "hpbl", "t2m", "rh2m"), lat, lon, t)
        s["wind_speed_10m"] = np.hypot(s["u10"], s["v10"])
        return s

    @property
    def t_start(self):
        return self._t0

    @property
    def t_end(self):
        return self._t1


# --------------------------------------------------------------------------
# Test/synthetic helper: build a WindField with a spatially-uniform, constant-
# in-time wind. Used by tests (constant-wind trajectory) and for local dev
# before Tejas's real GFS NetCDF lands (playbook §4 "while waiting").
# --------------------------------------------------------------------------
def constant_wind_field(
    u: float,
    v: float,
    *,
    hpbl: float = 800.0,
    t2m: float = 295.0,
    rh2m: float = 40.0,
    aoi=None,
    hours: int = 72,
    start="2026-10-09T00:00:00",
    step_deg: float = 0.25,
    config: Config = CONFIG,
) -> WindField:
    cfg = config
    w, s_, e, n = aoi if aoi is not None else cfg.aoi
    m = cfg.aoi_margin_deg
    lats = np.arange(s_ - m, n + m + step_deg, step_deg)
    lons = np.arange(w - m, e + m + step_deg, step_deg)
    times = pd.date_range(start, periods=hours + 1, freq="h")
    shape = (times.size, lats.size, lons.size)
    const = {
        "u10": u, "v10": v, "u925": u, "v925": v, "u850": u, "v850": v,
        "hpbl": hpbl, "t2m": t2m, "rh2m": rh2m,
    }
    data = {k: (("time", "latitude", "longitude"), np.full(shape, val, dtype="float32"))
            for k, val in const.items()}
    ds = xr.Dataset(data, coords={"time": times, "latitude": lats, "longitude": lons})
    return WindField(ds, config=cfg)
