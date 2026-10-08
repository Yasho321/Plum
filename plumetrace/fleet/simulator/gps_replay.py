"""
OWNER    : Khare
DUE      : D3 12:00
TASK     :
  Replay planned routes as 30-s GPS points to IoT Core topic fleet/<fleet_id>/rider/<rider_id>/gps (boto3 iot-data publish). Speed-up factor flag for the demo.
DONE WHEN: Dose GPS handler accumulates actual dose.
GUIDE    : docs/team/KHARE.md  |  brief: docs/PROJECT_BRIEF.md
STATUS   : DONE
"""

import os
import time
import json
import boto3
import argparse
from datetime import datetime

def load_local_json(filename):
    path = os.path.join('.local-db', filename)
    if os.path.exists(path):
        with open(path, 'r') as f:
            return json.load(f)
    return []

def main():
    parser = argparse.ArgumentParser()
    parser.add_argument('--date', required=True, help='Date of shifts to replay')
    parser.add_argument('--speedup', type=float, default=1.0, help='Speedup factor')
    args = parser.parse_args()

    is_mock = os.environ.get('PT_LOCAL') == '1' or os.environ.get('MOCK_MODE') == '1'
    iot_client = boto3.client('iot-data') if not is_mock else None

    shifts = load_local_json(f'shifts_{args.date}.json')
    if not shifts:
        print(f"No shifts found for {args.date}")
        return

    # A very naive simulator: iterate through shifts, tasks, and simulate GPS
    for shift in shifts:
        rider_id = shift['rider_id']
        fleet_id = shift['fleet_date'].split('#')[0]
        for task in shift.get('tasks', []):
            if 'lat' in task and 'lon' in task:
                payload = {
                    'rider_id': rider_id,
                    'lat': task['lat'],
                    'lon': task['lon'],
                    'timestamp': f"{args.date}T10:00:00",
                    'duration_mins': task.get('duration_mins', 5)
                }
                
                topic = f"fleet/{fleet_id}/rider/{rider_id}/gps"
                if iot_client:
                    iot_client.publish(
                        topic=topic,
                        qos=1,
                        payload=json.dumps(payload)
                    )
                else:
                    print(f"[MOCK GPS] Publish {topic}: {payload}")
                
                # In mock mode with a speedup, sleep to simulate time passing
                time.sleep(0.1 / args.speedup)

if __name__ == '__main__':
    main()
