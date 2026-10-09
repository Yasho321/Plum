"""
OWNER    : Yasho2
DUE      : D1 13:00
TASK     :
  Every mock parses with its pydantic model (proves JS and Python contracts agree).
DONE WHEN: -
GUIDE    : docs/team/YASHO2.md  |  brief: docs/PROJECT_BRIEF.md
STATUS   : DONE
"""
import json
import sys
from pathlib import Path

import pytest

# contracts/python on the path (no install step needed for the hackathon)
ROOT = Path(__file__).resolve().parents[2]
sys.path.insert(0, str(ROOT / "contracts" / "python"))

from plumetrace_contracts.models import (  # noqa: E402
    ActionList,
    AttributionResponse,
    ChatStreamEvent,
    FireFeatureCollection,
    FleetExposure,
    ForecastFeatureCollection,
    ForecastPublishedEvent,
    RunSummary,
    SkillResponse,
    StationSeries,
)
from pydantic import TypeAdapter  # noqa: E402

MOCKS = ROOT / "contracts" / "mocks"

# single-document mocks: file -> model
SINGLE = {
    "summary.json": RunSummary,
    "forecast_published.event.json": ForecastPublishedEvent,
    "attribution.json": AttributionResponse,
    "skill.json": SkillResponse,
    "fleet_exposure.json": FleetExposure,
    "actions.json": ActionList,
    "forecast_h3.geojson": ForecastFeatureCollection,
    "trajectories.geojson": "TrajectoryFeatureCollection",
    "fires_48h.geojson": FireFeatureCollection,
}


@pytest.mark.parametrize("filename,model", list(SINGLE.items()))
def test_single_mock_validates(filename, model):
    if isinstance(model, str):
        from plumetrace_contracts import models as m
        model = getattr(m, model)
    data = json.loads((MOCKS / filename).read_text(encoding="utf-8"))
    model.model_validate(data)


def test_station_forecast_bundle_validates():
    """station_forecast.json is a map of station_id -> StationSeries."""
    data = json.loads((MOCKS / "station_forecast.json").read_text(encoding="utf-8"))
    assert len(data) == 3
    for series in data.values():
        StationSeries.model_validate(series)


def test_chat_stream_jsonl_validates():
    adapter = TypeAdapter(ChatStreamEvent)
    lines = [
        ln for ln in (MOCKS / "chat_stream.jsonl").read_text(encoding="utf-8").splitlines()
        if ln.strip()
    ]
    assert len(lines) >= 10
    for ln in lines:
        adapter.validate_python(json.loads(ln))


def test_scenario_is_internally_consistent():
    """The mocks tell one story: run 2026-10-09T00Z, Sangrur top, ~8 riders over."""
    summary = json.loads((MOCKS / "summary.json").read_text(encoding="utf-8"))
    fleet = json.loads((MOCKS / "fleet_exposure.json").read_text(encoding="utf-8"))
    attribution = json.loads((MOCKS / "attribution.json").read_text(encoding="utf-8"))

    assert summary["run_id"] == "2026-10-09T00Z"
    assert summary["delhi_fire_share_p50"] == 0.31
    assert summary["hotspot_districts"][0]["district"] == "Sangrur"
    assert attribution["districts"][0]["district"] == "Sangrur"
    assert fleet["summary"]["riders_over_budget"] == 8
    assert fleet["simulated"] is True
