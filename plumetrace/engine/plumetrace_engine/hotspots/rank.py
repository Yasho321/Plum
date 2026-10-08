"""
OWNER    : Yasho1
DUE      : D2 17:00
TASK     :
  §12.1: priority = share_p50 * (1 + trend_7d) -> top 5 districts. DBSCAN (haversine, eps 2 km, min_samples 3) on last-48 h fires -> village clusters {cluster_id, district, centroid [lon,lat], h3_res7, fire_count, frp_sum}. Both go into summary.json (hotspot_districts, hotspot_villages).
DONE WHEN: Khare's farmerAlert reads hotspot_villages from summary.json.
GUIDE    : docs/team/YASHO1.md  |  brief: docs/PROJECT_BRIEF.md
STATUS   : DONE
"""

from __future__ import annotations

import h3
import numpy as np
import pandas as pd
from sklearn.cluster import DBSCAN

from plumetrace_engine.config import CONFIG, Config


def rank_districts(attribution: pd.DataFrame, fires: pd.DataFrame,
                   cfg: Config = CONFIG) -> list[dict]:
    """Top-N districts by priority = share_p50 * (1 + trend_7d) (brief §12.1).

    ``attribution`` is the latest-date Attribution rows (district, share_p50...).
    ``trend_7d`` = relative change in fire count vs the previous-7-day daily mean.
    """
    if attribution is None or attribution.empty:
        return []
    trend = _fire_trend_by_district(fires, cfg)
    rows = []
    for _, r in attribution.iterrows():
        d = r["district"]
        t = trend.get(d, 0.0)
        rows.append({
            "district": d,
            "share": round(float(r["share_p50"]), 4),
            "share_p10": round(float(r.get("share_p10", r["share_p50"])), 4),
            "share_p90": round(float(r.get("share_p90", r["share_p50"])), 4),
            "trend_7d": round(float(t), 3),
            "priority": round(float(r["share_p50"]) * (1.0 + float(t)), 4),
        })
    rows.sort(key=lambda x: x["priority"], reverse=True)
    return rows[: cfg.hotspot_top_districts]


def _fire_trend_by_district(fires: pd.DataFrame, cfg: Config) -> dict:
    if fires is None or fires.empty:
        return {}
    f = fires.copy()
    ts = pd.to_datetime(f["acq_ts"], utc=True)
    latest = ts.max()
    last24 = ts >= latest - pd.Timedelta(hours=24)
    prev7 = (ts < latest - pd.Timedelta(hours=24)) & (ts >= latest - pd.Timedelta(days=8))
    out = {}
    for d in f["district"].unique():
        dm = f["district"] == d
        n_now = int((dm & last24).sum())
        prev_mean = float((dm & prev7).sum()) / 7.0
        out[d] = (n_now - prev_mean) / max(prev_mean, 1.0)
    return out


def cluster_villages(fires: pd.DataFrame, cfg: Config = CONFIG,
                     max_clusters: int = 20) -> list[dict]:
    """DBSCAN the last-48 h fires into village-scale clusters (brief §12.1).

    Haversine DBSCAN with eps = 2 km (in radians), min_samples = 3. Each cluster
    is named "<district> cluster <n>" absent a gazetteer, with its centroid, the
    res-7 H3 cell, fire count and FRP sum."""
    if fires is None or fires.empty:
        return []
    f = fires.copy()
    ts = pd.to_datetime(f["acq_ts"], utc=True)
    f = f[ts >= ts.max() - pd.Timedelta(hours=48)]
    if len(f) < cfg.dbscan_min_samples:
        return []

    coords = np.radians(f[["latitude", "longitude"]].to_numpy("float64"))
    eps = cfg.dbscan_eps_km / (cfg.earth_radius_m / 1000.0)
    labels = DBSCAN(eps=eps, min_samples=cfg.dbscan_min_samples,
                    metric="haversine").fit_predict(coords)
    f = f.assign(_c=labels)
    clusters = []
    per_district_n: dict[str, int] = {}
    for lab, g in f[f["_c"] >= 0].groupby("_c"):
        district = g["district"].mode().iloc[0] if not g["district"].mode().empty else "Other"
        per_district_n[district] = per_district_n.get(district, 0) + 1
        clat = float(g["latitude"].mean())
        clon = float(g["longitude"].mean())
        clusters.append({
            "cluster_id": int(lab),
            "name": f"{district} cluster {per_district_n[district]}",
            "district": district,
            "centroid": [round(clon, 4), round(clat, 4)],
            "h3_res7": h3.latlng_to_cell(clat, clon, cfg.h3_res_fine),
            "fire_count": int(len(g)),
            "frp_sum": round(float(g["frp"].sum()), 2),
        })
    clusters.sort(key=lambda c: c["frp_sum"], reverse=True)
    return clusters[:max_clusters]
