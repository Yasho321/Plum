"""
OWNER    : Tejas
DUE      : D2 12:00
TASK     :
  Thin Lambda entrypoints, one per Step Functions state: resolve_run, ingest_firms, ingest_gfs_hour, ingest_openaq, trajectories, attribution, forecast, gridding, summarize, publish, verify. Each takes/returns {run_id, degraded[]} and calls Yasho1's / Tejas's module functions — NO science logic here. Docker CMD selects the handler.
DONE WHEN: Each handler runs locally: `python -m plumetrace_engine.handlers <name> '{"run_id":...}'`.
GUIDE    : docs/team/TEJAS.md  |  brief: docs/PROJECT_BRIEF.md
STATUS   : TODO   (update to WIP / DONE in this header when you work on it)
"""
