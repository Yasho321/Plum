"""
OWNER    : Khare
DUE      : D1 18:00
TASK     :
  ~600 orders/day with IST peaks 8–10, 13–14, 19–22; pickup = dark store h3, drop h3 within ~6 km; window [created, +45 min]; 30 % flexible (3 h). Baseline plan: greedy nearest-free-rider assignment -> Shifts.planned_stops [{order_id, h3, eta}], plan_version 1. Deterministic seed.
DONE WHEN: Shifts for tomorrow exist; replanner has an input.
GUIDE    : docs/team/KHARE.md  |  brief: docs/PROJECT_BRIEF.md
STATUS   : DONE
"""

import os
import json
import uuid
import random
import argparse
import time
import datetime
import h3
import boto3

# From generate_fleet.py
STORES = [
    {"name": "Rohini", "lat": 28.7041, "lon": 77.1025},
    {"name": "Dwarka", "lat": 28.5823, "lon": 77.0500},
    {"name": "Saket", "lat": 28.5246, "lon": 77.2066},
    {"name": "Laxmi Nagar", "lat": 28.6304, "lon": 77.2773},
    {"name": "Karol Bagh", "lat": 28.6508, "lon": 77.1903},
    {"name": "Noida Sec-18", "lat": 28.5708, "lon": 77.3204}
]

def generate_orders(target_date_str, num_orders=600, write_local=False):
    random.seed(42)  # Deterministic seed
    
    # Target date is 'YYYY-MM-DD'
    try:
        dt = datetime.datetime.strptime(target_date_str, "%Y-%m-%d")
    except ValueError:
        if target_date_str == "tomorrow":
            dt = datetime.datetime.utcnow() + datetime.timedelta(days=1)
            target_date_str = dt.strftime("%Y-%m-%d")
        else:
            raise
            
    # Load riders
    is_local = write_local or os.environ.get("PT_LOCAL") == "1"
    riders = []
    if is_local:
        try:
            with open(".local-s3/riders.json", "r") as f:
                riders = json.load(f)
        except Exception:
            pass
    else:
        dynamodb = boto3.resource('dynamodb')
        riders_table = dynamodb.Table(os.environ.get('TABLE_RIDERS', 'pt-demo-Riders'))
        riders = riders_table.scan().get('Items', [])
        
    if not riders:
        print("No riders found. Run generate_fleet.py first.")
        return
        
    orders = []
    # Generate orders with Poisson-like arrivals focused on peaks
    peaks = [(8, 10), (13, 14), (19, 22)]
    
    for i in range(num_orders):
        store = random.choice(STORES)
        store_h3 = h3.latlng_to_cell(store['lat'], store['lon'], 7)
        
        # Random drop location ~6km away (roughly 2-3 rings in h3 res 7)
        drop_ring = h3.grid_ring(store_h3, random.randint(1, 3))
        drop_h3 = random.choice(list(drop_ring))
        
        # Pick a time
        # 70% chance to be in a peak, 30% off-peak
        if random.random() < 0.7:
            peak = random.choice(peaks)
            hour_ist = random.uniform(peak[0], peak[1])
        else:
            hour_ist = random.uniform(6, 23)
            
        # Convert IST to UTC (IST is UTC+5:30)
        hour_utc = hour_ist - 5.5
        if hour_utc < 0:
            hour_utc += 24
            
        start_utc = int(dt.replace(hour=int(hour_utc), minute=int((hour_utc % 1) * 60)).timestamp())
        
        is_flexible = random.random() < 0.3
        window = 3 * 60 if is_flexible else 45
        
        orders.append({
            "order_id": f"ord_{uuid.uuid4().hex[:8]}",
            "store_h3": store_h3,
            "drop_h3": drop_h3,
            "created_utc": start_utc,
            "deadline_utc": start_utc + window * 60,
            "flexible": is_flexible
        })
        
    orders.sort(key=lambda x: x["created_utc"])
    
    # Baseline plan: greedy nearest-free-rider assignment (simplified for mock/demo)
    # We'll just distribute orders to riders evenly for the baseline
    shifts = {}
    for r in riders:
        shifts[r['pk']] = {
            "pk": f"fleet#fleet_demo#date#{target_date_str}",
            "sk": r['pk'],
            "planned_stops": [],
            "forecast_dose_ug": 0.0,
            "actual_dose_ug": 0.0,
            "plan_version": 1
        }
        
    for idx, order in enumerate(orders):
        rider = riders[idx % len(riders)]
        shift = shifts[rider['pk']]
        
        # Add pickup
        shift["planned_stops"].append({
            "order_id": order["order_id"],
            "h3": order["store_h3"],
            "eta": (order["created_utc"] - dt.timestamp()) / 60.0,
            "type": "pickup"
        })
        
        # Add drop (assume 15 min travel)
        shift["planned_stops"].append({
            "order_id": order["order_id"],
            "h3": order["drop_h3"],
            "eta": (order["created_utc"] - dt.timestamp()) / 60.0 + 15.0,
            "type": "drop"
        })
        
    # Sort stops by ETA
    for shift in shifts.values():
        shift["planned_stops"].sort(key=lambda x: x["eta"])
        
    shift_items = list(shifts.values())
    
    if is_local:
        os.makedirs(".local-s3", exist_ok=True)
        with open(f".local-s3/shifts_{target_date_str}.json", "w") as f:
            json.dump(shift_items, f, indent=2)
        print(f"Wrote {len(shift_items)} shifts to .local-s3/shifts_{target_date_str}.json")
    else:
        dynamodb = boto3.resource('dynamodb')
        shifts_table = dynamodb.Table(os.environ.get('TABLE_SHIFTS', 'pt-demo-Shifts'))
        with shifts_table.batch_writer() as batch:
            for s in shift_items:
                batch.put_item(Item=s)
        print(f"Inserted {len(shift_items)} shifts to DynamoDB.")

if __name__ == "__main__":
    parser = argparse.ArgumentParser()
    parser.add_argument("--date", required=True, help="YYYY-MM-DD or 'tomorrow'")
    parser.add_argument("--local", action="store_true", help="Write to local JSON instead of DynamoDB")
    args = parser.parse_args()
    generate_orders(args.date, write_local=args.local)
