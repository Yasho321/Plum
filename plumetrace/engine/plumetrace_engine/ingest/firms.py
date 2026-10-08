"""
OWNER    : Tejas
DUE      : D1 15:00
TASK     :
  FIRMS area CSV API (§6.2) for VIIRS_SNPP_NRT, VIIRS_NOAA20_NRT, VIIRS_NOAA21_NRT, DAY_RANGE=1; MAP_KEY from Secrets Manager. Drop confidence 'l'; de-dup on (round(lat,4), round(lon,4), acq_date, acq_time, satellite); add acq_ts (UTC). Write raw CSV + curated/fires/date=*/fires.parquet; keep a rolling 72 h window. Raise FirmsUnavailable on HTTP/timeout errors.
DONE WHEN: Today's Punjab fires are in curated/fires; re-running is idempotent.
GUIDE    : docs/team/TEJAS.md  |  brief: docs/PROJECT_BRIEF.md
STATUS   : TODO   (update to WIP / DONE in this header when you work on it)
"""
