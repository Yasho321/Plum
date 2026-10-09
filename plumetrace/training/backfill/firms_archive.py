"""
OWNER    : Tejas
DUE      : D1 20:00
TASK     :
  FIRMS area API with date param (≤5 days per call) for Oct 1–Nov 30 2024 & 2025 (VIIRS SNPP + NOAA20; NOAA21 from 2024), same QC/de-dup as ingest/firms.py -> curated/fires/date=*/fires.parquet. Respect rate limits (sleep, retry).
DONE WHEN: 122 days of fires exist in curated/fires.
GUIDE    : docs/team/TEJAS.md  |  brief: docs/PROJECT_BRIEF.md
STATUS   : WIP
  Season date-chunking is pure and unit-tested (tests/engine/test_backfill.py). The live
  pull reuses ingest/firms.py parsing and needs the FIRMS MAP_KEY + network; the
  "122 days in curated/fires" check runs once the key exists (handoff #4, Yasho1 training).
"""
from __future__ import annotations

import logging
import time
from datetime import date, timedelta

from plumetrace_engine.common import aoi, s3io
from plumetrace_engine.ingest import firms

log = logging.getLogger(__name__)

# NOAA21 only exists from 2024; SNPP + NOAA20 cover both seasons.
SOURCES_BY_YEAR = {
    2024: ["VIIRS_SNPP_NRT", "VIIRS_NOAA20_NRT", "VIIRS_NOAA21_NRT"],
    2025: ["VIIRS_SNPP_NRT", "VIIRS_NOAA20_NRT", "VIIRS_NOAA21_NRT"],
}
SEASON = [(10, 1), (11, 30)]  # Oct 1 .. Nov 30 inclusive


def season_days(year: int) -> list[date]:
    start = date(year, SEASON[0][0], SEASON[0][1])
    end = date(year, SEASON[1][0], SEASON[1][1])
    return [start + timedelta(days=i) for i in range((end - start).days + 1)]


def season_chunks(year: int, max_range: int = 5) -> list[tuple[str, int]]:
    """
    (start_date_str, day_range) chunks covering the whole season, each ≤ max_range days.
    The FIRMS area API returns DAY_RANGE days starting at the given date.
    """
    days = season_days(year)
    chunks: list[tuple[str, int]] = []
    i = 0
    while i < len(days):
        n = min(max_range, len(days) - i)
        chunks.append((days[i].isoformat(), n))
        i += n
    return chunks


def backfill(map_key: str, years=(2024, 2025), sleep_s: float = 2.0) -> list[str]:
    """
    Pull the full season for each year, de-dup, crop to AOI, and write one
    curated/fires/date=*/fires.parquet per acq_date. Returns the curated keys written.
    """
    import pandas as pd  # lazy

    written: list[str] = []
    frames: list["pd.DataFrame"] = []
    for year in years:
        for start, day_range in season_chunks(year):
            for source in SOURCES_BY_YEAR[year]:
                try:
                    text = firms._fetch_source(source, map_key, day_range=day_range, date=start)
                except firms.FirmsUnavailable as e:
                    log.warning("skip %s %s (+%dd): %s", source, start, day_range, e)
                    continue
                frames.append(firms.parse_firms_csv(text, source))
                time.sleep(sleep_s)  # FIRMS rate limit per key per 10 min

    if not frames:
        return written
    allfires = firms.dedup(pd.concat(frames, ignore_index=True))
    allfires = allfires[[aoi.in_aoi(la, lo) for la, lo in zip(allfires["latitude"], allfires["longitude"])]]
    for day, group in allfires.groupby("acq_date"):
        key = s3io.key_curated_fires(str(day))
        s3io.put_parquet(key, group.reset_index(drop=True))
        written.append(key)
    log.info("backfilled %d fire-days", len(written))
    return written
