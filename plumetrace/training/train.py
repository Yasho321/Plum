"""
OWNER    : Yasho1
DUE      : D2 10:00
TASK     :
  LightGBM quantile models alpha 0.1/0.5/0.9, station_id categorical. Split: train 2024 + Oct 2025, validate Nov 2025, NEVER shuffle across time. Early stopping on validation. Save models/lightgbm/<version>/{q10,q50,q90}.txt + metadata.json (features, data ranges, metrics, git sha).
DONE WHEN: Artefacts in S3; infer.py picks them up.
GUIDE    : docs/team/YASHO1.md  |  brief: docs/PROJECT_BRIEF.md
STATUS   : TODO   (update to WIP / DONE in this header when you work on it)
"""
