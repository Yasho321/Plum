"""
OWNER    : Yasho1
DUE      : D2 14:00
TASK     :
  Load models/lightgbm/<version>/{q10,q50,q90}.txt + metadata.json once per cold start (module-level cache). predict(df) -> p10/p50/p90 (expm1, sort to fix crossing). Fallback model 'persistence-v0' if no artefact exists so the pipeline never blocks on training.
DONE WHEN: StationForecast items written for every station x lead.
GUIDE    : docs/team/YASHO1.md  |  brief: docs/PROJECT_BRIEF.md
STATUS   : WIP
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
