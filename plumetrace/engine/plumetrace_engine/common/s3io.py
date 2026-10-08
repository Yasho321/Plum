"""
OWNER    : Tejas
DUE      : D1 13:00
TASK     :
  S3 I/O helpers + key builders for EVERY path in brief §8.2 (key_raw_gfs(run_id, fff), key_curated_fires(date), key_outputs(run_id, name), ...).
  put_json/get_json/put_parquet/get_parquet/put_netcdf/open_netcdf/presign.
  LOCAL MODE: if PT_LOCAL=1, read/write ./.local-s3/<key> instead of S3 — lets Yasho1 & Khare run everything offline.
DONE WHEN: Yasho1 never writes an S3 key string by hand.
GUIDE    : docs/team/TEJAS.md  |  brief: docs/PROJECT_BRIEF.md
STATUS   : TODO   (update to WIP / DONE in this header when you work on it)
"""
