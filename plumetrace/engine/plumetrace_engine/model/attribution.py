"""
OWNER    : Yasho1
DUE      : D2 15:00
TASK     :
  §10.5 counterfactual: re-predict with fire_load=fire_load_p90=0 for each quantile model; fire_share=clip((y_full-y_nofire)/y_full,0,1); district share_d = fire_share * FL_d / ΣFL_d. Aggregate to Attribution table per date (share p10/p50/p90, fire_count, frp_sum_mw, receptor_stations).
DONE WHEN: tests/engine/test_fire_share.py passes; shares within [0,1].
GUIDE    : docs/team/YASHO1.md  |  brief: docs/PROJECT_BRIEF.md
STATUS   : DONE
"""

from __future__ import annotations

import numpy as np
import pandas as pd

from plumetrace_engine.config import CONFIG, Config
from plumetrace_engine.features.build_features import FIRE_FEATURES
from plumetrace_engine.model.infer import load_model, predict_forecast

EPS = 1e-9


def fire_share(feat_df: pd.DataFrame, model=None, model_dir=None, cfg: Config = CONFIG) -> pd.DataFrame:
    """Counterfactual fire share per (station, lead) (brief §10.5).

    fire_share = clip((y_full - y_nofire) / y_full, 0, 1), computed for each of
    the p10/p50/p90 quantiles, then sorted so p10<=p50<=p90.
    Returns the feature table with fire_share_p10/p50/p90 columns added.
    """
    model = model or load_model(model_dir, cfg)
    full = model.predict_quantiles(feat_df)              # (n,3) p10,p50,p90

    nofire_df = feat_df.copy()
    for c in FIRE_FEATURES:
        if c in nofire_df:
            nofire_df[c] = 0.0
    nofire = model.predict_quantiles(nofire_df)          # (n,3)

    share = np.clip((full - nofire) / np.maximum(full, EPS), 0.0, 1.0)
    share.sort(axis=1)  # keep p10<=p50<=p90 after the ratio

    out = feat_df.copy()
    out["pm25_p10"], out["pm25_p50"], out["pm25_p90"] = full[:, 0], full[:, 1], full[:, 2]
    out["fire_share_p10"] = share[:, 0]
    out["fire_share_p50"] = share[:, 1]
    out["fire_share_p90"] = share[:, 2]
    out["model_version"] = model.model_version
    return out


def district_shares(row: pd.Series, district_cols) -> list[dict]:
    """Split a row's p50 fire_share across districts by FL_d / ΣFL_d (brief §10.5).
    Returns the top-3 {district, share} descending."""
    fl = np.array([max(row.get(c, 0.0), 0.0) for c in district_cols], dtype="float64")
    total = fl.sum()
    if total <= EPS:
        return []
    weights = fl / total
    shares = row["fire_share_p50"] * weights
    names = [c[len("fl_"):] for c in district_cols]
    order = np.argsort(shares)[::-1]
    out = []
    for i in order[:3]:
        if shares[i] <= 0:
            break
        out.append({"district": names[i], "share": round(float(shares[i]), 4)})
    return out


def aggregate_attribution(
    share_df: pd.DataFrame,
    fires: pd.DataFrame,
    receptor_stations,
    cfg: Config = CONFIG,
) -> pd.DataFrame:
    """Build Attribution rows per (date, district): average fire_share over the
    NCR receptors and valid hours of that IST day, split by district FL, with the
    fire_count and frp_sum_mw for that district/day (brief §10.5)."""
    if share_df.empty:
        return pd.DataFrame()
    district_cols = [c for c in share_df.columns
                     if c.startswith("fl_") and c not in ("fl_p50", "fl_p90")]
    df = share_df.copy()
    vh = pd.to_datetime(df["valid_hour"], utc=True) + pd.Timedelta(minutes=cfg.ist_offset_min)
    df["date"] = vh.dt.strftime("%Y-%m-%d")

    # fires per district/day for the evidence counts
    fcounts = {}
    if fires is not None and not fires.empty:
        f = fires.copy()
        fts = pd.to_datetime(f["acq_ts"], utc=True) + pd.Timedelta(minutes=cfg.ist_offset_min)
        f["date"] = fts.dt.strftime("%Y-%m-%d")
        grp = f.groupby(["date", "district"])
        fcounts = {k: (len(g), float(g["frp"].sum())) for k, g in grp}

    rows = []
    for date, day in df.groupby("date"):
        tot = np.array([day[c].clip(lower=0).sum() for c in district_cols], dtype="float64")
        total = tot.sum()
        share_p = {q: float(day[f"fire_share_{q}"].mean()) for q in ("p10", "p50", "p90")}
        if total <= EPS:
            continue
        for ci, c in enumerate(district_cols):
            name = c[len("fl_"):]
            w = tot[ci] / total
            fc, frp = fcounts.get((date, name), (0, 0.0))
            rows.append({
                "date": date,
                "district": name,
                "share_p10": round(share_p["p10"] * w, 4),
                "share_p50": round(share_p["p50"] * w, 4),
                "share_p90": round(share_p["p90"] * w, 4),
                "fire_count": int(fc),
                "frp_sum_mw": round(frp, 2),
                "receptor_stations": list(receptor_stations),
            })
    return pd.DataFrame(rows).sort_values(["date", "share_p50"], ascending=[True, False])
