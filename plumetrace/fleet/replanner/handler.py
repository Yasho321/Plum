"""
OWNER    : Yasho2
DUE      : D2 20:00
TASK     :
  Input/Output = contracts draftShiftPlan. Load Shifts + Riders (+ budget multipliers via dose service, never raw conditions), solve (CP-SAT, fallback greedy on timeout/infeasible), build per-rider diff, createDraft('shift_plan', {...}). Return {action_id, riders_changed, dose_reduction_pct:{fleet, worst_rider}, extra_minutes}.
DONE WHEN: Demo line '−34 % worst-rider exposure, +6 min average' comes from real output.
GUIDE    : docs/team/YASHO2.md  |  brief: docs/PROJECT_BRIEF.md
STATUS   : TODO   (update to WIP / DONE in this header when you work on it)
"""
