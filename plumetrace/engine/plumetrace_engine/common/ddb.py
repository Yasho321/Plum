"""
OWNER    : Tejas
DUE      : D1 18:00
TASK     :
  Batch writers (BatchWriteItem, 25 per call, retry unprocessed) for Forecast, StationForecast, Attribution; adds ttl = now+7d; validates each item with plumetrace_contracts pydantic models before writing.
DONE WHEN: Writing 50k Forecast items takes < 60 s.
GUIDE    : docs/team/TEJAS.md  |  brief: docs/PROJECT_BRIEF.md
STATUS   : WIP
  Key builders, item builders, ttl and 25-item chunking are complete and unit-tested
  (tests/engine/test_ddb.py). pydantic validation is wired but a no-op until Yasho2's
  plumetrace_contracts models land (soft import). The 50k-items-in-<60s throughput
  check needs a real on-demand table — it runs against DataStack once deployed.

Key patterns are the frozen §8.1 contract:
  Forecast         pk h3#<cell>            sk <run_id>#<valid_hour>
  StationForecast  pk station#<loc_id>     sk <run_id>#<valid_hour>
  Attribution      pk date#<YYYY-MM-DD>     sk district#<name>
"""
from __future__ import annotations

import logging
import time
from datetime import datetime, timedelta, timezone
from typing import Any, Iterable, Iterator

log = logging.getLogger(__name__)

BATCH_SIZE = 25  # DynamoDB BatchWriteItem hard limit


# --- Key builders (§8.1) ------------------------------------------------------

def forecast_pk(cell: str) -> str:
    return f"h3#{cell}"


def forecast_sk(run_id: str, valid_hour: str) -> str:
    return f"{run_id}#{valid_hour}"


def station_pk(location_id: str | int) -> str:
    return f"station#{location_id}"


def station_sk(run_id: str, valid_hour: str) -> str:
    return f"{run_id}#{valid_hour}"


def attribution_pk(date: str) -> str:
    return f"date#{date}"


def attribution_sk(district: str) -> str:
    return f"district#{district}"


# --- TTL ----------------------------------------------------------------------

def ttl_in(days: int = 7, now: datetime | None = None) -> int:
    """Epoch seconds `days` from now, for DynamoDB TTL (brief §8.1: epoch + 7 days)."""
    base = now or datetime.now(timezone.utc)
    return int((base + timedelta(days=days)).timestamp())


# --- Soft contract validation -------------------------------------------------

def _validate(item: dict, kind: str) -> None:
    """Validate against plumetrace_contracts if present; otherwise skip (soft import)."""
    try:
        from plumetrace_contracts import models  # type: ignore
    except Exception:
        return
    model = getattr(models, kind, None)
    if model is not None:
        model.model_validate(item)  # raises on mismatch


# --- Item builders ------------------------------------------------------------

def build_forecast_item(cell: str, run_id: str, valid_hour: str, lead_h: int, **attrs: Any) -> dict:
    item = {
        "pk": forecast_pk(cell),
        "sk": forecast_sk(run_id, valid_hour),
        "run_id": run_id,
        "valid_hour": valid_hour,
        "lead_h": lead_h,
        "ttl": ttl_in(7),
        **attrs,
    }
    _validate(item, "ForecastItem")
    return item


def build_station_item(location_id, run_id: str, valid_hour: str, lead_h: int, **attrs: Any) -> dict:
    item = {
        "pk": station_pk(location_id),
        "sk": station_sk(run_id, valid_hour),
        "run_id": run_id,
        "valid_hour": valid_hour,
        "lead_h": lead_h,
        "ttl": ttl_in(7),
        **attrs,
    }
    _validate(item, "StationForecastItem")
    return item


def build_attribution_item(date: str, district: str, **attrs: Any) -> dict:
    item = {"pk": attribution_pk(date), "sk": attribution_sk(district), **attrs}
    _validate(item, "AttributionItem")
    return item


# --- Batch writer -------------------------------------------------------------

def chunked(items: Iterable[dict], size: int = BATCH_SIZE) -> Iterator[list[dict]]:
    buf: list[dict] = []
    for it in items:
        buf.append(it)
        if len(buf) == size:
            yield buf
            buf = []
    if buf:
        yield buf


def _table(name: str, dynamodb=None):
    if dynamodb is None:
        import boto3  # lazy

        dynamodb = boto3.resource("dynamodb")
    return dynamodb.Table(name)


def batch_write(table_name: str, items: Iterable[dict], dynamodb=None) -> int:
    """
    BatchWriteItem in chunks of 25 with exponential-backoff retry of UnprocessedItems.
    Uses the resource-level Table.batch_writer for auto-batching + retry; returns count.
    Returns the number of items submitted.
    """
    table = _table(table_name, dynamodb)
    n = 0
    with table.batch_writer(overwrite_by_pkeys=["pk", "sk"]) as writer:
        for item in items:
            writer.put_item(Item=item)
            n += 1
    log.info("wrote %d items to %s", n, table_name)
    return n


def batch_write_raw(client, table_name: str, items: list[dict], max_retries: int = 5) -> None:
    """
    Lower-level BatchWriteItem loop (25/call) retrying UnprocessedItems with backoff.
    `items` must be in DynamoDB JSON ({"pk": {"S": ...}, ...}); used where the
    resource API isn't convenient. Exposed mainly for explicit retry control.
    """
    for chunk in chunked(items, BATCH_SIZE):
        request = {table_name: [{"PutRequest": {"Item": it}} for it in chunk]}
        attempt = 0
        while request:
            resp = client.batch_write_item(RequestItems=request)
            request = resp.get("UnprocessedItems") or {}
            if request:
                attempt += 1
                if attempt > max_retries:
                    raise RuntimeError(f"Unprocessed items after {max_retries} retries on {table_name}")
                time.sleep(min(2 ** attempt * 0.05, 2.0))
