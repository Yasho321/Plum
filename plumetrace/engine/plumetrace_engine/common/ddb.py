"""
OWNER    : Tejas
DUE      : D1 18:00
TASK     :
  Batch writers (BatchWriteItem, 25 per call, retry unprocessed) for Forecast, StationForecast, Attribution; adds ttl = now+7d; validates each item with plumetrace_contracts pydantic models before writing.
DONE WHEN: Writing 50k Forecast items takes < 60 s.
GUIDE    : docs/team/TEJAS.md  |  brief: docs/PROJECT_BRIEF.md
STATUS   : TODO   (update to WIP / DONE in this header when you work on it)
"""
