"""
OWNER    : Tejas
DUE      : D2 12:00
TASK     :
  Tests for engine/plumetrace_engine/publish/publish_event.py: detail built per §8.3,
  envelope source/detail-type/bus, and local-mode emit to outputs/.
DONE WHEN: `python -m pytest tests/engine/test_publish_event.py` passes.
GUIDE    : docs/team/TEJAS.md  |  brief: docs/PROJECT_BRIEF.md
STATUS   : DONE
"""
import os
import sys

import pytest

_ENGINE = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", "..", "engine"))
if _ENGINE not in sys.path:
    sys.path.insert(0, _ENGINE)

from plumetrace_engine.common import s3io  # noqa: E402
from plumetrace_engine.publish import publish_event as pe  # noqa: E402

SUMMARY = {
    "run_id": "2026-10-09T00Z",
    "issued_at": "2026-10-09T04:10Z",
    "max_pm25": 310,
    "peak_window_utc": ["2026-10-10T00:30Z", "2026-10-10T04:30Z"],
    "delhi_fire_share_p50": 0.31,
    "hotspot_districts": [{"district": "Sangrur", "share": 0.12}, {"district": "Patiala", "share": 0.07}],
    "model_version": "lgbm-2026-10-09a",
}


def test_build_detail_matches_8_3_fields():
    d = pe.build_detail(SUMMARY, "2026-10-09T00Z", degraded=["firms"])
    assert d["run_id"] == "2026-10-09T00Z"
    assert d["max_pm25"] == 310
    assert d["peak_window_utc"] == ["2026-10-10T00:30Z", "2026-10-10T04:30Z"]
    assert d["delhi_fire_share_p50"] == 0.31
    assert d["hotspot_districts"][0]["district"] == "Sangrur"
    assert d["degraded"] == ["firms"]            # D-10
    assert "hotspot_villages" in d               # D-10
    assert d["model_version"] == "lgbm-2026-10-09a"


def test_envelope_has_source_and_detail_type():
    env = pe.build_envelope(pe.build_detail(SUMMARY, "2026-10-09T00Z"), "dev")
    assert env["Source"] == "plumetrace.engine"
    assert env["DetailType"] == "forecast.published"
    assert env["EventBusName"] == "plumetrace-dev"


def test_partial_summary_still_builds():
    d = pe.build_detail({}, "2026-10-09T00Z")
    assert d["run_id"] == "2026-10-09T00Z"
    assert d["hotspot_districts"] == [] and d["degraded"] == []
    assert d["issued_at"].endswith("Z")


def test_publish_local_mode_writes_event(tmp_path, monkeypatch):
    monkeypatch.setenv("PT_LOCAL", "1")
    monkeypatch.setenv("PT_LOCAL_ROOT", str(tmp_path))
    env = pe.publish("2026-10-09T00Z", "dev", degraded=[], summary=SUMMARY)
    assert env["DetailType"] == "forecast.published"
    key = s3io.key_outputs("2026-10-09T00Z", "forecast_published.event.json")
    assert s3io.exists(key)
    assert s3io.get_json(key)["Detail"]["max_pm25"] == 310
