"""
OWNER    : Yasho2
DUE      : D2 20:00
TASK     :
  OR-Tools CP-SAT per §13.3: decision vars rider x slot (30-min slots) per order, start shift for flexible orders within window. Hard: non-flexible on time, shift ≤ 10 h, dose ≤ 100 % (soft w/ big penalty). Objective: max_rider_dose_pct*1000 + total_dose + 2*extra_minutes. Dose coefficients precomputed via fleet/dose + ConcLookup. 30 s limit, 8 workers.
DONE WHEN: AC7: 50 riders solved < 60 s end-to-end.
GUIDE    : docs/team/YASHO2.md  |  brief: docs/PROJECT_BRIEF.md
STATUS   : TODO   (update to WIP / DONE in this header when you work on it)
"""
