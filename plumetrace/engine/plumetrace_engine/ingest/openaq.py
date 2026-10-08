"""
OWNER    : Tejas
DUE      : D1 16:00
TASK     :
  OpenAQ v3 (§6.5): locations in AOI with PM2.5 (VERIFY parameter id), last 72 h hourly per sensor, QC (drop <0 or >1500, stuck ≥6 h). Write curated/obs/date=*/pm25.parquet [location_id, name, lat, lon, ts_utc, pm25] and curated/stations/stations.json (receptors = NCR box). If OpenAQ is empty for Delhi, log loudly and post in HANDOFFS (fallback data.gov.in CPCB feed, VERIFY).
DONE WHEN: ≥ 20 NCR receptor stations with recent data.
GUIDE    : docs/team/TEJAS.md  |  brief: docs/PROJECT_BRIEF.md
STATUS   : WIP
  QC (value range + stuck-sensor) and receptor classification are complete and
  unit-tested (tests/engine/test_ingest_parsers.py). The live locations/sensors
  fetch needs the OpenAQ key + network; the "≥20 NCR receptor stations" check and
  the coverage/CPCB-fallback decision run once the key exists.
"""
from __future__ import annotations

import logging
from datetime import datetime, timezone

from plumetrace_engine.common import aoi, s3io

log = logging.getLogger(__name__)

OPENAQ_BASE = "https://api.openaq.org/v3"
PM25_PARAMETER_ID = 2  # VERIFY against /v3/parameters
OBS_COLS = ["location_id", "name", "lat", "lon", "ts_utc", "pm25"]

PM25_MIN, PM25_MAX = 0.0, 1500.0
STUCK_RUN_HOURS = 6


def qc_values(df):
    """Drop readings outside [0, 1500] µg/m³ (brief §6.5)."""
    import pandas as pd  # noqa: F401  (ensures pandas is importable in this path)

    return df[(df["pm25"] >= PM25_MIN) & (df["pm25"] <= PM25_MAX)].reset_index(drop=True)


def drop_stuck(df, max_run: int = STUCK_RUN_HOURS):
    """
    Drop rows from a sensor that reports the identical value for ``max_run`` or more
    consecutive hours (a stuck sensor, brief §6.5). Works per location_id, ordered by ts.
    """
    if df.empty:
        return df
    df = df.sort_values(["location_id", "ts_utc"]).reset_index(drop=True)
    keep = []
    for _loc, g in df.groupby("location_id", sort=False):
        vals = g["pm25"].tolist()
        idx = g.index.tolist()
        run_start = 0
        for i in range(1, len(vals) + 1):
            if i == len(vals) or vals[i] != vals[run_start]:
                run_len = i - run_start
                if run_len < max_run:
                    keep.extend(idx[run_start:i])
                run_start = i
    return df.loc[sorted(keep)].reset_index(drop=True)


def qc(df):
    """Full QC: value range then stuck-sensor removal."""
    return drop_stuck(qc_values(df))


def is_receptor(lat: float, lon: float) -> bool:
    return aoi.is_ncr_receptor(lat, lon)


def parse_locations(payload: dict):
    """
    From /v3/locations, yield dicts {location_id, name, lat, lon, sensor_ids} for
    locations inside the AOI that have a PM2.5 sensor.
    """
    out = []
    for loc in payload.get("results", []):
        coords = loc.get("coordinates") or {}
        lat, lon = coords.get("latitude"), coords.get("longitude")
        if lat is None or lon is None or not aoi.in_aoi(lat, lon):
            continue
        pm_sensors = [
            s["id"]
            for s in loc.get("sensors", [])
            if (s.get("parameter") or {}).get("id") == PM25_PARAMETER_ID
            or (s.get("parameter") or {}).get("name") == "pm25"
        ]
        if not pm_sensors:
            continue
        out.append(
            {
                "location_id": loc["id"],
                "name": loc.get("name", str(loc["id"])),
                "lat": lat,
                "lon": lon,
                "sensor_ids": pm_sensors,
            }
        )
    return out


def parse_sensor_hours(payload: dict, location_id, name, lat, lon):
    """From /v3/sensors/{id}/hours, return rows [location_id, name, lat, lon, ts_utc, pm25]."""
    rows = []
    for r in payload.get("results", []):
        value = r.get("value")
        period = r.get("period") or {}
        ts = (period.get("datetimeFrom") or {}).get("utc") or r.get("datetime", {}).get("utc")
        if value is None or ts is None:
            continue
        rows.append(
            {"location_id": location_id, "name": name, "lat": lat, "lon": lon, "ts_utc": ts, "pm25": float(value)}
        )
    return rows


def build_stations_json(locations) -> dict:
    """curated/stations/stations.json — every AOI PM2.5 location, receptor flag set (NCR box)."""
    return {
        "generated_at": datetime.now(timezone.utc).isoformat().replace("+00:00", "Z"),
        "locations": [
            {
                "location_id": loc["location_id"],
                "name": loc["name"],
                "lat": loc["lat"],
                "lon": loc["lon"],
                "receptor": is_receptor(loc["lat"], loc["lon"]),
            }
            for loc in locations
        ],
    }


def _headers(api_key: str) -> dict:
    return {"X-API-Key": api_key}


def _get(url: str, api_key: str, params: dict | None = None):
    import requests  # lazy

    resp = requests.get(url, headers=_headers(api_key), params=params or {}, timeout=60)
    resp.raise_for_status()
    return resp.json()


def ingest(api_key: str, hours: int = 72, date: str | None = None) -> dict:
    """
    Fetch AOI PM2.5 locations + their last ``hours`` hourly values, QC, and write
    curated/obs/date=*/pm25.parquet and curated/stations/stations.json.
    Returns {"obs_key", "stations_key", "n_stations", "n_receptors"}.
    """
    import pandas as pd  # lazy

    day = date or datetime.now(timezone.utc).strftime("%Y-%m-%d")
    loc_payload = _get(
        f"{OPENAQ_BASE}/locations",
        api_key,
        params={"bbox": aoi.openaq_bbox_str(), "parameters_id": PM25_PARAMETER_ID, "limit": 1000},
    )
    locations = parse_locations(loc_payload)

    rows = []
    for loc in locations:
        for sensor_id in loc["sensor_ids"]:
            payload = _get(f"{OPENAQ_BASE}/sensors/{sensor_id}/hours", api_key, params={"limit": hours})
            rows.extend(parse_sensor_hours(payload, loc["location_id"], loc["name"], loc["lat"], loc["lon"]))

    df = qc(pd.DataFrame(rows, columns=OBS_COLS)) if rows else pd.DataFrame(columns=OBS_COLS)
    obs_key = s3io.key_curated_obs(day)
    s3io.put_parquet(obs_key, df)

    stations = build_stations_json(locations)
    stations_key = s3io.key_stations()
    s3io.put_json(stations_key, stations, indent=2)

    n_receptors = sum(1 for s in stations["locations"] if s["receptor"])
    if n_receptors < 20:
        log.warning(
            "Only %d NCR receptor stations with data (<20). Consider the data.gov.in CPCB "
            "fallback (brief §6.5) and add a HANDOFFS note.",
            n_receptors,
        )
    return {"obs_key": obs_key, "stations_key": stations_key, "n_stations": len(locations), "n_receptors": n_receptors}
