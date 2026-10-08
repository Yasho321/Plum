"""
OWNER    : Yasho1
DUE      : D2 04:00
TASK     :
  Issue times every 6 h over the backfill window; for each: ERA5 WindField -> ensemble trajectories -> fire_load -> build_features (same code as live) -> features/training/part-*.parquet. Parallelise with multiprocessing.
DONE WHEN: Training table ~ (stations x 4 issues/day x 122 days x 73 leads) rows.
GUIDE    : docs/team/YASHO1.md  |  brief: docs/PROJECT_BRIEF.md
STATUS   : TODO   (update to WIP / DONE in this header when you work on it)
"""
