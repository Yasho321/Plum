"""
OWNER    : Khare
DUE      : D1 18:00
TASK     :
  ConcLookup(run_id).pm25(h3_res7, hour_utc) -> p50 µg/m³ from Forecast table (batch-loaded once per run into a dict). Null cell -> nearest non-null ring (h3.grid_disk up to k=3) else NCR mean. Mock mode reads contracts/mocks/forecast_h3.geojson.
DONE WHEN: Used by dose engine AND Yasho2's replanner (shared interface — don't change the signature without telling Yasho2).
GUIDE    : docs/team/KHARE.md  |  brief: docs/PROJECT_BRIEF.md
STATUS   : TODO   (update to WIP / DONE in this header when you work on it)
"""
