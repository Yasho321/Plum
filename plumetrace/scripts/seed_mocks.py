"""
OWNER    : Yasho2
DUE      : D1 16:00
TASK     :
  Load contracts/mocks into the dev DynamoDB tables + S3 outputs/run=mock/ so real (non-MOCK_MODE) API code can be tested before the engine runs.
DONE WHEN: -
GUIDE    : docs/team/YASHO2.md  |  brief: docs/PROJECT_BRIEF.md
STATUS   : DONE

Usage:
  # offline (no AWS): writes ./.local-s3/{s3,ddb}
  PT_LOCAL=1 python scripts/seed_mocks.py
  # real dev tables/bucket (needs AWS creds + the env table/bucket names)
  python scripts/seed_mocks.py
"""
from __future__ import annotations

import json
import os
import time
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
MOCKS = ROOT / "contracts" / "mocks"
LOCAL = ROOT / ".local-s3"

RUN_ID = "2026-10-09T00Z"
TTL = int(time.time()) + 7 * 24 * 3600


def _load(name: str):
    return json.loads((MOCKS / name).read_text(encoding="utf-8"))


# ------------------------------- build items -------------------------------
def forecast_items() -> list[dict]:
    fc = _load("forecast_h3.geojson")
    items = []
    for f in fc["features"]:
        p = f["properties"]
        items.append({
            "pk": f"h3#{p['h3']}",
            "sk": f"{p['run_id']}#{p['valid_hour']}",
            "gsi1sk": f"{p['valid_hour']}#{p['h3']}",   # GSI byRun sort key (D-15)
            "run_id": p["run_id"], "valid_hour": p["valid_hour"], "h3": p["h3"],
            "pm25": p["pm25"], "pm25_p10": p["pm25_p10"], "pm25_p90": p["pm25_p90"],
            "fire_share": p["fire_share"], "fire_share_p10": p["fire_share_p10"], "fire_share_p90": p["fire_share_p90"],
            "top_sources": p["top_sources"], "hpbl_m": p["hpbl_m"], "lead_h": p["lead_h"], "ttl": TTL,
        })
    return items


def station_items() -> list[dict]:
    bundle = _load("station_forecast.json")
    items = []
    for sid, series in bundle.items():
        for pt in series["series"]:
            items.append({
                "pk": f"station#{sid}", "sk": f"{series['run_id']}#{pt['valid_hour']}",
                "run_id": series["run_id"], "valid_hour": pt["valid_hour"], "station_id": sid,
                "station_name": series["station_name"], "lat": series["lat"], "lon": series["lon"],
                "issued_at": series["issued_at"],
                "pm25_p10": pt["pm25_p10"], "pm25_p50": pt["pm25_p50"], "pm25_p90": pt["pm25_p90"],
                "fire_share_p10": pt["fire_share_p10"], "fire_share_p50": pt["fire_share_p50"],
                "fire_share_p90": pt["fire_share_p90"], "obs_pm25": pt["obs_pm25"], "lead_h": pt["lead_h"],
            })
    return items


def attribution_items() -> list[dict]:
    a = _load("attribution.json")
    return [{
        "pk": f"date#{a['date']}", "sk": f"district#{d['district']}", "date": a["date"], "district": d["district"],
        "share_p10": d["share_p10"], "share_p50": d["share_p50"], "share_p90": d["share_p90"],
        "fire_count": d["fire_count"], "frp_sum_mw": d["frp_sum_mw"], "trend_7d": d["trend_7d"],
        "receptor_stations": d["receptor_stations"],
    } for d in a["districts"]]


def action_items() -> list[dict]:
    return _load("actions.json")["actions"]


def rider_and_shift_items() -> tuple[list[dict], list[dict]]:
    """Synthesize Riders + Shifts from the fleet exposure mock so the real
    /fleet/:id/exposure endpoint returns the same story."""
    fe = _load("fleet_exposure.json")
    riders, shifts = [], []
    for r in fe["riders"]:
        riders.append({
            "pk": f"rider#{r['rider_id']}", "rider_id": r["rider_id"], "name": r["name"],
            "home_h3": r["home_h3"], "vehicle": "2w", "dose_budget_ug": r["budget_ug"],
            "consent_health": False, "consent_ts": None,
        })
        shifts.append({
            "pk": f"fleet#{fe['fleet_id']}#date#{fe['date']}", "sk": f"rider#{r['rider_id']}",
            "fleet_id": fe["fleet_id"], "date": fe["date"], "rider_id": r["rider_id"],
            "planned_stops": [], "forecast_dose_ug": r["forecast_dose_ug"],
            "actual_dose_ug": r["actual_dose_ug"], "plan_version": 0,
        })
    return riders, shifts


# ------------------------------- S3 objects --------------------------------
def s3_objects() -> dict[str, dict]:
    return {
        f"outputs/run={RUN_ID}/summary.json": _load("summary.json"),
        f"outputs/run={RUN_ID}/trajectories.geojson": _load("trajectories.geojson"),
        f"outputs/run={RUN_ID}/fires_48h.geojson": _load("fires_48h.geojson"),
        "outputs/latest.json": {"run_id": RUN_ID, "summary_key": f"outputs/run={RUN_ID}/summary.json"},
        "outputs/skill/latest.json": _load("skill.json"),
    }


# ------------------------------- writers -----------------------------------
def write_local():
    (LOCAL / "s3").mkdir(parents=True, exist_ok=True)
    (LOCAL / "ddb").mkdir(parents=True, exist_ok=True)
    tables = {
        "Forecast": forecast_items(), "StationForecast": station_items(),
        "Attribution": attribution_items(), "Actions": action_items(),
    }
    riders, shifts = rider_and_shift_items()
    tables["Riders"] = riders
    tables["Shifts"] = shifts
    for name, items in tables.items():
        (LOCAL / "ddb" / f"{name}.json").write_text(json.dumps(items, indent=2), encoding="utf-8")
    for key, obj in s3_objects().items():
        p = LOCAL / "s3" / key
        p.parent.mkdir(parents=True, exist_ok=True)
        p.write_text(json.dumps(obj, indent=2), encoding="utf-8")
    counts = {k: len(v) for k, v in tables.items()}
    print(f"[PT_LOCAL] wrote {sum(counts.values())} items -> {LOCAL/'ddb'} {counts}")
    print(f"[PT_LOCAL] wrote {len(s3_objects())} S3 objects -> {LOCAL/'s3'}")


def write_aws():
    import boto3
    from decimal import Decimal

    region = os.environ.get("AWS_REGION", "us-east-1")
    ddb = boto3.resource("dynamodb", region_name=region)
    s3 = boto3.client("s3", region_name=region)
    bucket = os.environ["BUCKET"]

    def _dec(x):  # DynamoDB needs Decimal, not float
        return json.loads(json.dumps(x), parse_float=Decimal)

    table_map = {
        os.environ["TABLE_FORECAST"]: forecast_items(),
        os.environ["TABLE_STATION_FORECAST"]: station_items(),
        os.environ["TABLE_ATTRIBUTION"]: attribution_items(),
        os.environ["TABLE_ACTIONS"]: action_items(),
    }
    riders, shifts = rider_and_shift_items()
    table_map[os.environ["TABLE_RIDERS"]] = riders
    table_map[os.environ["TABLE_SHIFTS"]] = shifts

    for table_name, items in table_map.items():
        t = ddb.Table(table_name)
        with t.batch_writer() as bw:
            for it in items:
                bw.put_item(Item=_dec(it))
        print(f"[AWS] {table_name}: {len(items)} items")

    for key, obj in s3_objects().items():
        s3.put_object(Bucket=bucket, Key=key, Body=json.dumps(obj).encode("utf-8"),
                      ContentType="application/json")
        print(f"[AWS] s3://{bucket}/{key}")


def main():
    if os.environ.get("PT_LOCAL"):
        write_local()
    else:
        write_aws()


if __name__ == "__main__":
    main()
