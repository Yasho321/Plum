"""
OWNER    : Tejas
DUE      : D1 13:00  ← CRITICAL PATH (Yasho1 blocked until a sample exists)
TASK     :
  Partial GFS download (§6.3): parse {file}.idx, HTTP Range-fetch only the 9 records
  (UGRD/VGRD 10 m, 925 mb, 850 mb, HPBL surface, TMP 2 m, RH 2 m), decode with cfgrib, crop to AOI + 1°,
  write raw/gfs/run=<run_id>/f<FFF>.nc with variables EXACTLY: u10 v10 u925 v925 u850 v850 hpbl t2m rh2m, dims (latitude, longitude), coord `valid_time`.
  fetch_forecast_hour(run_id, fff) is the Map-state unit of work. Also script mode: `python -m plumetrace_engine.ingest.gfs --run latest --hours 0-72 --local`.
DONE WHEN: A sample run f000..f072 sits in .local-s3 and on S3 by D1 13:00 and Yasho1 confirms the variable names.
GUIDE    : docs/team/TEJAS.md  |  brief: docs/PROJECT_BRIEF.md
STATUS   : TODO   (update to WIP / DONE in this header when you work on it)
"""
