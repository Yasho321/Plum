#!/usr/bin/env bash
# OWNER    : Yasho1
# DUE      : D2 12:00
# TASK     :
#   Run the whole engine locally with PT_LOCAL=1 for a given run_id: ingest -> trajectories -> attribution -> forecast -> gridding -> summarize.
# DONE WHEN: -
# GUIDE    : docs/team/YASHO1.md  |  brief: docs/PROJECT_BRIEF.md
# STATUS   : DONE

if [ -z "$1" ]; then
    echo "Usage: ./scripts/run_engine_local.sh <run_id>"
    exit 1
fi

export PT_LOCAL=1
export PYTHONPATH="engine;contracts/python"

./.venv/Scripts/python.exe -c "
import os
import sys
import pandas as pd
from datetime import datetime, timezone
from plumetrace_engine.common import s3io
from plumetrace_engine.config import CONFIG
from plumetrace_engine.trajectories.winds import constant_wind_field
from plumetrace_engine.trajectories.ensemble import run_trajectories
from plumetrace_engine.features.fire_load import compute_fire_load, to_fires_geojson
from plumetrace_engine.features.build_features import build_features
from plumetrace_engine.model.infer import run_forecast
from plumetrace_engine.gridding.idw_h3 import run_gridding
from plumetrace_engine.publish.summarize import run_summarize

run_id = sys.argv[1]
print(f'=== Starting local engine run for {run_id} ===')

try:
    stations = s3io.get_json(s3io.key_stations())['locations']
    receptors = [s for s in stations if s.get('receptor')]
except Exception as e:
    print('Failed to load stations:', e)
    receptors = []

try:
    winds = constant_wind_field(2.0, 2.0, start=run_id.split("T")[0])
except Exception:
    winds = None

try:
    print('1. Trajectories')
    tset = run_trajectories(run_id, receptors, winds)
except Exception as e:
    print('Trajectories failed:', e)
    tset = None

try:
    print('2. Fire Load & Features')
    date_str = run_id.split('T')[0]
    fires = s3io.get_parquet(s3io.key_curated_fires(date_str))
    fl_df = compute_fire_load(tset, fires)
    
    # Write fires_48h.geojson
    s3io.put_json(s3io.key_outputs_fires_48h(run_id), to_fires_geojson(fires))

    obs = s3io.get_parquet(s3io.key_curated_obs(date_str))
    feat_df = build_features(receptors, obs, fl_df, winds, run_id)
    s3io.put_parquet(s3io.key_features(run_id), feat_df)
except Exception as e:
    print('Fire Load / Features failed:', e)

try:
    print('3. Forecast & Attribution')
    stats = run_forecast(run_id)
    print(stats)
except Exception as e:
    print('Forecast failed:', e)

try:
    print('4. Gridding')
    grid_stats = run_gridding(run_id)
    print(grid_stats)
except Exception as e:
    print('Gridding failed:', e)

try:
    print('5. Summarize')
    summary = run_summarize(run_id, degraded=[])
    print('Summary completed')
except Exception as e:
    print('Summarize failed:', e)

print('=== Done ===')
" "$1"
