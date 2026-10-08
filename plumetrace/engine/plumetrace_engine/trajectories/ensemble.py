"""
OWNER    : Yasho1
DUE      : D1 20:00
TASK     :
  9-member ensemble per (receptor, T): 3x3 start offsets ±0.1° + per-member speed (±10 %) / direction (±15°) perturbation, seed from config. Run all receptors x valid hours 0..72 in one vectorised batch. Write outputs/run=<run_id>/trajectories.geojson (central member, LineString [lon,lat] + timestamps[] epoch s, props station_id, valid_hour) for the TripsLayer.
DONE WHEN: ~25 stations x 73 h x 9 members finishes in < 2 min on Lambda.
GUIDE    : docs/team/YASHO1.md  |  brief: docs/PROJECT_BRIEF.md
STATUS   : DONE
"""

from __future__ import annotations

from dataclasses import dataclass
from typing import Callable, Optional, Sequence

import numpy as np
import pandas as pd

from plumetrace_engine.config import CONFIG, Config
from plumetrace_engine.trajectories.backtrack import BackTrajectories, back_track
from plumetrace_engine.trajectories.winds import WindField

CENTER_MEMBER = 4  # index of the (0,0)-offset, unperturbed member in the 3x3 grid


@dataclass
class TrajectorySet:
    """All ensemble trajectories for a run, flattened to N parcels.

    Each parcel is one (station_id, valid_hour, member) back-trajectory. The
    per-parcel metadata arrays let fire_load group members to a p10/p50/p90
    spread per (station, valid_hour).
    """

    traj: BackTrajectories
    station_id: np.ndarray   # (N,) object
    valid_hour: np.ndarray   # (N,) datetime64[ns] (release time)
    lead_h: np.ndarray       # (N,) int
    member: np.ndarray       # (N,) int 0..8
    config: Config

    @property
    def n(self) -> int:
        return self.traj.n

    def central_mask(self) -> np.ndarray:
        return self.member == CENTER_MEMBER


def _member_offsets(cfg: Config):
    """Return (d_lat[9], d_lon[9]) start offsets for the 3x3 grid."""
    off = cfg.ensemble_offset_deg
    steps = np.linspace(-off, off, cfg.ensemble_grid)  # [-off, 0, +off]
    dlat, dlon = [], []
    for di in steps:
        for dj in steps:
            dlat.append(di)
            dlon.append(dj)
    return np.array(dlat), np.array(dlon)


def _member_perturbations(cfg: Config):
    """Deterministic per-member (speed_factor, rot_rad). The central member is
    left unperturbed so the map/central trajectory is the plain best estimate."""
    rng = np.random.default_rng(cfg.seed)
    n = cfg.n_members
    speed = rng.uniform(1 - cfg.perturb_speed_frac, 1 + cfg.perturb_speed_frac, n)
    rot = np.radians(rng.uniform(-cfg.perturb_dir_deg, cfg.perturb_dir_deg, n))
    speed[CENTER_MEMBER] = 1.0
    rot[CENTER_MEMBER] = 0.0
    return speed, rot


def run_trajectories(
    run_id: str,
    stations: Sequence[dict],
    winds: WindField,
    issue_time,
    config: Config = CONFIG,
    *,
    write_geojson: Optional[Callable[[dict], None]] = None,
    leads: Optional[int] = None,
) -> TrajectorySet:
    """Build the full ensemble for every station x valid hour x member.

    Parameters
    ----------
    stations     : list of {station_id, lat, lon}
    winds        : WindField covering issue_time-48h .. issue_time+leads h
    issue_time   : the run issue time T0 (UTC); valid hours are T0 + 0..leads h
    write_geojson: optional sink for the central-member trajectories.geojson dict
    """
    cfg = config
    leads = cfg.forecast_leads if leads is None else leads
    T0 = pd.to_datetime(issue_time)

    dlat, dlon = _member_offsets(cfg)
    speed_m, rot_m = _member_perturbations(cfg)
    m_idx = np.arange(cfg.n_members)

    valid_hours = [T0 + pd.Timedelta(hours=h) for h in range(leads + 1)]

    s_lat, s_lon, s_id, s_vh, s_lead, s_mem, s_sf, s_rot = ([] for _ in range(8))
    for st in stations:
        for h, vh in enumerate(valid_hours):
            s_lat.append(st["lat"] + dlat)
            s_lon.append(st["lon"] + dlon)
            s_id.append(np.full(cfg.n_members, st["station_id"], dtype=object))
            s_vh.append(np.full(cfg.n_members, np.datetime64(vh.to_datetime64())))
            s_lead.append(np.full(cfg.n_members, h, dtype="int32"))
            s_mem.append(m_idx.copy())
            s_sf.append(speed_m.copy())
            s_rot.append(rot_m.copy())

    start_lat = np.concatenate(s_lat)
    start_lon = np.concatenate(s_lon)
    station_id = np.concatenate(s_id)
    valid_hour = np.concatenate(s_vh)
    lead_h = np.concatenate(s_lead)
    member = np.concatenate(s_mem)
    speed_factor = np.concatenate(s_sf)
    rot_rad = np.concatenate(s_rot)

    traj = back_track(
        start_lat, start_lon, valid_hour, winds, config=cfg,
        speed_factor=speed_factor, rot_rad=rot_rad,
    )
    tset = TrajectorySet(
        traj=traj, station_id=station_id, valid_hour=valid_hour,
        lead_h=lead_h, member=member, config=cfg,
    )

    if write_geojson is not None:
        write_geojson(to_trajectories_geojson(tset))
    return tset


def to_trajectories_geojson(tset: TrajectorySet) -> dict:
    """Central-member LineStrings with per-vertex epoch-second timestamps,
    for deck.gl TripsLayer. Only the alive portion of each path is emitted."""
    t = tset.traj
    mask = np.where(tset.central_mask())[0]
    features = []
    # epoch seconds for timestamps[]
    epoch = t.times.astype("datetime64[s]").astype("int64")
    for i in mask:
        alive = t.alive[i]
        k = int(alive.sum())
        if k < 2:
            continue
        coords = [[float(t.lon[i, j]), float(t.lat[i, j])] for j in range(k)]
        ts = [int(epoch[i, j]) for j in range(k)]
        vh = pd.Timestamp(tset.valid_hour[i]).strftime("%Y-%m-%dT%H:%M:%SZ")
        features.append({
            "type": "Feature",
            "geometry": {"type": "LineString", "coordinates": coords},
            "properties": {
                "station_id": str(tset.station_id[i]),
                "valid_hour": vh,
                "lead_h": int(tset.lead_h[i]),
                "timestamps": ts,
            },
        })
    return {"type": "FeatureCollection", "features": features}
