"""
OWNER    : Tejas
DUE      : D1 13:00
TASK     :
  Local-mode (PT_LOCAL=1) tests for engine/plumetrace_engine/common/s3io.py:
  key builders match brief §8.2, JSON/bytes/parquet round-trips, Windows-safe
  colon handling for valid_hour keys, presign returns a local URI.
DONE WHEN: `python -m pytest tests/engine/test_s3io.py` passes.
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


@pytest.fixture(autouse=True)
def _local(tmp_path, monkeypatch):
    monkeypatch.setenv("PT_LOCAL", "1")
    monkeypatch.setenv("PT_LOCAL_ROOT", str(tmp_path))
    assert s3io.local_mode()
    yield


def test_key_builders_match_brief_layout():
    assert s3io.key_raw_gfs("2026-10-09T00Z", 7) == "raw/gfs/run=2026-10-09T00Z/f007.nc"
    assert s3io.key_raw_gfs("2026-10-09T00Z", 72) == "raw/gfs/run=2026-10-09T00Z/f072.nc"
    assert s3io.key_curated_fires("2026-10-09") == "curated/fires/date=2026-10-09/fires.parquet"
    assert s3io.key_curated_obs("2026-10-09") == "curated/obs/date=2026-10-09/pm25.parquet"
    assert s3io.key_features("2026-10-09T00Z") == "features/run=2026-10-09T00Z/station_features.parquet"
    assert s3io.key_outputs_summary("2026-10-09T00Z") == "outputs/run=2026-10-09T00Z/summary.json"
    assert s3io.key_model("lgbm-2026-10-09a", "q50") == "models/lightgbm/lgbm-2026-10-09a/q50.txt"
    assert s3io.key_model("lgbm-2026-10-09a", "metadata") == "models/lightgbm/lgbm-2026-10-09a/metadata.json"
    # D-10 additions
    assert s3io.key_stations() == "curated/stations/stations.json"
    assert s3io.key_latest_pointer() == "outputs/latest.json"
    assert s3io.key_skill("backtest") == "outputs/skill/backtest.json"
    assert s3io.key_outputs_fires_48h("2026-10-09T00Z") == "outputs/run=2026-10-09T00Z/fires_48h.geojson"


def test_json_round_trip():
    key = s3io.key_outputs_summary("2026-10-09T00Z")
    obj = {"run_id": "2026-10-09T00Z", "max_pm25": 310, "delhi_fire_share_p50": 0.31}
    s3io.put_json(key, obj)
    assert s3io.exists(key)
    assert s3io.get_json(key) == obj


def test_valid_hour_colon_key_is_windows_safe():
    # valid_hour carries a ':' which is illegal in a Windows filename; local mode must map it.
    key = s3io.key_outputs_pm25_h3("2026-10-09T00Z", "2026-10-09T08:00Z")
    assert ":" in key  # the S3 key keeps the colon
    s3io.put_json(key, {"ok": True})
    assert ":" not in str(s3io._local_path(key).name)  # on-disk name has no colon
    assert s3io.get_json(key) == {"ok": True}


def test_bytes_round_trip():
    s3io.put_bytes("raw/firms/date=2026-10-09/VIIRS_SNPP_NRT-x.csv", b"lat,lon\n1,2\n")
    assert s3io.get_bytes("raw/firms/date=2026-10-09/VIIRS_SNPP_NRT-x.csv") == b"lat,lon\n1,2\n"


def test_parquet_round_trip():
    pd = pytest.importorskip("pandas")
    df = pd.DataFrame({"location_id": [1, 2], "pm25": [31.0, 44.5]})
    key = s3io.key_curated_obs("2026-10-09")
    s3io.put_parquet(key, df)
    back = s3io.get_parquet(key)
    assert list(back.columns) == ["location_id", "pm25"]
    assert back["pm25"].tolist() == [31.0, 44.5]


def test_presign_returns_local_uri():
    key = s3io.key_outputs_summary("2026-10-09T00Z")
    s3io.put_json(key, {"x": 1})
    url = s3io.presign(key)
    assert url.startswith("file://")
