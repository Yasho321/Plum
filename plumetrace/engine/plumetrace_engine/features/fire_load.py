"""
OWNER    : Yasho1
DUE      : D1 22:00
TASK     :
  §10.2: project fires + trajectory points to a local equal-distance projection, cKDTree query_ball_point(50 km); w_space gaussian σ=15 km, w_time |Δt|≤12 h, w_age exp(-(T-t_k)/τ). Returns FL[ens] and FL_d per district. Future fires: persistence of last-24 h fires scaled 0.8/day. Also write outputs/run=<run_id>/fires_48h.geojson (lon,lat,frp,acq_ts,district) for the map + reports.
DONE WHEN: tests/engine/test_fire_load.py passes (0 with no fires, grows as fire nears).
GUIDE    : docs/team/YASHO1.md  |  brief: docs/PROJECT_BRIEF.md
STATUS   : TODO   (update to WIP / DONE in this header when you work on it)
"""
