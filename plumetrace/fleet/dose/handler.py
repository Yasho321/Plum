"""
OWNER    : Khare
DUE      : D2 16:00
TASK     :
  (a) forecast.published -> for tomorrow's Shifts compute forecast_dose_ug per rider; if any > 100 % budget invoke replanner Lambda async with {fleet_id, date, run_id}. (b) gps handler: IoT rule payload -> nowcast concentration -> accumulate Shifts.actual_dose_ug. Only this role reads RiderHealth.
DONE WHEN: AC2 fleet half.
GUIDE    : docs/team/KHARE.md  |  brief: docs/PROJECT_BRIEF.md
STATUS   : DONE
"""

import os
import json
import boto3
import h3
from datetime import datetime, timedelta
from fleet.dose.dose import segment_dose_ug, daily_budget_ug
from fleet.common.forecast_lookup import ConcLookup

def get_boto_clients():
    if os.environ.get('PT_LOCAL') == '1' or os.environ.get('MOCK_MODE') == '1':
        return None, None
    return boto3.resource('dynamodb'), boto3.client('lambda')

def load_local_json(filename):
    path = os.path.join('.local-db', filename)
    if os.path.exists(path):
        with open(path, 'r') as f:
            return json.load(f)
    return []

def save_local_json(filename, data):
    os.makedirs('.local-db', exist_ok=True)
    with open(os.path.join('.local-db', filename), 'w') as f:
        json.dump(data, f, indent=2)

def handle_forecast_published(event, context):
    """
    (a) forecast.published -> for tomorrow's Shifts compute forecast_dose_ug per rider; 
    if any > 100 % budget invoke replanner Lambda async with {fleet_id, date, run_id}.
    """
    date = event.get('date') or (datetime.now() + timedelta(days=1)).strftime('%Y-%m-%d')
    run_id = event.get('run_id', 'latest')
    fleet_id = event.get('fleet_id', 'DELHI_01')
    
    dynamodb, lambda_client = get_boto_clients()
    
    shifts = []
    rider_health = {}
    if dynamodb:
        shifts_table = dynamodb.Table('Shifts')
        resp = shifts_table.query(
            KeyConditionExpression="fleet_date = :fd",
            ExpressionAttributeValues={":fd": f"{fleet_id}#{date}"}
        )
        shifts = resp.get('Items', [])
        
        health_table = dynamodb.Table('RiderHealth')
        for s in shifts:
            h_resp = health_table.get_item(Key={'rider_id': s['rider_id']})
            if 'Item' in h_resp:
                rider_health[s['rider_id']] = h_resp['Item'].get('health_condition_shared', False)
    else:
        # Mock mode
        shifts = load_local_json(f'shifts_{date}.json')
        riders = load_local_json('riders.json')
        rider_health = {r['rider_id']: r.get('health_condition_shared', False) for r in riders}

    lookup = ConcLookup(run_id=run_id)
    needs_replanner = False
    
    for shift in shifts:
        rider_id = shift['rider_id']
        has_health = rider_health.get(rider_id, False)
        budget = daily_budget_ug(shift_hours=8.0, budget_multiplier=0.7 if has_health else 1.0)
        
        total_dose = 0
        for task in shift.get('tasks', []):
            if 'lat' in task and 'lon' in task:
                c = lookup.pm25(h3.latlng_to_cell(task['lat'], task['lon'], 7), 'default')
                minutes = task.get('duration_mins', 20)
                total_dose += segment_dose_ug(c, minutes)
        
        shift['forecast_dose_ug'] = total_dose
        if dynamodb:
            shifts_table.update_item(
                Key={'fleet_date': shift['fleet_date'], 'rider_id': shift['rider_id']},
                UpdateExpression="SET forecast_dose_ug = :d",
                ExpressionAttributeValues={":d": total_dose}
            )
            
        if total_dose > budget:
            needs_replanner = True

    if not dynamodb:
        save_local_json(f'shifts_{date}.json', shifts)

    if needs_replanner:
        payload = {'fleet_id': fleet_id, 'date': date, 'run_id': run_id}
        if lambda_client:
            lambda_client.invoke(
                FunctionName='fleet-replanner',
                InvocationType='Event',
                Payload=json.dumps(payload)
            )
        else:
            print(f"[MOCK] Invoking replanner with {payload}")

    return {"status": "ok", "needs_replanner": needs_replanner}

def handle_gps(event, context):
    """
    (b) gps handler: IoT rule payload -> nowcast concentration -> accumulate Shifts.actual_dose_ug
    Event shape: { "rider_id": "r1", "lat": 28.5, "lon": 77.1, "timestamp": "...", "duration_mins": 5 }
    """
    rider_id = event['rider_id']
    lat = event['lat']
    lon = event['lon']
    mins = event.get('duration_mins', 5)
    
    # In real system, we'd find the active shift for today.
    # For demo, just find the shift in mock DB.
    date = event.get('timestamp', datetime.now().isoformat())[:10]
    
    lookup = ConcLookup(run_id='latest')
    c = lookup.pm25(h3.latlng_to_cell(lat, lon, 7), 'default')
    dose = segment_dose_ug(c, mins)
    
    dynamodb, _ = get_boto_clients()
    fleet_date = f"DELHI_01#{date}"
    
    if dynamodb:
        shifts_table = dynamodb.Table('Shifts')
        shifts_table.update_item(
            Key={'fleet_date': fleet_date, 'rider_id': rider_id},
            UpdateExpression="ADD actual_dose_ug :d",
            ExpressionAttributeValues={":d": dose}
        )
    else:
        shifts = load_local_json(f'shifts_{date}.json')
        for s in shifts:
            if s['rider_id'] == rider_id:
                s['actual_dose_ug'] = s.get('actual_dose_ug', 0) + dose
                break
        save_local_json(f'shifts_{date}.json', shifts)
        print(f"[MOCK] Added {dose} ug to actual_dose_ug for {rider_id}")
        
    return {"status": "ok", "added_dose": dose}

def handler(event, context):
    if 'fleet_id' in event and 'date' in event:
        return handle_forecast_published(event, context)
    elif 'rider_id' in event and 'lat' in event:
        return handle_gps(event, context)
    return {"status": "unknown event"}
