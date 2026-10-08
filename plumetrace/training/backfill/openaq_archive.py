"""
OWNER    : Tejas
DUE      : D1 20:00
TASK     :
  Pull s3://openaq-data-archive/records/csv.gz/locationid=<id>/year=/month= for NCR PM2.5 locations, Oct–Nov 2024 & 2025, same QC -> curated/obs/date=*/pm25.parquet.
DONE WHEN: ≥ 15 NCR stations with ≥ 75 % completeness.
GUIDE    : docs/team/TEJAS.md  |  brief: docs/PROJECT_BRIEF.md
STATUS   : WIP
  Archive prefix/month helpers are pure and unit-tested (tests/engine/test_backfill.py).
  The pull reads the public archive bucket anonymously (no key) + reuses ingest/openaq.qc;
  the "≥15 stations ≥75%" check runs with network against the real archive (handoff #4).
"""
from __future__ import annotations

import gzip
import io
import logging

from plumetrace_engine.common import s3io
from plumetrace_engine.ingest import openaq

log = logging.getLogger(__name__)

ARCHIVE_BUCKET = "openaq-data-archive"
SEASON_MONTHS = (10, 11)  # Oct, Nov


def months(years=(2024, 2025)) -> list[tuple[int, int]]:
    return [(y, m) for y in years for m in SEASON_MONTHS]


def archive_prefix(location_id: int | str, year: int, month: int) -> str:
    return f"records/csv.gz/locationid={location_id}/year={year}/month={month:02d}/"


def _anon_s3():
    import boto3  # lazy
    from botocore import UNSIGNED
    from botocore.config import Config

    return boto3.client("s3", config=Config(signature_version=UNSIGNED))


def _read_station_months(location_id, name, lat, lon, s3) -> list[dict]:
    """Download every csv.gz for a station's season months and return obs rows."""
    rows: list[dict] = []
    for year, month in months():
        prefix = archive_prefix(location_id, year, month)
        resp = s3.list_objects_v2(Bucket=ARCHIVE_BUCKET, Prefix=prefix)
        for obj in resp.get("Contents", []):
            body = s3.get_object(Bucket=ARCHIVE_BUCKET, Key=obj["Key"])["Body"].read()
            text = gzip.decompress(body).decode("utf-8")
            rows.extend(_parse_archive_csv(text, location_id, name, lat, lon))
    return rows


def _parse_archive_csv(text: str, location_id, name, lat, lon) -> list[dict]:
    """Archive CSV -> obs rows for PM2.5 only (schema: ...parameter,value,datetime...)."""
    import csv

    out = []
    reader = csv.DictReader(io.StringIO(text))
    for r in reader:
        if (r.get("parameter") or "").lower() != "pm25":
            continue
        ts = r.get("datetime") or r.get("datetimeUtc")
        val = r.get("value")
        if ts is None or val in (None, ""):
            continue
        out.append(
            {"location_id": location_id, "name": name, "lat": lat, "lon": lon, "ts_utc": ts, "pm25": float(val)}
        )
    return out


def backfill(locations: list[dict] | None = None) -> list[str]:
    """
    Pull the season archive for the given NCR locations (defaults to the receptors in
    curated/stations.json), QC, and write curated/obs/date=*/pm25.parquet per IST-less
    UTC date. Returns the curated keys written.
    """
    import pandas as pd  # lazy

    if locations is None:
        stations = s3io.get_json(s3io.key_stations())["locations"]
        locations = [s for s in stations if s.get("receptor")]

    s3 = _anon_s3()
    rows: list[dict] = []
    for loc in locations:
        rows.extend(_read_station_months(loc["location_id"], loc["name"], loc["lat"], loc["lon"], s3))

    df = openaq.qc(pd.DataFrame(rows, columns=openaq.OBS_COLS)) if rows else pd.DataFrame(columns=openaq.OBS_COLS)
    if df.empty:
        return []
    df["date"] = df["ts_utc"].str.slice(0, 10)
    written = []
    for day, group in df.groupby("date"):
        key = s3io.key_curated_obs(str(day))
        s3io.put_parquet(key, group.drop(columns=["date"]).reset_index(drop=True))
        written.append(key)
    log.info("backfilled %d obs-days across %d stations", len(written), len(locations))
    return written
