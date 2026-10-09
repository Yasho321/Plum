"""
OWNER    : Yasho1
DUE      : D1 22:00
TASK     :
  §10.2: project fires + trajectory points to a local equal-distance projection, cKDTree query_ball_point(50 km); w_space gaussian σ=15 km, w_time |Δt|≤12 h, w_age exp(-(T-t_k)/τ). Returns FL[ens] and FL_d per district. Future fires: persistence of last-24 h fires scaled 0.8/day. Also write outputs/run=<run_id>/fires_48h.geojson (lon,lat,frp,acq_ts,district) for the map + reports.
DONE WHEN: tests/engine/test_fire_load.py passes (0 with no fires, grows as fire nears).
GUIDE    : docs/team/YASHO1.md  |  brief: docs/PROJECT_BRIEF.md
STATUS   : DONE
"""

from __future__ import annotations

from typing import Optional

import numpy as np
import pandas as pd
from scipy.spatial import cKDTree

from plumetrace_engine.config import CONFIG, Config


def _project(lat, lon, lat0, lon0, cfg: Config):
    """Local equidistant projection to metres (x east, y north). Good enough at
    AOI scale (brief §10.2)."""
    R = cfg.earth_radius_m
    x = np.radians(np.asarray(lon, "float64") - lon0) * np.cos(np.radians(lat0)) * R
    y = np.radians(np.asarray(lat, "float64") - lat0) * R
    return x, y


def extend_future_fires(fires: pd.DataFrame, horizon_end, cfg: Config = CONFIG) -> pd.DataFrame:
    """Persist the last-24 h fires into the future, scaling FRP by 0.8 per day
    (brief §10.2). ``horizon_end`` is the latest parcel time we need fires for.
    This is the single biggest forecast assumption — documented in the README."""
    if fires.empty:
        return fires
    acq = pd.to_datetime(fires["acq_ts"], utc=True)
    latest = acq.max()
    horizon_end = pd.Timestamp(horizon_end).tz_localize("UTC") if pd.Timestamp(horizon_end).tzinfo is None else pd.Timestamp(horizon_end)
    if horizon_end <= latest:
        return fires
    recent = fires[acq >= latest - pd.Timedelta(hours=24)].copy()
    if recent.empty:
        return fires
    clones = [fires]
    n_days = int(np.ceil((horizon_end - latest) / pd.Timedelta(days=1)))
    for day in range(1, n_days + 1):
        c = recent.copy()
        c["acq_ts"] = pd.to_datetime(c["acq_ts"], utc=True) + pd.Timedelta(days=day)
        c["frp"] = c["frp"] * (cfg.fire_persist_decay_per_day ** day)
        c["is_future"] = True
        clones.append(c)
    out = pd.concat(clones, ignore_index=True)
    if "is_future" not in fires.columns:
        out["is_future"] = out["is_future"].fillna(False)
    return out


def fire_load_for_points(
    pt_lat: np.ndarray,
    pt_lon: np.ndarray,
    pt_time: np.ndarray,        # datetime64, the time t_k at each trajectory point
    pt_T: np.ndarray,           # datetime64, the valid hour T the parcel arrives
    pt_alive: np.ndarray,       # bool, dead points contribute nothing
    fires: pd.DataFrame,        # latitude, longitude, frp, acq_ts, district
    cfg: Config = CONFIG,
    return_districts: bool = True,
):
    """Core §10.2 kernel. Returns (fl[P], fl_by_district[P, D] or None, district_names).

    ``fl[p] = Σ_fires FRP · w_space · w_time · w_age`` for trajectory point p.
    All arrays are flattened over whatever points the caller passes (one parcel's
    49 points, or many parcels' points at once)."""
    P = pt_lat.size
    if fires is None or fires.empty:
        return np.zeros(P), (np.zeros((P, 0)) if return_districts else None), []

    lat0, lon0 = cfg.lon_lat_centre()[1], cfg.lon_lat_centre()[0]
    fx, fy = _project(fires["latitude"].to_numpy(), fires["longitude"].to_numpy(), lat0, lon0, cfg)
    px, py = _project(pt_lat, pt_lon, lat0, lon0, cfg)

    ftime = pd.to_datetime(fires["acq_ts"], utc=True).dt.tz_localize(None).to_numpy("datetime64[ns]")
    frp = fires["frp"].to_numpy(dtype="float64")

    tree = cKDTree(np.column_stack([fx, fy]))
    fl = np.zeros(P, dtype="float64")

    districts = list(pd.unique(fires["district"])) if return_districts else []
    didx = {d: i for i, d in enumerate(districts)}
    fire_dcode = np.array([didx[d] for d in fires["district"]]) if return_districts else None
    fld = np.zeros((P, len(districts)), dtype="float64") if return_districts else None

    sigma2 = 2.0 * (cfg.sigma_m ** 2)
    w_time_ns = np.timedelta64(int(cfg.w_time_hours * 3600), "s").astype("timedelta64[ns]")
    tau_s = cfg.tau_age_hours * 3600.0

    # Pre-strip tz for subtraction (both are UTC-naive ns after .astype).
    pt_time_ns = pt_time.astype("datetime64[ns]")
    pt_T_ns = pt_T.astype("datetime64[ns]")

    neighbours = tree.query_ball_point(np.column_stack([px, py]), r=cfg.cutoff_m)
    for p in range(P):
        if not pt_alive[p]:
            continue
        idx = neighbours[p]
        if not idx:
            continue
        idx = np.asarray(idx)
        d2 = (fx[idx] - px[p]) ** 2 + (fy[idx] - py[p]) ** 2
        w_space = np.exp(-d2 / sigma2)
        dt = np.abs(ftime[idx] - pt_time_ns[p])
        w_time = (dt <= w_time_ns).astype("float64")
        age_s = (pt_T_ns[p] - pt_time_ns[p]) / np.timedelta64(1, "s")
        w_age = np.exp(-max(age_s, 0.0) / tau_s)
        contrib = frp[idx] * w_space * w_time * w_age
        fl[p] = contrib.sum()
        if return_districts:
            np.add.at(fld[p], fire_dcode[idx], contrib)
    return fl, fld, districts


def compute_fire_load(tset, fires: pd.DataFrame, cfg: Config = CONFIG) -> pd.DataFrame:
    """Per-parcel fire load for a TrajectorySet (brief §10.2).

    Returns one row per parcel (station_id, valid_hour, member, lead_h) with the
    total ``fl`` and a ``fl_<district>`` column per district. fire_load.ensemble
    stats (p50/p90 across members) are taken downstream in build_features.
    """
    traj = tset.traj
    n, steps1 = traj.lat.shape
    # Extend fires into the future up to the latest valid hour we trace to.
    horizon_end = pd.Timestamp(tset.valid_hour.max())
    fires = extend_future_fires(fires, horizon_end, cfg)

    # Flatten every (parcel, step) point; remember which parcel each belongs to.
    flat_lat = traj.lat.reshape(-1)
    flat_lon = traj.lon.reshape(-1)
    flat_time = traj.times.reshape(-1)
    flat_alive = traj.alive.reshape(-1)
    # T (arrival valid hour) repeats across the 49 steps of each parcel.
    flat_T = np.repeat(tset.valid_hour, steps1)

    fl, fld, districts = fire_load_for_points(
        flat_lat, flat_lon, flat_time, flat_T, flat_alive, fires, cfg, return_districts=True
    )
    # Sum the per-point contributions back up to per-parcel totals.
    fl_parcel = fl.reshape(n, steps1).sum(axis=1)
    out = {
        "station_id": tset.station_id,
        "valid_hour": tset.valid_hour,
        "member": tset.member,
        "lead_h": tset.lead_h,
        "fl": fl_parcel,
    }
    if districts:
        fld_parcel = fld.reshape(n, steps1, len(districts)).sum(axis=1)
        for di, d in enumerate(districts):
            out[f"fl_{d}"] = fld_parcel[:, di]
    return pd.DataFrame(out)


def to_fires_geojson(fires: pd.DataFrame) -> dict:
    """fires_48h.geojson for the map + reports (lon, lat, frp, acq_ts, district)."""
    feats = []
    for _, r in fires.iterrows():
        feats.append({
            "type": "Feature",
            "geometry": {"type": "Point", "coordinates": [float(r["longitude"]), float(r["latitude"])]},
            "properties": {
                "frp": float(r["frp"]),
                "acq_ts": pd.Timestamp(r["acq_ts"]).strftime("%Y-%m-%dT%H:%M:%SZ"),
                "district": str(r.get("district", "Other")),
            },
        })
    return {"type": "FeatureCollection", "features": feats}
