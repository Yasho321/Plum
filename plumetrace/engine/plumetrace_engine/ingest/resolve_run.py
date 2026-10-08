"""
OWNER    : Tejas
DUE      : D1 14:00
TASK     :
  resolve_run(now) -> {run_id, cycle_dt}: newest GFS cycle in s3://noaa-gfs-bdp-pds whose f072 .idx exists (anonymous boto3). Accept manual override {run_id}.
DONE WHEN: Returns yesterday-18Z-ish when called at 03:00 UTC.
GUIDE    : docs/team/TEJAS.md  |  brief: docs/PROJECT_BRIEF.md
STATUS   : TODO   (update to WIP / DONE in this header when you work on it)
"""
