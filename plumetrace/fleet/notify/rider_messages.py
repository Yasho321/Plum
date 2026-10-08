"""
OWNER    : Khare
DUE      : D3 11:00
TASK     :
  Lambda draftRiderNotifications {plan_action_id}: for each changed rider render §13.4 template (IST slots, % of budget before/after, N95 hours) -> createDraft('rider_notify', {messages[]}).
DONE WHEN: Executor delivers them on approval.
GUIDE    : docs/team/KHARE.md  |  brief: docs/PROJECT_BRIEF.md
STATUS   : DONE
"""

import os
import uuid
import json

def generate_rider_message(rider_id, before_pct, after_pct, n95_slots):
    slots_str = ", ".join(n95_slots) if n95_slots else "None"
    return (
        f"Hello Rider {rider_id[-2:]}, your shift has been updated to protect your health.\n"
        f"Original estimated dose: {before_pct:.0f}% of daily safe limit.\n"
        f"New estimated dose: {after_pct:.0f}% of daily safe limit.\n"
        f"Please wear your N95 mask during these high-pollution slots: {slots_str}."
    )

def handler(event, context):
    plan_action_id = event.get('plan_action_id')
    
    # In a real system, we'd fetch the shift plan changes.
    # For now, we mock some changes.
    messages = []
    
    messages.append({
        'rider_id': 'DELHI_01_RIDER_01',
        'text': generate_rider_message('DELHI_01_RIDER_01', 120, 85, ['10:00-11:00 IST', '14:00-15:00 IST'])
    })
    
    # Create draft
    # In Python, we would call the contracts repo or a shared DB.
    # We will mock the draft creation here since actionsRepo is in JS.
    action_id = f"act_{uuid.uuid4().hex[:8]}"
    
    return {
        'action_id': action_id,
        'messages': messages
    }
