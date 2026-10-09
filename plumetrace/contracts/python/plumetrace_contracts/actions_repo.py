"""
OWNER    : Yasho2
DUE      : D1 18:00
TASK     :
  Python twin of actionsRepo.js (create_draft / transition) for fleet/replanner and fleet/notify. Same conditional-write semantics.
DONE WHEN: Used by fleet/replanner/handler.py.
GUIDE    : docs/team/YASHO2.md  |  brief: docs/PROJECT_BRIEF.md
STATUS   : DONE
"""
from __future__ import annotations

import uuid
from datetime import datetime, timezone
from typing import Any, Optional

from .models import ActionItem, can_transition

__all__ = ["new_action_item", "assert_transition", "IllegalTransition", "ActionsRepo", "action_pk"]


def action_pk(action_id: str) -> str:
    return f"action#{action_id}"


def _now_iso() -> str:
    # UTC ISO-8601 ending in Z (brief §7)
    return datetime.now(timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ")


class IllegalTransition(ValueError):
    pass


def assert_transition(frm: str, to: str) -> None:
    if not can_transition(frm, to):
        raise IllegalTransition(f"Illegal action transition {frm} -> {to}")


def new_action_item(
    type: str,
    payload: Optional[dict[str, Any]] = None,
    run_id: Optional[str] = None,
    created_by: str = "agent",
) -> dict[str, Any]:
    """Pure builder for a fresh draft action (no I/O). Validated against ActionItem."""
    action_id = str(uuid.uuid4())
    ts = _now_iso()
    item = {
        "pk": action_pk(action_id),
        "action_id": action_id,
        "type": type,
        "status": "draft",
        "payload": payload or {},
        "created_by": created_by,
        "approved_by": None,
        "run_id": run_id,
        "created_at": ts,
        "updated_at": ts,
    }
    # Raises if the shape is wrong; keeps every producer honest.
    ActionItem.model_validate(item)
    return item


class ActionsRepo:
    """
    Bind to a boto3 DynamoDB Table resource:
        import boto3
        table = boto3.resource("dynamodb").Table(os.environ["TABLE_ACTIONS"])
        repo = ActionsRepo(table)
    """

    def __init__(self, table):
        self.table = table

    def create_draft(self, type: str, payload: dict[str, Any], run_id: Optional[str] = None) -> dict[str, Any]:
        from boto3.dynamodb.conditions import Attr

        item = new_action_item(type, payload, run_id)
        self.table.put_item(Item=item, ConditionExpression=Attr("pk").not_exists())
        return item

    def get_action(self, action_id: str) -> Optional[dict[str, Any]]:
        resp = self.table.get_item(Key={"pk": action_pk(action_id)})
        return resp.get("Item")

    def transition(self, action_id: str, frm: str, to: str, extra: Optional[dict[str, Any]] = None) -> dict[str, Any]:
        """
        Atomically move an action frm -> to. The ConditionExpression on the
        current status makes a double approve/execute raise
        ClientError(ConditionalCheckFailedException) — callers map that to 409.
        """
        from boto3.dynamodb.conditions import Attr

        assert_transition(frm, to)
        extra = extra or {}

        names = {"#s": "status"}
        values = {":to": to, ":from": frm, ":now": _now_iso()}
        sets = ["#s = :to", "updated_at = :now"]
        for k, v in extra.items():
            names[f"#{k}"] = k
            values[f":{k}"] = v
            sets.append(f"#{k} = :{k}")

        resp = self.table.update_item(
            Key={"pk": action_pk(action_id)},
            UpdateExpression="SET " + ", ".join(sets),
            ConditionExpression=Attr("status").eq(frm),
            ExpressionAttributeNames=names,
            ExpressionAttributeValues=values,
            ReturnValues="ALL_NEW",
        )
        return resp.get("Attributes")
