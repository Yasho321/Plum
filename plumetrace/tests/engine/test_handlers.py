"""
OWNER    : Tejas
DUE      : D2 12:00
TASK     :
  Dispatch + envelope tests for engine/plumetrace_engine/handlers.py. Proves each handler
  is registered and `resolve_run` runs fully offline via the run_id override.
DONE WHEN: `python -m pytest tests/engine/test_handlers.py` passes.
GUIDE    : docs/team/TEJAS.md  |  brief: docs/PROJECT_BRIEF.md
STATUS   : DONE
"""
import os
import sys

import pytest

_ENGINE = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", "..", "engine"))
if _ENGINE not in sys.path:
    sys.path.insert(0, _ENGINE)

from plumetrace_engine import handlers  # noqa: E402


EXPECTED = {
    "resolve_run", "ingest_firms", "ingest_gfs_hour", "ingest_openaq",
    "trajectories", "forecast", "gridding", "summarize", "publish",
    "verify_fill_obs", "verify_skill",
}


def test_all_states_registered():
    assert EXPECTED <= set(handlers.HANDLERS)


def test_resolve_run_handler_runs_offline_with_override():
    out = handlers.dispatch("resolve_run", {"run_id": "2026-10-09T00Z"})
    assert out["run_id"] == "2026-10-09T00Z"
    assert out["degraded"] == []
    assert out["cycle_dt"] == "2026-10-09T00:00Z"


def test_unknown_handler_raises():
    with pytest.raises(KeyError):
        handlers.dispatch("nope", {})


def test_science_handler_stays_runnable():
    # Yasho1's forecast module now runs; offline (no feature data) it returns an
    # empty result rather than crashing. Either way the state must stay runnable
    # and never raise, and the envelope must be preserved.
    out = handlers.dispatch("forecast", {"run_id": "2026-10-09T00Z"})
    assert isinstance(out["forecast"], dict)
    assert out["degraded"] == []


def test_dispatch_does_not_mutate_caller_payload():
    original = {"run_id": "2026-10-09T00Z"}
    handlers.dispatch("resolve_run", original)
    assert "degraded" not in original  # handler works on a copy


def test_cli_main_prints_json(capsys):
    rc = handlers.main(["resolve_run", '{"run_id":"2026-10-09T00Z"}'])
    assert rc == 0
    out = capsys.readouterr().out
    assert '"run_id": "2026-10-09T00Z"' in out or '"run_id":"2026-10-09T00Z"' in out
