"""
OWNER    : Yasho1
DUE      : D1 16:00
TASK     :
  Mandatory: constant 10 m/s westerly for 48 h -> parcel 1728 km west (± tolerance, cos(lat) aware); zero wind -> stays put.
DONE WHEN: -
GUIDE    : docs/team/YASHO1.md  |  brief: docs/PROJECT_BRIEF.md
STATUS   : DONE
"""

import dataclasses

import numpy as np

from plumetrace_engine.config import CONFIG
from plumetrace_engine.trajectories.backtrack import back_track

# A deliberately huge AOI so long constant-wind runs are never clipped. The
# kill box in back_track is config-driven (correct behaviour), so distance
# tests must widen it rather than rely on the wind grid's extent.
WIDE = dataclasses.replace(CONFIG, aoi=(20.0, 0.0, 120.0, 60.0), aoi_margin_deg=1.0)


def _haversine_km(lat1, lon1, lat2, lon2):
    R = 6371.0
    p1, p2 = np.radians(lat1), np.radians(lat2)
    dphi = np.radians(lat2 - lat1)
    dlmb = np.radians(lon2 - lon1)
    a = np.sin(dphi / 2) ** 2 + np.cos(p1) * np.cos(p2) * np.sin(dlmb / 2) ** 2
    return 2 * R * np.arcsin(np.sqrt(a))


def test_zero_wind_parcel_stays_put(constant_wind):
    wind = constant_wind(0.0, 0.0)
    traj = back_track([30.0], [76.0], "2026-10-09T00:00:00", wind)
    assert np.allclose(traj.lat, 30.0)
    assert np.allclose(traj.lon, 76.0)
    assert traj.alive.all()


def test_constant_westerly_moves_parcel_west_expected_distance(constant_wind):
    # A 10 m/s WESTERLY wind blows FROM the west (towards +x / east), u=+10.
    # Back-tracking subtracts the displacement, so the parcel's history lies to
    # the WEST of the release point. Over 48 h: 10 m/s * 48*3600 s = 1,728 km.
    u = 10.0
    wind = constant_wind(u, 0.0, aoi=WIDE.aoi, config=WIDE)  # wide grid so it stays alive
    start_lat, start_lon = 30.0, 76.0
    traj = back_track([start_lat], [start_lon], "2026-10-09T00:00:00", wind, config=WIDE)

    assert traj.alive.all(), "parcel should remain inside the wide AOI"
    # latitude unchanged (no v), longitude decreased (moved west)
    assert np.isclose(traj.lat[0, -1], start_lat, atol=1e-6)
    assert traj.lon[0, -1] < start_lon

    expected_km = u * CONFIG.backtrack_hours * CONFIG.backtrack_step_s / 1000.0  # 1728
    got_km = _haversine_km(start_lat, start_lon, traj.lat[0, -1], traj.lon[0, -1])
    # within 2 % — small error from the flat-earth lon step vs haversine
    assert abs(got_km - expected_km) / expected_km < 0.02, (got_km, expected_km)


def test_southerly_moves_parcel_south(constant_wind):
    # v=+10 (southerly, blowing north); back-track history is to the SOUTH.
    wind = constant_wind(0.0, 10.0, aoi=WIDE.aoi, config=WIDE)
    traj = back_track([30.0], [76.0], "2026-10-09T00:00:00", wind, config=WIDE)
    assert traj.lat[0, -1] < 30.0
    assert np.isclose(traj.lon[0, -1], 76.0, atol=1e-6)


def test_parcel_dies_when_leaving_aoi(constant_wind):
    # Narrow AOI + strong wind -> the parcel leaves and freezes.
    wind = constant_wind(20.0, 0.0, aoi=CONFIG.aoi)
    traj = back_track([28.6], [77.2], "2026-10-09T00:00:00", wind)
    assert not traj.alive[0, -1]
    # once dead, the position is frozen (no further movement)
    dead_from = np.argmin(traj.alive[0])
    assert np.allclose(traj.lon[0, dead_from:], traj.lon[0, dead_from])
