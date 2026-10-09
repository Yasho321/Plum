"""
OWNER    : Khare
DUE      : D1 15:00
TASK     :
  fleet_demo: 6 dark stores (synthetic coords inside Delhi), 50 riders (synthetic names, home_h3 near a store, vehicle 2w, shift 8–10 h, dose_budget_ug per §13.2). ~10 riders consent_health with asthma -> RiderHealth (budget_multiplier 0.7). Writes DynamoDB or --local JSON.
DONE WHEN: Riders + RiderHealth tables populated; everything flagged synthetic.
GUIDE    : docs/team/KHARE.md  |  brief: docs/PROJECT_BRIEF.md
STATUS   : DONE
"""

import os
import json
import uuid
import random
import argparse
import time
import h3
import boto3

# 6 Dark stores in Delhi NCR
STORES = [
    {"name": "Rohini", "lat": 28.7041, "lon": 77.1025},
    {"name": "Dwarka", "lat": 28.5823, "lon": 77.0500},
    {"name": "Saket", "lat": 28.5246, "lon": 77.2066},
    {"name": "Laxmi Nagar", "lat": 28.6304, "lon": 77.2773},
    {"name": "Karol Bagh", "lat": 28.6508, "lon": 77.1903},
    {"name": "Noida Sec-18", "lat": 28.5708, "lon": 77.3204}
]

def generate_fleet(num_riders=50, write_local=False):
    random.seed(42)  # Fixed random seed as per Khare playbook 7
    riders = []
    rider_health = []

    health_consent_indices = set(random.sample(range(num_riders), 10))

    for i in range(num_riders):
        rider_id = f"rider_{uuid.uuid4().hex[:8]}"
        store = random.choice(STORES)
        
        # Jitter location slightly around the store
        lat = store["lat"] + random.uniform(-0.02, 0.02)
        lon = store["lon"] + random.uniform(-0.02, 0.02)
        home_h3 = h3.latlng_to_cell(lat, lon, 7)
        
        shift_hours = random.uniform(8.0, 10.0)
        
        consented = i in health_consent_indices
        budget_multiplier = 0.7 if consented else 1.0
        
        # Dose budget: 60 µg/m³ * 1.4 m³/h * shift_hours * budget_multiplier
        budget_ug = 60.0 * 1.4 * shift_hours * budget_multiplier
        
        rider = {
            "pk": f"rider#{rider_id}",
            "name": f"Synthetic Rider {i+1}",
            "home_h3": home_h3,
            "vehicle": "2w",
            "dose_budget_ug": round(budget_ug, 2),
            "consent_health": consented,
            "synthetic": True
        }
        
        if consented:
            rider["consent_ts"] = int(time.time())
            health_record = {
                "pk": f"rider#{rider_id}",
                "conditions": ["asthma"],
                "budget_multiplier": 0.7,
                "synthetic": True
            }
            rider_health.append(health_record)
            
        riders.append(rider)
        
    if write_local or os.environ.get("PT_LOCAL") == "1":
        os.makedirs(".local-s3", exist_ok=True)
        with open(".local-s3/riders.json", "w") as f:
            json.dump(riders, f, indent=2)
        with open(".local-s3/rider_health.json", "w") as f:
            json.dump(rider_health, f, indent=2)
        print(f"Wrote {len(riders)} riders and {len(rider_health)} health records to .local-s3/")
    else:
        dynamodb = boto3.resource('dynamodb')
        riders_table = dynamodb.Table(os.environ.get('TABLE_RIDERS', 'pt-demo-Riders'))
        health_table = dynamodb.Table(os.environ.get('TABLE_RIDER_HEALTH', 'pt-demo-RiderHealth'))
        
        with riders_table.batch_writer() as batch:
            for r in riders:
                batch.put_item(Item=r)
                
        with health_table.batch_writer() as batch:
            for rh in rider_health:
                batch.put_item(Item=rh)
        print(f"Inserted {len(riders)} riders to DynamoDB.")

if __name__ == "__main__":
    parser = argparse.ArgumentParser()
    parser.add_argument("--local", action="store_true", help="Write to local JSON instead of DynamoDB")
    args = parser.parse_args()
    generate_fleet(write_local=args.local)
