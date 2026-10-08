"""
OWNER    : Yasho1
DUE      : D2 16:00
TASK     :
  §10.6: polygon_to_cells over the NCR box at res 7; IDW (power 2, ≤6 nearest, ≤25 km) from station p10/p50/p90 and fire_share; null beyond 25 km. Write Forecast items (via common/ddb.py) + outputs/run=<run_id>/pm25_h3_<valid_hour>.geojson for each hour.
DONE WHEN: GET /forecast for a real run renders on Tanmay's map.
GUIDE    : docs/team/YASHO1.md  |  brief: docs/PROJECT_BRIEF.md
STATUS   : DONE
"""

from __future__ import annotations

from typing import Optional

import h3
import numpy as np
import pandas as pd
from scipy.spatial import cKDTree

from plumetrace_engine.config import CONFIG, Config

# Columns interpolated from stations to cells.
_VALUE_COLS = ["pm25_p10", "pm25_p50", "pm25_p90",
               "fire_share_p10", "fire_share_p50", "fire_share_p90"]


def ncr_cells(cfg: Config = CONFIG) -> list[str]:
    """All res-7 H3 cells covering the NCR receptor box (brief §10.6)."""
    w, s, e, n = cfg.ncr_box
    poly = h3.LatLngPoly([(s, w), (s, e), (n, e), (n, w)])
    return list(h3.polygon_to_cells(poly, cfg.h3_res_fine))


def _project_km(lat, lon, lat0, lon0, cfg: Config):
    R = cfg.earth_radius_m / 1000.0
    x = np.radians(np.asarray(lon, "float64") - lon0) * np.cos(np.radians(lat0)) * R
    y = np.radians(np.asarray(lat, "float64") - lat0) * R
    return np.column_stack([x, y])


def grid_forecast(station_fc: pd.DataFrame, run_id: str, cfg: Config = CONFIG):
    """Interpolate station forecasts onto the NCR H3 grid (brief §10.6).

    Parameters
    ----------
    station_fc : one row per (station_id, valid_hour) with lat, lon, lead_h,
                 the p10/p50/p90 PM2.5 and fire_share columns, and optional
                 ``top_sources`` (list of {district, share}).

    Returns (forecast_items, geojson_by_valid_hour):
      forecast_items   : list of dicts shaped for the Forecast DynamoDB table
      geojson_by_hour  : {valid_hour: FeatureCollection} for pm25_h3_<hour>.geojson
    """
    cfg_ = cfg
    cells = ncr_cells(cfg_)
    cell_lat = np.array([h3.cell_to_latlng(c)[0] for c in cells])
    cell_lon = np.array([h3.cell_to_latlng(c)[1] for c in cells])
    lat0, lon0 = cfg_.lon_lat_centre()[1], cfg_.lon_lat_centre()[0]
    cell_xy = _project_km(cell_lat, cell_lon, lat0, lon0, cfg_)

    items = []
    geojson_by_hour: dict[str, dict] = {}

    for valid_hour, grp in station_fc.groupby("valid_hour", sort=True):
        s_lat = grp["lat"].to_numpy("float64")
        s_lon = grp["lon"].to_numpy("float64")
        s_xy = _project_km(s_lat, s_lon, lat0, lon0, cfg_)
        tree = cKDTree(s_xy)
        k = min(cfg_.idw_max_neighbours, len(grp))
        dist, nn = tree.query(cell_xy, k=k, distance_upper_bound=cfg_.idw_max_km)
        if k == 1:
            dist = dist[:, None]
            nn = nn[:, None]
        values = {c: grp[c].to_numpy("float64") for c in _VALUE_COLS if c in grp}
        lead_h = int(grp["lead_h"].iloc[0]) if "lead_h" in grp else None

        feats = []
        for ci, cell in enumerate(cells):
            d = dist[ci]
            valid = np.isfinite(d) & (d <= cfg_.idw_max_km)
            if not valid.any():
                # No station within range -> null cell (UI hatches it).
                items.append(_item(cell, run_id, valid_hour, lead_h, None))
                feats.append(_feature(cell, None, cfg_))
                continue
            dd = d[valid]
            idx = nn[ci][valid]
            w = 1.0 / np.maximum(dd, 1e-6) ** cfg_.idw_power
            w = w / w.sum()
            vals = {c: float(np.dot(w, values[c][idx])) for c in values}
            # nearest station's district attribution as the cell's top_sources
            top = None
            if "top_sources" in grp:
                top = grp["top_sources"].iloc[int(idx[np.argmin(dd)])]
            items.append(_item(cell, run_id, valid_hour, lead_h, vals, top))
            feats.append(_feature(cell, vals, cfg_))
        geojson_by_hour[str(valid_hour)] = {"type": "FeatureCollection", "features": feats}

    return items, geojson_by_hour


def _item(cell, run_id, valid_hour, lead_h, vals, top=None) -> dict:
    """Forecast table item (brief §8.1). null vals -> no-data cell."""
    item = {
        "pk": f"h3#{cell}",
        "sk": f"{run_id}#{valid_hour}",
        "run_id": run_id,
        "valid_hour": str(valid_hour),
        "lead_h": lead_h,
        "h3": cell,
    }
    if vals is None:
        item.update({k: None for k in ("pm25", "pm25_p10", "pm25_p90",
                                       "fire_share", "fire_share_p10", "fire_share_p90")})
    else:
        item.update({
            "pm25": round(vals["pm25_p50"], 1),
            "pm25_p10": round(vals["pm25_p10"], 1),
            "pm25_p90": round(vals["pm25_p90"], 1),
            "fire_share": round(vals.get("fire_share_p50", 0.0), 4),
            "fire_share_p10": round(vals.get("fire_share_p10", 0.0), 4),
            "fire_share_p90": round(vals.get("fire_share_p90", 0.0), 4),
            "top_sources": top if top is not None else [],
        })
    return item


def _feature(cell, vals, cfg: Config) -> dict:
    boundary = h3.cell_to_boundary(cell)  # [(lat, lon), ...]
    ring = [[lon, lat] for (lat, lon) in boundary]
    ring.append(ring[0])
    return {
        "type": "Feature",
        "geometry": {"type": "Polygon", "coordinates": [ring]},
        "properties": {
            "h3": cell,
            "pm25": None if vals is None else round(vals["pm25_p50"], 1),
            "pm25_p10": None if vals is None else round(vals["pm25_p10"], 1),
            "pm25_p90": None if vals is None else round(vals["pm25_p90"], 1),
            "fire_share": None if vals is None else round(vals.get("fire_share_p50", 0.0), 4),
        },
    }
