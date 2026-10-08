"""
OWNER    : Yasho1
DUE      : D2 02:00
TASK     :
  §10.3 feature table: one row per station x issue_time x lead_h. THE SAME function is used by training/build_training_set.py and the live pipeline (no train/serve skew). Target log1p(pm25). Columns frozen in FEATURES list exported for model metadata.
DONE WHEN: Live features for a run land at features/run=<run_id>/station_features.parquet.
GUIDE    : docs/team/YASHO1.md  |  brief: docs/PROJECT_BRIEF.md
STATUS   : DONE
"""

from __future__ import annotations

import numpy as np
import pandas as pd

from plumetrace_engine.config import CONFIG, Config

# The frozen feature contract (brief §10.3). Saved into model metadata.json so
# training and inference use the identical column order. station_id is a native
# LightGBM categorical. fire_load / fire_load_p90 / hpbl are log1p-transformed.
FEATURES = [
    "pm25_now",
    "pm25_mean_24h",
    "pm25_same_hour_yday",
    "fire_load",
    "fire_load_p90",
    "hpbl_m",
    "wind_speed_10m",
    "rh_2m",
    "t_2m",
    "hour_sin", "hour_cos",
    "dow_sin", "dow_cos",
    "doy_sin", "doy_cos",
    "lead_h",
    "station_id",
]
CATEGORICAL = ["station_id"]
TARGET = "pm25_log"  # log1p(pm25); invert with expm1 for metrics
# Columns that are counterfactually zeroed for the no-fire attribution run.
FIRE_FEATURES = ["fire_load", "fire_load_p90"]


def _cyc(values, period):
    ang = 2 * np.pi * (np.asarray(values, "float64") / period)
    return np.sin(ang), np.cos(ang)


def aggregate_fire_load(fl_df: pd.DataFrame, cfg: Config = CONFIG) -> pd.DataFrame:
    """Collapse the per-member fire load to p50/p90 per (station, valid_hour),
    keeping per-district p50 sums (for the attribution district split)."""
    dist_cols = [c for c in fl_df.columns if c.startswith("fl_")]
    g = fl_df.groupby(["station_id", "valid_hour"], observed=True)
    agg = g["fl"].agg(fl_p50="median", fl_p90=lambda s: np.quantile(s, 0.9)).reset_index()
    if dist_cols:
        dmean = g[dist_cols].median().reset_index()
        agg = agg.merge(dmean, on=["station_id", "valid_hour"])
    return agg


def _obs_lookup(obs: pd.DataFrame):
    """Return a function (station_id, ts) -> pm25 using nearest-past within 90min,
    plus a windowed-mean helper. obs columns: station_id, ts_utc, pm25."""
    if obs is None or obs.empty:
        return None
    o = obs.copy()
    o["ts_utc"] = pd.to_datetime(o["ts_utc"], utc=True)
    o = o.sort_values("ts_utc")
    by_station = {sid: g.reset_index(drop=True) for sid, g in o.groupby("station_id")}
    return by_station


def _latest_at(series_df, ts, within_min=90):
    """Nearest reading at or before ts, within a tolerance."""
    if series_df is None:
        return np.nan
    sub = series_df[series_df["ts_utc"] <= ts]
    if sub.empty:
        return np.nan
    row = sub.iloc[-1]
    if (ts - row["ts_utc"]) > pd.Timedelta(minutes=within_min):
        return np.nan
    return float(row["pm25"])


def build_features(
    stations,
    obs: pd.DataFrame,
    fl_df: pd.DataFrame,
    winds,
    issue_time,
    cfg: Config = CONFIG,
    *,
    with_target: bool = False,
) -> pd.DataFrame:
    """Build the §10.3 feature table: one row per (station, lead_h).

    The SAME function serves training (with_target=True, ERA5 winds) and live
    inference (with_target=False, GFS winds) — no train/serve skew.
    """
    T0 = pd.Timestamp(issue_time)
    if T0.tzinfo is None:
        T0 = T0.tz_localize("UTC")
    fl_agg = aggregate_fire_load(fl_df, cfg)
    fl_agg["valid_hour"] = pd.to_datetime(fl_agg["valid_hour"], utc=True)
    by_station = _obs_lookup(obs)
    ist = pd.Timedelta(minutes=cfg.ist_offset_min)

    rows = []
    for st in stations:
        sid = st["station_id"]
        sdf = by_station.get(sid) if by_station else None
        pm25_now = _latest_at(sdf, T0)
        if sdf is not None:
            win = sdf[(sdf["ts_utc"] > T0 - pd.Timedelta(hours=24)) & (sdf["ts_utc"] <= T0)]
            pm25_mean_24h = float(win["pm25"].mean()) if not win.empty else np.nan
        else:
            pm25_mean_24h = np.nan

        for lead in range(cfg.forecast_leads + 1):
            vh = T0 + pd.Timedelta(hours=lead)
            # same-hour-yesterday only if that time is already observed
            yday = vh - pd.Timedelta(hours=24)
            same_hour_yday = _latest_at(sdf, yday) if yday <= T0 else np.nan

            flrow = fl_agg[(fl_agg["station_id"] == sid) & (fl_agg["valid_hour"] == vh)]
            fl50 = float(flrow["fl_p50"].iloc[0]) if not flrow.empty else 0.0
            fl90 = float(flrow["fl_p90"].iloc[0]) if not flrow.empty else 0.0

            sf = winds.surface_features(np.array([st["lat"]]), np.array([st["lon"]]), vh)
            vist = vh + ist
            hs, hc = _cyc(vist.hour, 24)
            ds, dc = _cyc(vist.dayofweek, 7)
            ys, yc = _cyc(vist.dayofyear, 366)

            row = {
                "station_id": sid,
                "lead_h": lead,
                "valid_hour": vh.strftime("%Y-%m-%dT%H:%M:%SZ"),
                "pm25_now": pm25_now,
                "pm25_mean_24h": pm25_mean_24h,
                "pm25_same_hour_yday": same_hour_yday,
                "fire_load": np.log1p(fl50),
                "fire_load_p90": np.log1p(fl90),
                "hpbl_m": np.log1p(float(sf["hpbl"][0])),
                "wind_speed_10m": float(sf["wind_speed_10m"][0]),
                "rh_2m": float(sf["rh2m"][0]),
                "t_2m": float(sf["t2m"][0]),
                "hour_sin": hs, "hour_cos": hc,
                "dow_sin": ds, "dow_cos": dc,
                "doy_sin": ys, "doy_cos": yc,
            }
            # carry the raw district fire loads for the attribution split
            for c in [c for c in fl_agg.columns if c.startswith("fl_") and c not in ("fl_p50", "fl_p90")]:
                row[c] = float(flrow[c].iloc[0]) if not flrow.empty else 0.0
            if with_target:
                tgt = _latest_at(sdf, vh)
                row["pm25"] = tgt
                row[TARGET] = np.log1p(tgt) if not np.isnan(tgt) else np.nan
            rows.append(row)

    df = pd.DataFrame(rows)
    df["station_id"] = df["station_id"].astype("category")
    if with_target:
        df = df.dropna(subset=[TARGET]).reset_index(drop=True)
    return df
