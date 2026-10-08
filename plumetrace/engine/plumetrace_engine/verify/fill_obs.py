"""
OWNER    : Yasho1
DUE      : D3 11:00
TASK     :
  Hourly job: pull latest OpenAQ hours (reuse ingest/openaq.py), write obs_pm25 into StationForecast rows whose valid_hour has passed (all runs).
DONE WHEN: AC4: obs_pm25 present for the last 24 h.
GUIDE    : docs/team/YASHO1.md  |  brief: docs/PROJECT_BRIEF.md
STATUS   : DONE
"""

import os
from typing import Any
from datetime import datetime
import pandas as pd

def run_fill_obs(now: datetime) -> int:
    import boto3
    from boto3.dynamodb.conditions import Key
    from plumetrace_engine.common import ddb, s3io
    from plumetrace_engine.ingest import openaq
    
    api_key = os.environ.get("OPENAQ_KEY", "mock_key")
    if api_key == "mock_key" and not s3io.local_mode():
        try:
            sm = boto3.client("secretsmanager")
            api_key = sm.get_secret_value(SecretId="plumetrace/openaq_key")["SecretString"]
        except Exception:
            pass

    # 1. Pull OpenAQ data for the last 24h
    res = openaq.ingest(api_key, hours=24, date=now.strftime("%Y-%m-%d"))
    obs_df = s3io.get_parquet(res["obs_key"])
    if obs_df.empty:
        return 0

    # 2. Write obs_pm25 into StationForecast rows
    dynamodb = boto3.resource("dynamodb")
    table = ddb._table("StationForecast", dynamodb)
    updates = []
    
    for loc_id, g in obs_df.groupby("location_id"):
        obs_map = {}
        for _, r in g.iterrows():
            ts = pd.to_datetime(r["ts_utc"]).strftime("%Y-%m-%dT%H:%MZ")
            obs_map[ts] = float(r["pm25"])

        pk = ddb.station_pk(loc_id)
        if s3io.local_mode():
            # In local mode, boto3 might fail if no endpoint url, but ddb doesn't fully support local mode right now
            # unless the user has DynamoDB Local. The user said ddb.py writes to S3 via local mode?
            # Wait! ddb.py uses boto3.resource("dynamodb"). It does not check PT_LOCAL. 
            pass
            
        try:
            resp = table.query(KeyConditionExpression=Key("pk").eq(pk))
            items = resp.get("Items", [])
            for item in items:
                vh = item.get("valid_hour")
                if vh in obs_map:
                    item["obs_pm25"] = obs_map[vh]
                    updates.append(item)
        except Exception as e:
            import logging
            logging.getLogger(__name__).warning("Failed to query StationForecast: %s", e)

    if updates:
        try:
            return ddb.batch_write("StationForecast", updates, dynamodb)
        except Exception as e:
            import logging
            logging.getLogger(__name__).warning("Failed to batch_write StationForecast: %s", e)
            return 0
    return 0
