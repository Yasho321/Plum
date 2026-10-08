"""
OWNER    : Khare
DUE      : D1 18:00
TASK     :
  ~600 orders/day with IST peaks 8–10, 13–14, 19–22; pickup = dark store h3, drop h3 within ~6 km; window [created, +45 min]; 30 % flexible (3 h). Baseline plan: greedy nearest-free-rider assignment -> Shifts.planned_stops [{order_id, h3, eta}], plan_version 1. Deterministic seed.
DONE WHEN: Shifts for tomorrow exist; replanner has an input.
GUIDE    : docs/team/KHARE.md  |  brief: docs/PROJECT_BRIEF.md
STATUS   : TODO   (update to WIP / DONE in this header when you work on it)
"""
