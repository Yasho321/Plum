"""
OWNER    : Tejas
DUE      : D1 15:00
TASK     :
  FIRMS area CSV API (§6.2) for VIIRS_SNPP_NRT, VIIRS_NOAA20_NRT, VIIRS_NOAA21_NRT, DAY_RANGE=1; MAP_KEY from Secrets Manager. Drop confidence 'l'; de-dup on (round(lat,4), round(lon,4), acq_date, acq_time, satellite); add acq_ts (UTC). Write raw CSV + curated/fires/date=*/fires.parquet; keep a rolling 72 h window. Raise FirmsUnavailable on HTTP/timeout errors.
DONE WHEN: Today's Punjab fires are in curated/fires; re-running is idempotent.
GUIDE    : docs/team/TEJAS.md  |  brief: docs/PROJECT_BRIEF.md
STATUS   : WIP
  Pure parsing (confidence filter, acq_ts build, de-dup) is complete and unit-tested
  (tests/engine/test_ingest_parsers.py). The live fetch + curated write need the
  FIRMS MAP_KEY secret + network, so the "today's Punjab fires" check runs once the
  secret exists. Logic is idempotent (de-dup + overwrite by run_id/date key).
"""
from __future__ import annotations

import io
import logging
from datetime import datetime, timezone

from plumetrace_engine.common import aoi, s3io, timeutil

log = logging.getLogger(__name__)

FIRMS_BASE = "https://firms.modaps.eosdis.nasa.gov/api/area/csv"
FIRMS_SOURCES = ["VIIRS_SNPP_NRT", "VIIRS_NOAA20_NRT", "VIIRS_NOAA21_NRT"]

# Columns we keep from the FIRMS area CSV (brief §6.2).
KEEP_COLS = ["latitude", "longitude", "frp", "acq_date", "acq_time", "confidence", "daynight", "satellite"]
DEDUP_KEY = ["lat_r", "lon_r", "acq_date", "acq_time", "satellite"]


class FirmsUnavailable(Exception):
    """Raised on any FIRMS HTTP/timeout error so the pipeline can mark the run degraded."""


def firms_url(map_key: str, source: str, day_range: int = 1, date: str | None = None) -> str:
    bbox = aoi.firms_bbox_str()
    url = f"{FIRMS_BASE}/{map_key}/{source}/{bbox}/{day_range}"
    if date:
        url += f"/{date}"
    return url


def acq_ts(acq_date: str, acq_time) -> str:
    """Build a UTC ISO-8601 Z timestamp from acq_date ('YYYY-MM-DD') and acq_time (HHMM)."""
    hhmm = f"{int(acq_time):04d}"
    dt = datetime.strptime(f"{acq_date} {hhmm}", "%Y-%m-%d %H%M").replace(tzinfo=timezone.utc)
    return timeutil.iso_z(dt)


def parse_firms_csv(text: str, source: str | None = None):
    """
    Parse a FIRMS area CSV into a cleaned DataFrame: drop confidence 'l', add acq_ts
    (UTC), rounded lat/lon for de-dup, and a `source` column. Returns an empty frame
    with the right columns when the CSV has no rows.
    """
    import pandas as pd  # lazy

    df = pd.read_csv(io.StringIO(text))
    out_cols = KEEP_COLS + ["acq_ts", "source", "lat_r", "lon_r"]
    if df.empty:
        return pd.DataFrame(columns=out_cols)

    df = df[[c for c in KEEP_COLS if c in df.columns]].copy()
    # VIIRS confidence is categorical l/n/h — drop low (brief §6.2).
    df = df[df["confidence"].astype(str).str.lower() != "l"]
    df["acq_ts"] = [acq_ts(d, t) for d, t in zip(df["acq_date"], df["acq_time"])]
    df["source"] = source or ""
    df["lat_r"] = df["latitude"].round(4)
    df["lon_r"] = df["longitude"].round(4)
    return df.reset_index(drop=True)


def dedup(df):
    """De-dup on (round(lat,4), round(lon,4), acq_date, acq_time, satellite)."""
    if df.empty:
        return df
    return df.drop_duplicates(subset=DEDUP_KEY, keep="first").reset_index(drop=True)


def _fetch_source(source: str, map_key: str, day_range: int = 1, date: str | None = None) -> str:
    import requests  # lazy

    url = firms_url(map_key, source, day_range, date)
    try:
        resp = requests.get(url, timeout=60)
        resp.raise_for_status()
    except requests.RequestException as e:  # pragma: no cover - network path
        raise FirmsUnavailable(f"FIRMS fetch failed for {source}: {e}") from e
    text = resp.text
    if text.lstrip().lower().startswith(("invalid", "error")):  # FIRMS returns text errors with 200
        raise FirmsUnavailable(f"FIRMS returned an error for {source}: {text[:120]!r}")
    return text


def ingest(map_key: str, day_range: int = 1, date: str | None = None) -> str:
    """
    Fetch all VIIRS sources, clean + de-dup, crop to the AOI, and write
    curated/fires/date=<YYYY-MM-DD>/fires.parquet. Returns the curated key.
    Idempotent: the same date key is overwritten.
    """
    import pandas as pd  # lazy

    day = date or datetime.now(timezone.utc).strftime("%Y-%m-%d")
    fetch_ts = timeutil.iso_z(datetime.now(timezone.utc)).replace(":", "")
    frames = []
    for source in FIRMS_SOURCES:
        text = _fetch_source(source, map_key, day_range, date)
        s3io.put_text(s3io.key_raw_firms(day, source, fetch_ts), text)
        frames.append(parse_firms_csv(text, source))

    df = dedup(pd.concat(frames, ignore_index=True)) if frames else pd.DataFrame()
    if not df.empty:
        df = df[[aoi.in_aoi(la, lo) for la, lo in zip(df["latitude"], df["longitude"])]].reset_index(drop=True)
    key = s3io.key_curated_fires(day)
    s3io.put_parquet(key, df)
    log.info("curated %d fires -> %s", len(df), key)
    return key
