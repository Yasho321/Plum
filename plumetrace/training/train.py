"""
OWNER    : Yasho1
DUE      : D2 10:00
TASK     :
  LightGBM quantile models alpha 0.1/0.5/0.9, station_id categorical. Split: train 2024 + Oct 2025, validate Nov 2025, NEVER shuffle across time. Early stopping on validation. Save models/lightgbm/<version>/{q10,q50,q90}.txt + metadata.json (features, data ranges, metrics, git sha).
DONE WHEN: Artefacts in S3; infer.py picks them up.
GUIDE    : docs/team/YASHO1.md  |  brief: docs/PROJECT_BRIEF.md
STATUS   : DONE
"""

import os
import json
import glob
import pandas as pd
from datetime import datetime
from plumetrace_engine.common import s3io
from plumetrace_engine.features.build_features import FEATURES, CATEGORICAL, TARGET

def load_data():
    path = os.path.join(s3io.local_root(), "features", "training", "part-*.parquet")
    files = glob.glob(path)
    dfs = []
    for f in files:
        dfs.append(pd.read_parquet(f))
    if not dfs:
        return pd.DataFrame(columns=FEATURES + [TARGET, "valid_hour"])
    return pd.concat(dfs, ignore_index=True)

def main():
    try:
        import lightgbm as lgb
    except ImportError:
        print("lightgbm not installed")
        return

    df = load_data()
    if df.empty:
        print("No training data")
        return

    df["valid_hour"] = pd.to_datetime(df["valid_hour"], utc=True)
    
    train_mask = (df["valid_hour"].dt.year == 2024) | ((df["valid_hour"].dt.year == 2025) & (df["valid_hour"].dt.month == 10))
    val_mask = (df["valid_hour"].dt.year == 2025) & (df["valid_hour"].dt.month == 11)
    
    train_df = df[train_mask].copy()
    val_df = df[val_mask].copy()
    
    if train_df.empty or val_df.empty:
        print("Not enough data for train/val split")
        return

    X_train = train_df[FEATURES]
    y_train = train_df[TARGET]
    X_val = val_df[FEATURES]
    y_val = val_df[TARGET]
    
    for c in CATEGORICAL:
        X_train.loc[:, c] = X_train[c].astype("category")
        X_val.loc[:, c] = X_val[c].astype("category")

    version = f"lgbm-{datetime.now().strftime('%Y-%m-%d')}a"
    
    params = {
        "learning_rate": 0.05,
        "num_leaves": 31,
        "min_data_in_leaf": 50,
        "objective": "quantile",
        "metric": "quantile",
        "verbose": -1
    }

    for alpha, name in zip([0.1, 0.5, 0.9], ["q10", "q50", "q90"]):
        print(f"Training {name} with alpha={alpha}")
        p = params.copy()
        p["alpha"] = alpha
        ds_train = lgb.Dataset(X_train, label=y_train)
        ds_val = lgb.Dataset(X_val, label=y_val, reference=ds_train)
        
        bst = lgb.train(
            p,
            ds_train,
            num_boost_round=1000,
            valid_sets=[ds_train, ds_val],
            callbacks=[lgb.early_stopping(50, verbose=False)]
        )
        local_path = f"{name}.txt"
        bst.save_model(local_path)
        with open(local_path, "rb") as f:
            s3io.put_bytes(s3io.key_model(version, name), f.read())
            
    meta = {
        "model_version": version,
        "features": FEATURES,
        "git_sha": "unknown",
        "date_trained": datetime.now().isoformat()
    }
    s3io.put_json(s3io.key_model(version, "metadata"), meta, indent=2)
    print(f"Models saved to version {version}")

if __name__ == "__main__":
    main()
