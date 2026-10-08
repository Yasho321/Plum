"""
OWNER    : Tejas
DUE      : D1 12:00
TASK     :
  Round-trip + conversion tests for engine/plumetrace_engine/common/timeutil.py.
DONE WHEN: `python -m pytest tests/engine/test_timeutil.py` passes.
GUIDE    : docs/team/TEJAS.md  |  brief: docs/PROJECT_BRIEF.md
STATUS   : DONE
"""
import os
import sys
from datetime import datetime, timezone

# conftest.py (Yasho1) is still a stub, so bootstrap the engine package path ourselves.
_ENGINE = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", "..", "engine"))
if _ENGINE not in sys.path:
    sys.path.insert(0, _ENGINE)

from plumetrace_engine.common import timeutil as T  # noqa: E402


def test_run_id_round_trip():
    assert T.dt_to_run_id(T.run_id_to_dt("2026-10-09T00Z")) == "2026-10-09T00Z"
    dt = T.run_id_to_dt("2026-10-09T18Z")
    assert dt == datetime(2026, 10, 9, 18, tzinfo=timezone.utc)
    assert dt.tzinfo is not None


def test_iso_z_is_minute_precision_with_z():
    dt = datetime(2026, 10, 9, 8, 0, tzinfo=timezone.utc)
    assert T.iso_z(dt) == "2026-10-09T08:00Z"
    assert T.parse_z(T.iso_z(dt)) == dt


def test_naive_input_assumed_utc():
    assert T.dt_to_run_id(datetime(2026, 10, 9, 0)) == "2026-10-09T00Z"


def test_valid_hours_span_0_to_72_inclusive():
    vh = T.valid_hours("2026-10-09T00Z")
    assert len(vh) == 73
    assert vh[0] == "2026-10-09T00:00Z"
    assert vh[72] == "2026-10-12T00:00Z"


def test_lead_h_accepts_strings_and_datetimes():
    assert T.lead_h("2026-10-09T08:00Z", "2026-10-09T00Z") == 8
    assert T.lead_h("2026-10-10T00:00Z", "2026-10-09T00Z") == 24
    issue = T.run_id_to_dt("2026-10-09T00Z")
    assert T.lead_h(issue, issue) == 0


def test_to_ist_offset():
    dt = datetime(2026, 10, 9, 0, 0, tzinfo=timezone.utc)
    ist = T.to_ist(dt)
    assert (ist.hour, ist.minute) == (5, 30)
    assert ist.utcoffset().total_seconds() == 5.5 * 3600
