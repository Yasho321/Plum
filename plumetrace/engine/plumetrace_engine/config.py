"""
OWNER    : Yasho1
DUE      : D1 12:00
TASK     :
  Every ASSUMPTION parameter from brief §10/§12/§13 in one frozen dataclass, overridable by env var PT_<NAME>:
  AOI (73.5,27.5,78.0,32.7), NCR receptor box (76.8–77.6, 28.3–28.95), H3 res 7/5, back-traj hours 48, transport rule (mean 925hPa+10m; 10m only if HPBL<300),
  ensemble offsets ±0.1° 3x3, perturb ±10 % speed ±15° dir, seed 42, σ=15 km, cutoff 50 km, w_time 12 h, τ=24 h, fire persistence 0.8/day,
  IDW power 2 / 6 nearest / 25 km, gov thresholds (fire share 0.20, max pm25 250), severe=250.
DONE WHEN: No magic numbers anywhere else in engine/.
GUIDE    : docs/team/YASHO1.md  |  brief: docs/PROJECT_BRIEF.md
STATUS   : TODO   (update to WIP / DONE in this header when you work on it)
"""
