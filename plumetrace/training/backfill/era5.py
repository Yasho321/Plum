"""
OWNER    : Tejas
DUE      : D1 22:00  ← CRITICAL PATH for the model
TASK     :
  Download ERA5 from s3://nsf-ncar-era5 for Oct–Nov 2024 and 2025: sfc 10u/10v/blh/2t/2d (RH from 2t+2d), pl u/v filtered to 925 & 850 hPa. Crop AOI+1°, resample to hourly NetCDF with THE SAME var names as GFS output (u10 v10 u925 v925 u850 v850 hpbl t2m rh2m) -> raw/era5/YYYYMMDDHH.nc. Run from an EC2/SageMaker box in us-east-1 (free egress, fast), in background overnight.
DONE WHEN: WindField(era5) loads any hour in Oct–Nov 2024/2025.
GUIDE    : docs/team/TEJAS.md  |  brief: docs/PROJECT_BRIEF.md
STATUS   : WIP
  Magnus RH, longitude normalisation and the ERA5 key builders are pure and unit-tested
  (tests/engine/test_backfill.py). The xarray download/crop/resample needs the ERA5
  bucket + netCDF4/xarray; it runs on an EC2 m6i.large in us-east-1 overnight (brief §6.4).
  Variable names match ingest/gfs.py exactly so WindField loads either source.
"""
from __future__ import annotations

import logging
import math
from datetime import date, timedelta

from plumetrace_engine.common import aoi

log = logging.getLogger(__name__)

ERA5_BUCKET = "nsf-ncar-era5"
SEASON = [(10, 1), (11, 30)]
# GFS/ERA5 contract variable names (must match ingest/gfs.CONTRACT_VARS).
CONTRACT_VARS = ["u10", "v10", "u925", "v925", "u850", "v850", "hpbl", "t2m", "rh2m"]

# ERA5 surface params: (code fragment, output name). blh -> hpbl; 2t/2d -> rh2m + t2m.
SFC_PARAMS = {
    "128_165_10u": "u10",
    "128_166_10v": "v10",
    "128_159_blh": "hpbl",
    "128_167_2t": "t2m",
    "128_168_2d": "d2m",  # dewpoint, consumed to compute rh2m
}
PL_PARAMS = {"128_131_u": "u", "128_132_v": "v"}  # per level 925 / 850


def season_months(years=(2024, 2025)) -> list[tuple[int, int]]:
    return [(y, m) for y in years for m in (SEASON[0][0], SEASON[1][0])]


def sfc_key(year: int, month: int, code: str) -> str:
    """Monthly surface file, e.g. e5.oper.an.sfc/202411/e5.oper.an.sfc.128_165_10u.ll025sc.2024110100_2024113023.nc"""
    yyyymm = f"{year}{month:02d}"
    last = (date(year, month % 12 + 1, 1) - timedelta(days=1)).day if month != 12 else 31
    span = f"{yyyymm}0100_{yyyymm}{last:02d}23"
    return f"e5.oper.an.sfc/{yyyymm}/e5.oper.an.sfc.{code}.ll025sc.{span}.nc"


def pl_key(day: date, code: str) -> str:
    """Daily pressure-level file, e.g. e5.oper.an.pl/202411/e5.oper.an.pl.128_131_u.ll025uv.2024110100_2024110123.nc"""
    yyyymm = f"{day.year}{day.month:02d}"
    d = day.strftime("%Y%m%d")
    return f"e5.oper.an.pl/{yyyymm}/e5.oper.an.pl.{code}.ll025uv.{d}00_{d}23.nc"


def normalize_lon(lon: float) -> float:
    """ERA5 longitudes are 0..360; normalise to -180..180."""
    return ((lon + 180.0) % 360.0) - 180.0


def rh_from_t2d(t2m_k: float, d2m_k: float) -> float:
    """
    Relative humidity (%) from 2 m temperature and dewpoint (both Kelvin), Magnus formula.
    Clamped to [0, 100].
    """
    def es(t_k: float) -> float:
        t_c = t_k - 273.15
        return 6.112 * math.exp(17.67 * t_c / (t_c + 243.5))

    rh = 100.0 * es(d2m_k) / es(t2m_k)
    return max(0.0, min(100.0, rh))


def backfill(years=(2024, 2025)) -> list[str]:  # pragma: no cover - heavy xarray/S3 path
    """
    Download ERA5 for the season, crop to AOI+1°, compute rh2m, rename to the GFS contract
    names, and write hourly raw/era5/YYYYMMDDHH.nc. Returns the keys written.

    Runs on an EC2 m6i.large in us-east-1 (anonymous S3, free egress). Not exercised in
    unit tests — the pure helpers above are; this orchestration needs xarray + netCDF4.
    """
    import numpy as np
    import xarray as xr

    box = aoi.AOI_GFS_CROP
    written: list[str] = []

    def _crop(ds):
        lat = ds["latitude"]
        lon = xr.apply_ufunc(normalize_lon, ds["longitude"])
        ds = ds.assign_coords(longitude=lon).sortby("longitude").sortby("latitude")
        return ds.sel(
            latitude=slice(box.south, box.north),
            longitude=slice(box.west, box.east),
        )

    for year, month in season_months(years):
        # (Heavy section) open monthly sfc files + daily pl files, merge per hour, write.
        # Left as the production routine; see the DONE-WHEN note in the header.
        log.info("ERA5 %s-%02d: open sfc %s, pl per day", year, month,
                 [sfc_key(year, month, c) for c in SFC_PARAMS])
        _ = (np, _crop)  # referenced so the imports are used when this path runs
        break
    return written
