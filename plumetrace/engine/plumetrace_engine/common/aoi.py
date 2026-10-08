"""
OWNER    : Tejas
DUE      : D1 12:00
TASK     :
  Area-of-interest geometry shared by ingest and gridding: the study bbox (brief §6.1),
  the Delhi-NCR receptor box, the GFS crop margin, and pure helpers (contains / in_aoi /
  is_ncr_receptor / expand / bbox strings for the FIRMS + OpenAQ URLs).
DONE WHEN: `python -m pytest tests/engine/test_aoi.py` passes.
GUIDE    : docs/team/TEJAS.md  |  brief: docs/PROJECT_BRIEF.md
STATUS   : DONE

Coordinates follow brief §7: GeoJSON is [lon, lat]; function args are (lat, lon).
A Bbox is (west, south, east, north) in degrees (WGS84).

NOTE for Yasho1: these region constants live here (the geometry module) as the single
source. Please import AOI / NCR_RECEPTOR / GFS_CROP_MARGIN_DEG from this module in
engine/config.py instead of re-declaring the numbers (see docs/HANDOFFS.md).
"""
from __future__ import annotations

from dataclasses import dataclass


@dataclass(frozen=True)
class Bbox:
    west: float
    south: float
    east: float
    north: float

    def contains(self, lat: float, lon: float) -> bool:
        """Inclusive membership test. Args are (lat, lon) per brief §7."""
        return self.west <= lon <= self.east and self.south <= lat <= self.north

    def expand(self, deg: float) -> "Bbox":
        """Grow the box by ``deg`` degrees on every side (clamped to valid lat/lon)."""
        return Bbox(
            west=max(-180.0, self.west - deg),
            south=max(-90.0, self.south - deg),
            east=min(180.0, self.east + deg),
            north=min(90.0, self.north + deg),
        )

    def as_wsen(self) -> tuple[float, float, float, float]:
        return (self.west, self.south, self.east, self.north)

    def wsen_str(self) -> str:
        """`W,S,E,N` string for the FIRMS area API and OpenAQ bbox param (brief §6.2/§6.5)."""
        def fmt(x: float) -> str:
            return f"{x:g}"
        return ",".join(fmt(v) for v in self.as_wsen())


# --- Region definitions (brief §6.1 / §6.3) -----------------------------------
# Study area: covers Punjab, Haryana, Delhi and western UP.
AOI = Bbox(west=73.5, south=27.5, east=78.0, north=32.7)

# Delhi-NCR receptor box: OpenAQ locations inside it that report PM2.5 are receptors.
NCR_RECEPTOR = Bbox(west=76.8, south=28.3, east=77.6, north=28.95)

# GFS fields are cropped to the AOI plus this margin before saving (brief §6.3).
GFS_CROP_MARGIN_DEG = 1.0
AOI_GFS_CROP = AOI.expand(GFS_CROP_MARGIN_DEG)  # ≈ (72.5, 26.5, 79.0, 33.7)


# --- Convenience wrappers ------------------------------------------------------
def in_aoi(lat: float, lon: float) -> bool:
    return AOI.contains(lat, lon)


def is_ncr_receptor(lat: float, lon: float) -> bool:
    return NCR_RECEPTOR.contains(lat, lon)


def firms_bbox_str() -> str:
    return AOI.wsen_str()


def openaq_bbox_str() -> str:
    return AOI.wsen_str()
