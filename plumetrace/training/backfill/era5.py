"""
OWNER    : Tejas
DUE      : D1 22:00  ← CRITICAL PATH for the model
TASK     :
  Download ERA5 from s3://nsf-ncar-era5 for Oct–Nov 2024 and 2025: sfc 10u/10v/blh/2t/2d (RH from 2t+2d), pl u/v filtered to 925 & 850 hPa. Crop AOI+1°, resample to hourly NetCDF with THE SAME var names as GFS output (u10 v10 u925 v925 u850 v850 hpbl t2m rh2m) -> raw/era5/YYYYMMDDHH.nc. Run from an EC2/SageMaker box in us-east-1 (free egress, fast), in background overnight.
DONE WHEN: WindField(era5) loads any hour in Oct–Nov 2024/2025.
GUIDE    : docs/team/TEJAS.md  |  brief: docs/PROJECT_BRIEF.md
STATUS   : TODO   (update to WIP / DONE in this header when you work on it)
"""
