"""
OWNER    : Yasho1
DUE      : D1 16:00
TASK     :
  Exact §10.1 algorithm, vectorised over N parcels: 48 hourly backward steps, lat -= v*3600/111320, lon -= u*3600/(111320*cos(lat)); mask parcels that leave AOI+1°. Returns arrays lat[N,49], lon[N,49], t[49], alive[N,49].
DONE WHEN: tests/engine/test_trajectory.py passes (constant wind -> expected distance).
GUIDE    : docs/team/YASHO1.md  |  brief: docs/PROJECT_BRIEF.md
STATUS   : TODO   (update to WIP / DONE in this header when you work on it)
"""
