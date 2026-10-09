"""
OWNER    : Tejas
DUE      : D1 20:00
TASK     :
  Pure-helper tests for training/backfill: FIRMS season chunking, OpenAQ archive prefix/
  months, ERA5 Magnus RH + lon normalisation + key builders.
DONE WHEN: `python -m pytest tests/engine/test_backfill.py` passes.
GUIDE    : docs/team/TEJAS.md  |  brief: docs/PROJECT_BRIEF.md
STATUS   : DONE
"""
import os
import sys

_ENGINE = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", "..", "engine"))
_TRAIN = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", ".."))
for p in (_ENGINE, _TRAIN):
    if p not in sys.path:
        sys.path.insert(0, p)

from training.backfill import firms_archive, openaq_archive, era5  # noqa: E402


def test_firms_season_is_61_days_and_chunks_cover_it():
    days = firms_archive.season_days(2024)
    assert len(days) == 61  # Oct 1 .. Nov 30
    chunks = firms_archive.season_chunks(2024, max_range=5)
    assert sum(n for _s, n in chunks) == 61
    assert all(n <= 5 for _s, n in chunks)
    assert chunks[0] == ("2024-10-01", 5)


def test_openaq_archive_prefix_and_months():
    assert openaq_archive.archive_prefix(2178, 2024, 11) == "records/csv.gz/locationid=2178/year=2024/month=11/"
    assert openaq_archive.months() == [(2024, 10), (2024, 11), (2025, 10), (2025, 11)]


def test_era5_magnus_rh():
    # saturated air: T == Td -> 100 %
    assert era5.rh_from_t2d(290.0, 290.0) == 100.0
    # drier: dewpoint below temp -> < 100 %
    rh = era5.rh_from_t2d(300.0, 285.0)
    assert 0.0 < rh < 100.0


def test_era5_lon_normalisation():
    assert era5.normalize_lon(350.0) == -10.0
    assert era5.normalize_lon(77.0) == 77.0


def test_era5_key_builders():
    assert era5.sfc_key(2024, 11, "128_165_10u") == \
        "e5.oper.an.sfc/202411/e5.oper.an.sfc.128_165_10u.ll025sc.2024110100_2024113023.nc"
    assert era5.pl_key(__import__("datetime").date(2024, 11, 1), "128_131_u") == \
        "e5.oper.an.pl/202411/e5.oper.an.pl.128_131_u.ll025uv.2024110100_2024110123.nc"


def test_era5_contract_vars_match_gfs():
    from plumetrace_engine.ingest import gfs
    assert era5.CONTRACT_VARS == gfs.CONTRACT_VARS
