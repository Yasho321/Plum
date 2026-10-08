"""
OWNER    : Tejas
DUE      : D1 16:00
TASK     :
  OpenAQ v3 (§6.5): locations in AOI with PM2.5 (VERIFY parameter id), last 72 h hourly per sensor, QC (drop <0 or >1500, stuck ≥6 h). Write curated/obs/date=*/pm25.parquet [location_id, name, lat, lon, ts_utc, pm25] and curated/stations/stations.json (receptors = NCR box). If OpenAQ is empty for Delhi, log loudly and post in HANDOFFS (fallback data.gov.in CPCB feed, VERIFY).
DONE WHEN: ≥ 20 NCR receptor stations with recent data.
GUIDE    : docs/team/TEJAS.md  |  brief: docs/PROJECT_BRIEF.md
STATUS   : TODO   (update to WIP / DONE in this header when you work on it)
"""
