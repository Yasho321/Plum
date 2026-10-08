"""
OWNER    : Khare
DUE      : D2 16:00
TASK     :
  (a) forecast.published -> for tomorrow's Shifts compute forecast_dose_ug per rider; if any > 100 % budget invoke replanner Lambda async with {fleet_id, date, run_id}. (b) gps handler: IoT rule payload -> nowcast concentration -> accumulate Shifts.actual_dose_ug. Only this role reads RiderHealth.
DONE WHEN: AC2 fleet half.
GUIDE    : docs/team/KHARE.md  |  brief: docs/PROJECT_BRIEF.md
STATUS   : TODO   (update to WIP / DONE in this header when you work on it)
"""
