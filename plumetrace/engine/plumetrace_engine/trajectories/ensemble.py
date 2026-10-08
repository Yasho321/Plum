"""
OWNER    : Yasho1
DUE      : D1 20:00
TASK     :
  9-member ensemble per (receptor, T): 3x3 start offsets ±0.1° + per-member speed (±10 %) / direction (±15°) perturbation, seed from config. Run all receptors x valid hours 0..72 in one vectorised batch. Write outputs/run=<run_id>/trajectories.geojson (central member, LineString [lon,lat] + timestamps[] epoch s, props station_id, valid_hour) for the TripsLayer.
DONE WHEN: ≈ 25 stations x 73 h x 9 members finishes in < 2 min on Lambda.
GUIDE    : docs/team/YASHO1.md  |  brief: docs/PROJECT_BRIEF.md
STATUS   : TODO   (update to WIP / DONE in this header when you work on it)
"""
