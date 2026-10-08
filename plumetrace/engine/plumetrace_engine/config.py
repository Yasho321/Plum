"""
OWNER    : Yasho1
DUE      : D1 12:00
TASK     :
  Every ASSUMPTION parameter from brief §10/§12/§13 in one frozen dataclass, overridable by env var PT_<NAME>:
  AOI (73.5,27.5,78.0,32.7), NCR receptor box (76.8–77.6, 28.3–28.95), H3 res 7/5, back-traj hours 48, transport rule (mean 925hPa+10m; 10m only if HPBL<300),
  ensemble offsets ±0.1° 3x3, perturb ±10 % speed ±15° dir, seed 42, σ=15 km, cutoff 50 km, w_time 12 h, τ=24 h, fire persistence 0.8/day,
  IDW power 2 / 6 nearest / 25 km, gov thresholds (fire share 0.20, max pm25 250), severe=250.
DONE WHEN: No magic numbers anywhere else in engine/.
GUIDE    : docs/team/YASHO1.md  |  brief: docs/PROJECT_BRIEF.md
STATUS   : DONE
"""

from __future__ import annotations

import os
from dataclasses import dataclass, field, fields
from functools import lru_cache
from typing import Tuple

# Single source for the region geometry (brief §6.1). Tejas owns common/aoi.py;
# we import the boxes here instead of re-declaring the numbers (HANDOFF #12,
# no-magic-numbers rule). These feed the dataclass defaults below.
from plumetrace_engine.common.aoi import (
    AOI as _AOI,
    GFS_CROP_MARGIN_DEG as _CROP_MARGIN,
    NCR_RECEPTOR as _NCR,
)

# ----------------------------------------------------------------------------
# The single home for every tunable number in the engine (brief §10/§12/§13).
# Rule (CLAUDE.md): no magic numbers anywhere else in engine/ — import from here.
#
# Every scalar/bool/str field can be overridden at runtime by an env var named
# PT_<FIELDNAME-UPPERCASED>, e.g. PT_SIGMA_KM=20, PT_TRANSPORT_MODE=10m_only.
# Tuple fields (the bounding boxes) are overridden with a comma-separated string,
# e.g. PT_AOI="73.5,27.5,78.0,32.7". This lets the backtest sweep parameters and
# lets a Lambda be reconfigured without a code change.
# ----------------------------------------------------------------------------


@dataclass(frozen=True)
class Config:
    # --- Area of interest (brief §6.1) : (west, south, east, north), WGS84 ---
    # Imported from common/aoi.py so there is one source of these numbers.
    aoi: Tuple[float, float, float, float] = _AOI.as_wsen()
    # Margin (degrees) added around the AOI before a trajectory is killed (§10.1);
    # same 1° the GFS crop uses (brief §6.3), so we reuse that constant.
    aoi_margin_deg: float = _CROP_MARGIN
    # --- Delhi-NCR receptor box : (west, south, east, north) (brief §6.1) ---
    ncr_box: Tuple[float, float, float, float] = _NCR.as_wsen()

    # --- H3 grid (brief §7) ---
    h3_res_fine: int = 7      # ~5.2 km^2 cells, the forecast grid
    h3_res_coarse: int = 5    # coarse map aggregation

    # --- Back-trajectories (brief §10.1) ---
    backtrack_hours: int = 48           # trace 48 h backwards
    backtrack_step_s: int = 3600        # hourly step, seconds
    forecast_leads: int = 72            # produce valid hours 0..72
    # Transport wind rule. "mean_925_10m" = 0.5*(925 hPa + 10 m);
    # below hpbl_shallow_m use 10 m only. "10m_only" / "925_only" force a level.
    transport_mode: str = "mean_925_10m"
    hpbl_shallow_m: float = 300.0       # below this, use the 10 m wind only
    earth_radius_m: float = 6_371_000.0
    # metres per degree of latitude (constant; longitude scales by cos(lat))
    m_per_deg_lat: float = 111_320.0

    # --- Trajectory ensemble for uncertainty (brief §10.1) ---
    ensemble_grid: int = 3              # 3x3 start points => 9 members
    ensemble_offset_deg: float = 0.1    # +/- 0.1 deg start offsets
    perturb_speed_frac: float = 0.10    # +/- 10 % wind speed
    perturb_dir_deg: float = 15.0       # +/- 15 deg wind direction
    seed: int = 42                      # fixed RNG seed (reproducible spread)

    # --- Fire load weighting (brief §10.2) ---
    sigma_km: float = 15.0              # gaussian spatial scale
    cutoff_km: float = 50.0             # ignore fires beyond this
    w_time_hours: float = 12.0          # |t_fire - t_parcel| window
    tau_age_hours: float = 24.0         # age decay time constant
    fire_persist_decay_per_day: float = 0.8  # future-fire persistence scaling

    # --- IDW gridding to H3 (brief §10.6) ---
    idw_power: float = 2.0
    idw_max_neighbours: int = 6
    idw_max_km: float = 25.0

    # --- Hotspot ranking (brief §12.1) ---
    hotspot_top_districts: int = 5
    dbscan_eps_km: float = 2.0
    dbscan_min_samples: int = 3

    # --- Government auto-draft thresholds (brief §8.3, ASSUMPTION) ---
    gov_fire_share_threshold: float = 0.20
    gov_max_pm25_threshold: float = 250.0

    # --- PM2.5 categories (brief §14, India NAQI) ---
    severe_pm25: float = 250.0          # "Severe" threshold, µg/m³

    # --- QC bounds for PM2.5 observations (brief §6.5) ---
    pm25_min: float = 0.0
    pm25_max: float = 1500.0
    stuck_sensor_hours: int = 6

    # --- Skill metric lead buckets (brief §10.8), hours [lo, hi) ---
    lead_buckets: Tuple[Tuple[int, int], ...] = ((0, 6), (6, 24), (24, 48), (48, 72))
    skill_band_target_coverage: float = 0.80

    # --- Time zone offset for IST display/text (brief §7), minutes ---
    ist_offset_min: int = 330

    # ------------------------------------------------------------------ #
    @property
    def n_members(self) -> int:
        """Number of trajectory ensemble members (grid^2)."""
        return self.ensemble_grid * self.ensemble_grid

    @property
    def sigma_m(self) -> float:
        return self.sigma_km * 1000.0

    @property
    def cutoff_m(self) -> float:
        return self.cutoff_km * 1000.0

    def lon_lat_centre(self) -> Tuple[float, float]:
        """Centre of the AOI (lon, lat) — used for the local equidistant projection."""
        w, s, e, n = self.aoi
        return (0.5 * (w + e), 0.5 * (s + n))


# ---------------------------------------------------------------------------
# Env-var overrides. We coerce to the field's declared type. Tuples come in as
# comma-separated numbers and keep their arity.
# ---------------------------------------------------------------------------
def _coerce(raw: str, default):
    if isinstance(default, bool):
        return raw.strip().lower() in ("1", "true", "yes", "on")
    if isinstance(default, tuple):
        parts = [p for p in raw.replace(";", ",").split(",") if p.strip() != ""]
        # tuple-of-tuples (lead_buckets) is not env-overridable; guard against it
        if default and isinstance(default[0], tuple):
            raise ValueError("tuple-of-tuples fields cannot be set via env var")
        nums = [float(p) if ("." in p or "e" in p.lower()) else int(p) for p in parts]
        return tuple(nums)
    if isinstance(default, int):
        return int(raw)
    if isinstance(default, float):
        return float(raw)
    return raw  # str


@lru_cache(maxsize=1)
def load_config() -> Config:
    """Build the Config, applying any PT_<FIELD> env overrides. Cached per process."""
    overrides = {}
    for f in fields(Config):
        env_key = "PT_" + f.name.upper()
        if env_key in os.environ:
            default = getattr(Config, f.name, None)
            if default is None:  # dataclass default lives on the field
                default = f.default
            try:
                overrides[f.name] = _coerce(os.environ[env_key], default)
            except Exception as exc:  # noqa: BLE001 - fail loud, this is config
                raise ValueError(f"bad value for {env_key}={os.environ[env_key]!r}: {exc}") from exc
    return Config(**overrides)


# Convenience singleton. Import as: from plumetrace_engine.config import CONFIG
CONFIG = load_config()
