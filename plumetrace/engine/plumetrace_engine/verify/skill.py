"""
OWNER    : Yasho1
DUE      : D3 13:00
TASK     :
  §10.8 metrics by lead bucket (0–6, 6–24, 24–48, 48–72): MAE, RMSE, p10–p90 coverage, skill vs persistence, Severe (>250) hit rate; for 'live' (StationForecast with obs) and 'backtest' (training/backtest output). Write outputs/skill/latest.json (SkillResponse).
DONE WHEN: AC3: Skill page shows all 4 buckets for backtest; live fills in over time.
GUIDE    : docs/team/YASHO1.md  |  brief: docs/PROJECT_BRIEF.md
STATUS   : DONE
"""

from __future__ import annotations

from typing import Optional

import numpy as np
import pandas as pd

from plumetrace_engine.config import CONFIG, Config


def _bucket_label(lo: int, hi: int) -> str:
    return f"{lo}-{hi}"


def _assign_bucket(lead_h, cfg: Config):
    labels = np.full(len(lead_h), None, dtype=object)
    for lo, hi in cfg.lead_buckets:
        # [lo, hi) except the final bucket which includes hi
        last = (lo, hi) == cfg.lead_buckets[-1]
        m = (lead_h >= lo) & ((lead_h <= hi) if last else (lead_h < hi))
        labels[m.to_numpy() if hasattr(m, "to_numpy") else m] = _bucket_label(lo, hi)
    return labels


def compute_skill(df: pd.DataFrame, cfg: Config = CONFIG) -> list[dict]:
    """Per-lead-bucket metrics (brief §10.8).

    ``df`` needs columns: lead_h, obs_pm25, pm25_p50, pm25_p10, pm25_p90 and
    pm25_now (the issue-time reading, for the persistence baseline). Rows with a
    null obs are dropped. Returns one SkillBucket dict per bucket (always all 4,
    with n=0 and zeros when a bucket has no data)."""
    severe = cfg.severe_pm25
    out = []
    if df is None or df.empty:
        return [_empty(_bucket_label(lo, hi)) for lo, hi in cfg.lead_buckets]

    d = df.dropna(subset=["obs_pm25", "pm25_p50"]).copy()
    d["_bucket"] = _assign_bucket(d["lead_h"], cfg)

    for lo, hi in cfg.lead_buckets:
        label = _bucket_label(lo, hi)
        b = d[d["_bucket"] == label]
        if b.empty:
            out.append(_empty(label))
            continue
        obs = b["obs_pm25"].to_numpy("float64")
        p50 = b["pm25_p50"].to_numpy("float64")
        p10 = b["pm25_p10"].to_numpy("float64")
        p90 = b["pm25_p90"].to_numpy("float64")
        err = np.abs(p50 - obs)
        mae = float(err.mean())
        rmse = float(np.sqrt(((p50 - obs) ** 2).mean()))
        coverage = float(((obs >= p10) & (obs <= p90)).mean())

        skill = 0.0
        if "pm25_now" in b:
            persist = b["pm25_now"].to_numpy("float64")
            mask = ~np.isnan(persist)
            if mask.any():
                mae_p = float(np.abs(persist[mask] - obs[mask]).mean())
                if mae_p > 0:
                    skill = 1.0 - mae / mae_p

        # Severe-event hit rate: of actually-severe hours, how many did we flag?
        actual_sev = obs > severe
        pred_sev = p50 > severe
        tp = int((actual_sev & pred_sev).sum())
        fn = int((actual_sev & ~pred_sev).sum())
        hit = float(tp / (tp + fn)) if (tp + fn) > 0 else 0.0

        out.append({
            "lead_bucket": label,
            "mae": round(mae, 2),
            "rmse": round(rmse, 2),
            "coverage_p10_p90": round(float(np.clip(coverage, 0, 1)), 3),
            "skill_vs_persistence": round(skill, 3),
            "severe_hit_rate": round(float(np.clip(hit, 0, 1)), 3),
            "n": int(len(b)),
        })
    return out


def _empty(label: str) -> dict:
    return {
        "lead_bucket": label, "mae": 0.0, "rmse": 0.0, "coverage_p10_p90": 0.0,
        "skill_vs_persistence": 0.0, "severe_hit_rate": 0.0, "n": 0,
    }


def build_skill_response(
    live_df: Optional[pd.DataFrame],
    backtest_df: Optional[pd.DataFrame],
    days: int,
    generated_at: str,
    cfg: Config = CONFIG,
) -> dict:
    """Assemble the SkillResponse (brief §8.4 /skill)."""
    return {
        "days": int(days),
        "generated_at": generated_at,
        "backtest": compute_skill(backtest_df, cfg) if backtest_df is not None else
                    [_empty(_bucket_label(lo, hi)) for lo, hi in cfg.lead_buckets],
        "live": compute_skill(live_df, cfg) if live_df is not None else
                [_empty(_bucket_label(lo, hi)) for lo, hi in cfg.lead_buckets],
    }
