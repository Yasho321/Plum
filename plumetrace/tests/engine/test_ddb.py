"""
OWNER    : Tejas
DUE      : D1 18:00
TASK     :
  Tests for engine/plumetrace_engine/common/ddb.py: §8.1 key builders, item builders
  (pk/sk/ttl), TTL math, and 25-item chunking.
DONE WHEN: `python -m pytest tests/engine/test_ddb.py` passes.
GUIDE    : docs/team/TEJAS.md  |  brief: docs/PROJECT_BRIEF.md
STATUS   : DONE
"""
import os
import sys
from datetime import datetime, timezone

_ENGINE = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", "..", "engine"))
if _ENGINE not in sys.path:
    sys.path.insert(0, _ENGINE)

from plumetrace_engine.common import ddb  # noqa: E402


def test_key_builders_match_brief_8_1():
    assert ddb.forecast_pk("8744c0a...") == "h3#8744c0a..."
    assert ddb.forecast_sk("2026-10-09T00Z", "2026-10-09T08:00Z") == "2026-10-09T00Z#2026-10-09T08:00Z"
    assert ddb.station_pk(12345) == "station#12345"
    assert ddb.attribution_pk("2026-10-09") == "date#2026-10-09"
    assert ddb.attribution_sk("Sangrur") == "district#Sangrur"


def test_ttl_is_seven_days_ahead():
    now = datetime(2026, 10, 9, 0, 0, tzinfo=timezone.utc)
    assert ddb.ttl_in(7, now=now) == int(datetime(2026, 10, 16, 0, 0, tzinfo=timezone.utc).timestamp())


def test_build_forecast_item_has_keys_and_ttl():
    now = datetime(2026, 10, 9, 0, 0, tzinfo=timezone.utc)
    item = ddb.build_forecast_item(
        "87abc", "2026-10-09T00Z", "2026-10-09T08:00Z", lead_h=8, pm25=120, pm25_p10=90, pm25_p90=160
    )
    assert item["pk"] == "h3#87abc"
    assert item["sk"] == "2026-10-09T00Z#2026-10-09T08:00Z"
    assert item["lead_h"] == 8 and item["pm25"] == 120
    assert item["ttl"] > int(now.timestamp())


def test_chunked_splits_into_25s():
    items = [{"pk": f"h3#{i}", "sk": "s"} for i in range(63)]
    chunks = list(ddb.chunked(items))
    assert [len(c) for c in chunks] == [25, 25, 13]
    assert sum(len(c) for c in chunks) == 63
