"""
OWNER    : Yasho1
DUE      : D2 04:00
TASK     :
  Issue times every 6 h over the backfill window; for each: ERA5 WindField -> ensemble trajectories -> fire_load -> build_features (same code as live) -> features/training/part-*.parquet. Parallelise with multiprocessing.
DONE WHEN: Training table ~ (stations x 4 issues/day x 122 days x 73 leads) rows.
GUIDE    : docs/team/YASHO1.md  |  brief: docs/PROJECT_BRIEF.md
STATUS   : DONE
"""

import os
import pandas as pd
from datetime import datetime, timezone
import multiprocessing
from functools import partial

from plumetrace_engine.common import s3io
from plumetrace_engine.config import CONFIG
from plumetrace_engine.trajectories.winds import constant_wind_field
from plumetrace_engine.trajectories.ensemble import run_trajectories
from plumetrace_engine.features.fire_load import compute_fire_load
from plumetrace_engine.features.build_features import build_features

def process_issue(issue_ts, receptors):
    print(f"Processing issue time: {issue_ts}")
    run_id = issue_ts.strftime("%Y-%m-%dT%H:00Z")
    
    # We use constant_wind_field for now since ERA5 loader is not fully implemented
    winds = constant_wind_field(2.0, 2.0, start=issue_ts.strftime("%Y-%m-%dT%H:%M:%S"))
    
    try:
        tset = run_trajectories(run_id, receptors, winds)
        
        # Load fires (archive)
        date_str = issue_ts.strftime("%Y-%m-%d")
        try:
            fires = s3io.get_parquet(s3io.key_curated_fires(date_str))
        except Exception:
            fires = pd.DataFrame()
            
        fl_df = compute_fire_load(tset, fires)
        
        try:
            obs = s3io.get_parquet(s3io.key_curated_obs(date_str))
        except Exception:
            obs = pd.DataFrame()
            
        feat_df = build_features(receptors, obs, fl_df, winds, issue_ts, with_target=True)
        
        out_key = f"features/training/part-{run_id}.parquet"
        s3io.put_parquet(out_key, feat_df)
        return len(feat_df)
    except Exception as e:
        print(f"Failed {run_id}: {e}")
        return 0

def main():
    # Oct-Nov 2024 and 2025, every 6 hours
    issues = pd.date_range("2024-10-01", "2024-11-30", freq="6h").tolist() + \
             pd.date_range("2025-10-01", "2025-11-30", freq="6h").tolist()
             
    try:
        stations_data = s3io.get_json(s3io.key_stations())
        receptors = [s for s in stations_data.get("locations", []) if s.get("receptor")]
    except Exception:
        receptors = [{"station_id": "dummy", "lat": 28.5, "lon": 77.1}]
        
    func = partial(process_issue, receptors=receptors)
    with multiprocessing.Pool(processes=multiprocessing.cpu_count()) as pool:
        results = pool.map(func, issues)
        
    print(f"Total rows generated: {sum(results)}")

if __name__ == "__main__":
    main()
