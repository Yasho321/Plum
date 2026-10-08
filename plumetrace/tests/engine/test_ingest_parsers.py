"""
OWNER    : Tejas
DUE      : D1 16:00
TASK     :
  GFS .idx parsing -> byte ranges; FIRMS de-dup + confidence filter on a fixture CSV; OpenAQ stuck-sensor QC.
DONE WHEN: `python -m pytest tests/engine/test_ingest_parsers.py` passes.
GUIDE    : docs/team/TEJAS.md  |  brief: docs/PROJECT_BRIEF.md
STATUS   : DONE
"""
import os
import sys
from datetime import datetime, timezone

import pytest

_ENGINE = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", "..", "engine"))
if _ENGINE not in sys.path:
    sys.path.insert(0, _ENGINE)

from plumetrace_engine.ingest import gfs, firms, openaq, resolve_run  # noqa: E402


# --------------------------------------------------------------------------- GFS idx

IDX = """\
1:0:d=2026100900:PRES:surface:anl:
2:100:d=2026100900:HPBL:surface:anl:
3:200:d=2026100900:TMP:2 m above ground:anl:
4:300:d=2026100900:RH:2 m above ground:anl:
5:400:d=2026100900:UGRD:10 m above ground:anl:
6:500:d=2026100900:VGRD:10 m above ground:anl:
7:600:d=2026100900:UGRD:925 mb:anl:
8:700:d=2026100900:VGRD:925 mb:anl:
9:800:d=2026100900:UGRD:850 mb:anl:
10:900:d=2026100900:VGRD:850 mb:anl:
11:1000:d=2026100900:TMP:surface:anl:
"""


def test_parse_idx_computes_inclusive_ends():
    recs = gfs.parse_idx(IDX)
    assert len(recs) == 11
    assert recs[1].var == "HPBL" and recs[1].offset == 100 and recs[1].end == 199
    assert recs[-1].end is None  # last record is open-ended


def test_wanted_ranges_selects_the_nine_contract_records():
    ranges = gfs.wanted_ranges(gfs.parse_idx(IDX))
    by_name = {name: (start, end) for name, start, end in ranges}
    assert set(by_name) == set(gfs.CONTRACT_VARS)
    assert by_name["hpbl"] == (100, 199)
    assert by_name["t2m"] == (200, 299)
    assert by_name["u10"] == (400, 499)
    assert by_name["v850"] == (900, 999)


def test_range_header():
    assert gfs.range_header(400, 499) == "bytes=400-499"
    assert gfs.range_header(1000, None) == "bytes=1000-"


def test_gfs_base_url():
    url = gfs.gfs_base_url("2026-10-09T00Z", 72)
    assert url.endswith("/gfs.20261009/00/atmos/gfs.t00z.pgrb2.0p25.f072")


# --------------------------------------------------------------------------- FIRMS

FIRMS_CSV = """\
latitude,longitude,frp,acq_date,acq_time,satellite,confidence,daynight
30.5,75.5,12.3,2026-10-09,130,N,n,N
30.5,75.5,12.3,2026-10-09,130,N,n,N
31.1,76.2,5.0,2026-10-09,2045,1,l,N
30.9,75.9,40.0,2026-10-09,2045,1,h,N
"""


def test_firms_confidence_filter_and_dedup():
    df = firms.parse_firms_csv(FIRMS_CSV, source="VIIRS_SNPP_NRT")
    # low-confidence row dropped: 3 rows remain (incl. the duplicate pair)
    assert len(df) == 3
    assert (df["confidence"].str.lower() != "l").all()
    deduped = firms.dedup(df)
    assert len(deduped) == 2  # the identical pair collapses to one


def test_firms_acq_ts_zero_pads_time():
    assert firms.acq_ts("2026-10-09", 130) == "2026-10-09T01:30Z"
    assert firms.acq_ts("2026-10-09", 2045) == "2026-10-09T20:45Z"


# --------------------------------------------------------------------------- OpenAQ QC

def test_openaq_value_range_qc():
    pd = pytest.importorskip("pandas")
    df = pd.DataFrame(
        {
            "location_id": [1, 1, 1],
            "ts_utc": ["2026-10-09T00:00Z", "2026-10-09T01:00Z", "2026-10-09T02:00Z"],
            "pm25": [-5.0, 42.0, 2000.0],
        }
    )
    out = openaq.qc_values(df)
    assert out["pm25"].tolist() == [42.0]


def test_openaq_drops_stuck_sensor():
    pd = pytest.importorskip("pandas")
    ts = [f"2026-10-09T{h:02d}:00Z" for h in range(8)]
    # location 1: six identical values (stuck, dropped) then two varying (kept)
    # location 2: all varying (kept)
    df = pd.DataFrame(
        {
            "location_id": [1] * 8 + [2] * 3,
            "ts_utc": ts + ts[:3],
            "pm25": [50.0] * 6 + [51.0, 52.0] + [10.0, 11.0, 12.0],
        }
    )
    out = openaq.qc(df)
    loc1 = out[out["location_id"] == 1]["pm25"].tolist()
    loc2 = out[out["location_id"] == 2]["pm25"].tolist()
    assert loc1 == [51.0, 52.0]          # the 6-hour stuck run removed
    assert loc2 == [10.0, 11.0, 12.0]    # untouched


def test_openaq_receptor_classification():
    assert openaq.is_receptor(28.61, 77.21)       # Delhi
    assert not openaq.is_receptor(30.90, 75.85)    # Ludhiana


# --------------------------------------------------------------------------- resolve_run

def test_candidate_cycles_are_newest_first_on_six_hour_grid():
    now = datetime(2026, 10, 9, 3, 0, tzinfo=timezone.utc)  # 03:00 UTC
    cycles = resolve_run.candidate_cycles(now, max_back_cycles=4)
    assert cycles == ["2026-10-09T00Z", "2026-10-08T18Z", "2026-10-08T12Z", "2026-10-08T06Z"]


def test_f072_idx_key():
    assert resolve_run.f072_idx_key("2026-10-08T18Z") == "gfs.20261008/18/atmos/gfs.t18z.pgrb2.0p25.f072.idx"
