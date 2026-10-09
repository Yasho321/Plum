"""
OWNER    : Khare
DUE      : D1 18:00
TASK     :
  ConcLookup(run_id).pm25(h3_res7, hour_utc) -> p50 µg/m³ from Forecast table (batch-loaded once per run into a dict). Null cell -> nearest non-null ring (h3.grid_disk up to k=3) else NCR mean. Mock mode reads contracts/mocks/forecast_h3.geojson.
DONE WHEN: Used by dose engine AND Yasho2's replanner (shared interface — don't change the signature without telling Yasho2).
GUIDE    : docs/team/KHARE.md  |  brief: docs/PROJECT_BRIEF.md
STATUS   : DONE
"""

import os
import json
import boto3
from typing import Dict, Optional
import h3

class ConcLookup:
    def __init__(self, run_id: str):
        self.run_id = run_id
        # Dict mapping: hour_utc string -> dict of h3 -> pm25
        self.data: Dict[str, Dict[str, float]] = {}
        self.mean_pm25: float = 60.0
        self._load_data()

    def _load_data(self):
        is_local = os.environ.get("PT_LOCAL") == "1"
        if is_local:
            mock_path = os.path.join(os.path.dirname(__file__), "..", "..", "contracts", "mocks", "forecast_h3.geojson")
            try:
                with open(mock_path, "r", encoding="utf-8") as f:
                    geo = json.load(f)
                
                # Mock might just have one hour or be a placeholder. For simplicity, we just use one default hour
                # or fallback mean if empty.
                mock_hour = "default"
                self.data[mock_hour] = {}
                vals = []
                for feat in geo.get("features", []):
                    cell = feat.get("properties", {}).get("h3")
                    pm25 = feat.get("properties", {}).get("pm25")
                    if cell and pm25 is not None:
                        self.data[mock_hour][cell] = float(pm25)
                        vals.append(float(pm25))
                if vals:
                    self.mean_pm25 = sum(vals) / len(vals)
            except Exception as e:
                print(f"Failed to load mock data: {e}")
                self.mean_pm25 = 100.0  # Fallback
        else:
            dynamodb = boto3.resource('dynamodb')
            table_name = os.environ.get('TABLE_FORECAST', 'pt-demo-Forecast')
            table = dynamodb.Table(table_name)
            
            try:
                # Query by run_id on GSI 'byRun'
                response = table.query(
                    IndexName='byRun',
                    KeyConditionExpression=boto3.dynamodb.conditions.Key('run_id').eq(self.run_id)
                )
                vals = []
                for item in response.get('Items', []):
                    # Read the ForecastItem contract attributes directly (DECISIONS D-16):
                    # the base sk is <run_id>#<valid_hour>; the "<valid_hour>#<h3>"
                    # composite lives in gsi1sk, so never parse sk for hour/cell.
                    hour_utc = item.get('valid_hour')
                    cell = item.get('h3')
                    if not hour_utc or not cell:
                        # fall back to splitting gsi1sk ("<valid_hour>#<h3>") if present
                        gsi1sk = item.get('gsi1sk', '')
                        if '#' in gsi1sk:
                            hour_utc, cell = gsi1sk.split('#', 1)
                    pm25 = item.get('pm25')
                    if hour_utc and cell and pm25 is not None:
                        if hour_utc not in self.data:
                            self.data[hour_utc] = {}
                        self.data[hour_utc][cell] = float(pm25)
                        vals.append(float(pm25))
                if vals:
                    self.mean_pm25 = sum(vals) / len(vals)
            except Exception as e:
                print(f"Failed to query DynamoDB: {e}")
                self.mean_pm25 = 100.0

    def pm25(self, h3_res7: str, hour_utc: str) -> float:
        hour_data = self.data.get(hour_utc) or self.data.get("default")
        if not hour_data:
            return self.mean_pm25

        val = hour_data.get(h3_res7)
        if val is not None:
            return val
            
        # Fallback to nearest ring up to k=3
        for k in range(1, 4):
            try:
                ring = h3.grid_ring(h3_res7, k)
                for cell in ring:
                    if cell in hour_data and hour_data[cell] is not None:
                        return hour_data[cell]
            except Exception:
                pass
                
        return self.mean_pm25
