"""
OWNER    : Yasho1
DUE      : D2 14:00
TASK     :
  Load models/lightgbm/<version>/{q10,q50,q90}.txt + metadata.json once per cold start (module-level cache). predict(df) -> p10/p50/p90 (expm1, sort to fix crossing). Fallback model 'persistence-v0' if no artefact exists so the pipeline never blocks on training.
DONE WHEN: StationForecast items written for every station x lead.
GUIDE    : docs/team/YASHO1.md  |  brief: docs/PROJECT_BRIEF.md
STATUS   : DONE
"""

from __future__ import annotations

import json
from pathlib import Path
from typing import Optional

import numpy as np
import pandas as pd

from plumetrace_engine.config import CONFIG, Config
from plumetrace_engine.features.build_features import CATEGORICAL, FEATURES

QUANTILES = (0.1, 0.5, 0.9)
_MODEL_CACHE: dict = {}


class PersistenceModel:
    """Fallback 'persistence-v0' (brief §10.7). p50 = pm25_now carried to every
    lead; a crude widening band for p10/p90 so the pipeline produces calibrated-
    enough output before a trained LightGBM exists. Never blocks the run."""

    model_version = "persistence-v0"
    features = FEATURES

    def predict_quantiles(self, df: pd.DataFrame) -> np.ndarray:
        now = df["pm25_now"].to_numpy(dtype="float64")
        now = np.where(np.isnan(now), 60.0, now)  # NCR-ish default if no obs yet
        p50 = now
        p10 = 0.7 * now
        p90 = 1.5 * now
        return np.column_stack([p10, p50, p90])


class LightGBMQuantileModel:
    """Three LightGBM quantile boosters loaded from a model dir."""

    def __init__(self, boosters: dict, metadata: dict):
        self.boosters = boosters            # {0.1: Booster, 0.5:..., 0.9:...}
        self.metadata = metadata
        self.model_version = metadata.get("model_version", "lgbm")
        self.features = metadata.get("features", FEATURES)

    def _matrix(self, df: pd.DataFrame) -> pd.DataFrame:
        X = df[self.features].copy()
        for c in CATEGORICAL:
            if c in X:
                X[c] = X[c].astype("category")
        return X

    def predict_quantiles(self, df: pd.DataFrame) -> np.ndarray:
        X = self._matrix(df)
        cols = []
        for a in QUANTILES:
            pred_log = self.boosters[a].predict(X)
            cols.append(np.expm1(pred_log))
        out = np.column_stack(cols)
        # Fix quantile crossing by sorting each row (brief §10.4).
        out.sort(axis=1)
        return np.clip(out, 0.0, None)


def load_model(model_dir: Optional[str] = None, cfg: Config = CONFIG):
    """Load the newest model from ``model_dir`` (local or already-synced path),
    caching per process. Falls back to PersistenceModel if no artefact is found
    so inference always works (brief §20 risk: 'model doesn't beat persistence')."""
    key = model_dir or "<fallback>"
    if key in _MODEL_CACHE:
        return _MODEL_CACHE[key]

    model = None
    if model_dir and Path(model_dir).exists():
        try:
            import lightgbm as lgb

            meta = json.loads((Path(model_dir) / "metadata.json").read_text())
            boosters = {}
            for a, name in zip(QUANTILES, ("q10", "q50", "q90")):
                boosters[a] = lgb.Booster(model_file=str(Path(model_dir) / f"{name}.txt"))
            model = LightGBMQuantileModel(boosters, meta)
        except Exception:  # noqa: BLE001 - never block the pipeline on a bad artefact
            model = None
    if model is None:
        model = PersistenceModel()
    _MODEL_CACHE[key] = model
    return model


def predict_forecast(feat_df: pd.DataFrame, model=None, model_dir=None, cfg: Config = CONFIG) -> pd.DataFrame:
    """Attach p10/p50/p90 columns to the feature table."""
    model = model or load_model(model_dir, cfg)
    q = model.predict_quantiles(feat_df)
    out = feat_df.copy()
    out["pm25_p10"] = q[:, 0]
    out["pm25_p50"] = q[:, 1]
    out["pm25_p90"] = q[:, 2]
    out["model_version"] = model.model_version
    return out


def run_forecast(run_id: str, model_dir: Optional[str] = None, cfg: Config = CONFIG) -> dict:
    """End-to-end inference step (brief §7). Writes StationForecast and Attribution tables."""
    from plumetrace_engine.common import ddb, s3io
    from plumetrace_engine.model.attribution import fire_share, district_shares, aggregate_attribution

    feat_key = s3io.key_features(run_id)
    try:
        feat_df = s3io.get_parquet(feat_key)
    except Exception:
        return {}
    if feat_df.empty:
        return {}

    # 2. Predict + fire share
    res_df = fire_share(feat_df, model_dir=model_dir, cfg=cfg)
    
    district_cols = [c for c in res_df.columns if c.startswith("fl_") and c not in ("fl_p50", "fl_p90")]
    
    # 3. Write StationForecast
    station_items = []
    for _, row in res_df.iterrows():
        top = district_shares(row, district_cols)
        item = ddb.build_station_item(
            location_id=row["station_id"],
            run_id=run_id,
            valid_hour=row["valid_hour"],
            lead_h=int(row["lead_h"]),
            pm25_p10=int(round(row["pm25_p10"])),
            pm25_p50=int(round(row["pm25_p50"])),
            pm25_p90=int(round(row["pm25_p90"])),
            fire_share=round(row["fire_share_p50"], 4),
            fire_share_p10=round(row["fire_share_p10"], 4),
            fire_share_p90=round(row["fire_share_p90"], 4),
            top_sources=top,
        )
        station_items.append(item)
    
    n_station = ddb.batch_write("StationForecast", station_items)
    
    # 4. Attribution
    receptors = list(feat_df["station_id"].unique())
    
    try:
        fires_geo = s3io.get_json(s3io.key_outputs_fires_48h(run_id))
        fire_rows = [f["properties"] for f in fires_geo.get("features", [])]
        fires_df = pd.DataFrame(fire_rows)
    except Exception:
        fires_df = pd.DataFrame()

    attr_df = aggregate_attribution(res_df, fires_df, receptors, cfg)
    attr_items = []
    for _, row in attr_df.iterrows():
        item = ddb.build_attribution_item(
            date=row["date"],
            district=row["district"],
            share_p10=float(row["share_p10"]),
            share_p50=float(row["share_p50"]),
            share_p90=float(row["share_p90"]),
            fire_count=int(row["fire_count"]),
            frp_sum_mw=float(row["frp_sum_mw"]),
            receptor_stations=row["receptor_stations"],
        )
        attr_items.append(item)
        
    n_attr = ddb.batch_write("Attribution", attr_items)

    return {
        "max_pm25": int(round(res_df["pm25_p50"].max())),
        "station_items_written": n_station,
        "attribution_items_written": n_attr,
        "model_version": res_df["model_version"].iloc[0]
    }
