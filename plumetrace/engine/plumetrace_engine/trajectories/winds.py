"""
OWNER    : Yasho1
DUE      : D1 15:00
TASK     :
  WindField: loads a stack of NetCDF hours (GFS run, earlier-cycle analyses for past hours, or ERA5 for training — all share the same var names)
  into one xarray Dataset (time, lat, lon). uv(lat[], lon[], t[]) -> (u[], v[]) vectorised: bilinear in space, linear in time,
  transport rule from config (mean of 925 hPa & 10 m; 10 m only where hpbl < 300 m). Also hpbl/t2m/rh2m/wind10 samplers for features.
DONE WHEN: Constant-field test returns the constant; interpolation test passes.
GUIDE    : docs/team/YASHO1.md  |  brief: docs/PROJECT_BRIEF.md
STATUS   : TODO   (update to WIP / DONE in this header when you work on it)
"""
