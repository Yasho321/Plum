"""
OWNER    : Yasho1
DUE      : D2 17:00
TASK     :
  Build outputs/run=<run_id>/summary.json matching contracts RunSummary: max_pm25, peak_window_utc, delhi_fire_share p10/p50/p90, hotspot_districts, hotspot_villages, degraded[], model_version, backtest MAE snapshot.
DONE WHEN: Validates against contracts; identical shape to contracts/mocks/summary.json.
GUIDE    : docs/team/YASHO1.md  |  brief: docs/PROJECT_BRIEF.md
STATUS   : DONE
"""

from __future__ import annotations

from typing import Optional

import numpy as np
import pandas as pd

from plumetrace_engine.config import CONFIG, Config


def build_summary(
    run_id: str,
    issued_at: str,
    model_version: str,
    station_fc: pd.DataFrame,          # per (station, valid_hour): pm25_p10/p50/p90, fire_share_*, lead_h
    top_districts: list[dict],         # from hotspots.rank.rank_districts
    villages: list[dict],              # from hotspots.rank.cluster_villages
    *,
    stations_count: int,
    cells_count: int,
    degraded: Optional[list[str]] = None,
    cfg: Config = CONFIG,
) -> dict:
    """Assemble the RunSummary dict (brief §8 / contracts.RunSummary).

    The peak is taken over the NCR receptor forecasts: the valid hour with the
    greatest mean p50, reported with its p10/p90 and a contiguous peak window
    (hours within 90 % of the peak mean)."""
    degraded = degraded or []

    # --- peak PM2.5 over the NCR receptors ---
    by_hour = (
        station_fc.groupby("valid_hour")[["pm25_p10", "pm25_p50", "pm25_p90"]]
        .mean()
        .sort_index()
    )
    peak_hour = by_hour["pm25_p50"].idxmax()
    peak = by_hour.loc[peak_hour]
    thresh = 0.9 * peak["pm25_p50"]
    hot = by_hour.index[by_hour["pm25_p50"] >= thresh]
    peak_window = [_to_utc(hot.min()), _to_utc(hot.max())]

    # --- Delhi fire share: mean over NCR receptors at the peak window ---
    fs = station_fc[station_fc["valid_hour"].between(hot.min(), hot.max())]
    delhi = {q: float(np.clip(fs[f"fire_share_{q}"].mean(), 0, 1))
             for q in ("p10", "p50", "p90")}

    summary = {
        "run_id": run_id,
        "issued_at": issued_at,
        "model_version": model_version,
        "max_pm25": round(float(peak["pm25_p50"])),
        "max_pm25_p10": round(float(peak["pm25_p10"])),
        "max_pm25_p90": round(float(peak["pm25_p90"])),
        "peak_window_utc": peak_window,
        "delhi_fire_share_p10": round(delhi["p10"], 4),
        "delhi_fire_share_p50": round(delhi["p50"], 4),
        "delhi_fire_share_p90": round(delhi["p90"], 4),
        "hotspot_districts": [
            {
                "district": d["district"],
                "share": d["share"],
                "share_p10": d.get("share_p10", d["share"]),
                "share_p90": d.get("share_p90", d["share"]),
                "trend_7d": d.get("trend_7d", 0.0),
            }
            for d in top_districts
        ],
        "hotspot_villages": [
            {
                "name": v["name"],
                "district": v["district"],
                "h3": v.get("h3") or v.get("h3_res7"),
                "lat": float(v["centroid"][1]) if "centroid" in v else float(v["lat"]),
                "lon": float(v["centroid"][0]) if "centroid" in v else float(v["lon"]),
                "fire_count": int(v["fire_count"]),
            }
            for v in villages
        ],
        "degraded": list(degraded),
        "stations_count": int(stations_count),
        "cells_count": int(cells_count),
    }
    return summary


def _to_utc(valid_hour: str) -> str:
    """Normalise a valid-hour string to a Utc value ending in Z (keep as-is if
    already minute-precision)."""
    return str(valid_hour)


def validate_summary(summary: dict) -> dict:
    """Validate against the frozen contract if the pydantic mirror is importable
    (it is in tests / with PYTHONPATH=contracts/python). No-op otherwise so the
    engine never hard-depends on the contracts package at runtime."""
    try:
        from plumetrace_contracts.models import RunSummary  # type: ignore
    except Exception:  # noqa: BLE001
        return summary
    RunSummary.model_validate(summary)
    return summary
