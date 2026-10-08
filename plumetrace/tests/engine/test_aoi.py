"""
OWNER    : Tejas
DUE      : D1 12:00
TASK     :
  Tests for engine/plumetrace_engine/common/aoi.py (membership, expand, bbox strings).
DONE WHEN: `python -m pytest tests/engine/test_aoi.py` passes.
GUIDE    : docs/team/TEJAS.md  |  brief: docs/PROJECT_BRIEF.md
STATUS   : DONE
"""
import os
import sys

_ENGINE = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", "..", "engine"))
if _ENGINE not in sys.path:
    sys.path.insert(0, _ENGINE)

from plumetrace_engine.common import aoi  # noqa: E402


def test_aoi_contains_delhi_and_excludes_mumbai():
    # Delhi ~ (28.61, 77.21) is inside the AOI; Mumbai ~ (19.07, 72.88) is not.
    assert aoi.in_aoi(28.61, 77.21)
    assert not aoi.in_aoi(19.07, 72.88)


def test_ncr_receptor_box():
    assert aoi.is_ncr_receptor(28.61, 77.21)           # central Delhi
    assert not aoi.is_ncr_receptor(30.90, 75.85)       # Ludhiana, Punjab — a source, not a receptor
    # receptor box is a strict subset of the AOI
    r, a = aoi.NCR_RECEPTOR, aoi.AOI
    assert a.west <= r.west and r.east <= a.east and a.south <= r.south and r.north <= a.north


def test_gfs_crop_margin():
    c = aoi.AOI_GFS_CROP
    assert (c.west, c.south, c.east, c.north) == (72.5, 26.5, 79.0, 33.7)


def test_bbox_strings_for_apis():
    assert aoi.firms_bbox_str() == "73.5,27.5,78,32.7"
    assert aoi.openaq_bbox_str() == "73.5,27.5,78,32.7"


def test_contains_is_inclusive_on_edges():
    assert aoi.AOI.contains(aoi.AOI.south, aoi.AOI.west)
    assert aoi.AOI.contains(aoi.AOI.north, aoi.AOI.east)
