"""
OWNER    : Khare
DUE      : D1 14:00  ← interface Yasho2 depends on
TASK     :
  Pure functions (§13.2), no I/O:
    segment_dose_ug(c_pm25, minutes, ve=1.4, traffic_mult=1.3) -> float
    route_dose_ug(stops, conc: ConcLookup, start_utc) -> float   # stops = planned_stops
    daily_budget_ug(shift_hours, budget_multiplier=1.0, standard=60, ve=1.4) -> float
    dose_pct(dose_ug, budget_ug) -> float
  Constants from env with defaults (VE, traffic mult).
DONE WHEN: tests/fleet/test_dose.py hand-calc passes.
GUIDE    : docs/team/KHARE.md  |  brief: docs/PROJECT_BRIEF.md
STATUS   : TODO   (update to WIP / DONE in this header when you work on it)
"""
