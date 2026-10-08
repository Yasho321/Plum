# engine/ — PlumeTrace forecasting engine

> OWNER: Yasho1 (science) + Tejas (ingest, common, handlers, Dockerfile). Brief §9, §10.

The engine turns fires + winds + ground PM2.5 into a source-attributed 0–72 h PM2.5 forecast on an H3 grid.
It is plain Python (NumPy / xarray / SciPy / LightGBM / h3 / shapely) — no HYSPLIT, no chemical-transport model.

## Pipeline (brief §9)

```
resolve_run → ingest(FIRMS, GFS, OpenAQ) → trajectories → fire_load → build_features
            → forecast (LightGBM q10/q50/q90) → attribution (counterfactual fire share)
            → gridding (IDW → H3) → summarize → publish(forecast.published)   ;  verify (hourly)
```

## Module map

| Module | Owner | What it does |
|---|---|---|
| `config.py` | Yasho1 | **Every ASSUMPTION parameter** (brief §10/§12/§13), overridable by `PT_<NAME>` env vars. No magic numbers live anywhere else. |
| `trajectories/winds.py` | Yasho1 | `WindField`: pointwise bilinear-in-space / linear-in-time wind sampling; transport-level rule. `constant_wind_field()` for tests/dev. |
| `trajectories/backtrack.py` | Yasho1 | 48 h vectorised backward tracing (per-parcel release times, optional wind perturbation, AOI clipping). |
| `trajectories/ensemble.py` | Yasho1 | 9-member 3×3 ensemble for all stations × valid hours in one batch; central-member `trajectories.geojson` for the map. |
| `features/districts.py` | Yasho1 | STRtree point-in-polygon → district name per fire. |
| `features/fire_load.py` | Yasho1 | §10.2 fire load (gaussian/time/age weights via cKDTree), per-district split, future-fire persistence, `fires_48h.geojson`. |
| `features/build_features.py` | Yasho1 | §10.3 feature table (one row per station × lead); **shared by training and live** (no skew). |
| `model/infer.py` | Yasho1 | LightGBM quantile loader (crossing fix) + `persistence-v0` fallback so the pipeline never blocks on training. |
| `model/attribution.py` | Yasho1 | §10.5 counterfactual fire share (p10/p50/p90), district split, per-date Attribution rows. |
| `gridding/idw_h3.py` | Yasho1 | §10.6 IDW from stations → H3 res-7 cells; null beyond 25 km; Forecast items + `pm25_h3_<hour>.geojson`. |
| `hotspots/rank.py` | Yasho1 | §12.1 district priority + haversine-DBSCAN village clusters. |
| `publish/summarize.py` | Yasho1 | `summary.json` (validates against `contracts.RunSummary`). |
| `verify/skill.py` | Yasho1 | §10.8 metrics by lead bucket (MAE/RMSE/coverage/skill-vs-persistence/severe hit rate). |
| `verify/fill_obs.py` | Yasho1 | Backfills `obs_pm25` into StationForecast once a valid hour has passed. |
| `ingest/*`, `common/*`, `handlers.py`, `Dockerfile` | **Tejas** | Data feeds, S3/DynamoDB I/O, Step Functions entrypoints, the container. |

## Design rules

- **I/O lives at the edges.** The science functions take plain objects (a `WindField`, a fires `DataFrame`,
  a feature `DataFrame`) and return `DataFrame`s / dicts. `handlers.py` (Tejas) wires them to S3/DynamoDB via
  `common/s3io.py` and `common/ddb.py`. This is why the whole engine is unit-testable with no AWS.
- **One feature builder.** `build_features.build_features(...)` is called by both the live pipeline and
  `training/build_training_set.py`. The only difference is the `WindField` source (GFS live vs ERA5 training).
- **All ASSUMPTIONs in `config.py`.** Tune via `PT_SIGMA_KM=20`, `PT_TRANSPORT_MODE=10m_only`, etc. The backtest
  sweeps parameters this way.

## Run locally (no AWS)

```bash
cd engine
python -m venv .venv && . .venv/Scripts/activate        # Windows: .venv\Scripts\activate
pip install -r requirements.txt                          # cfgrib/eccodes only needed to read real GRIB
# unit tests (trajectory, fire load, fire share) — from the repo root:
cd .. && pytest tests/engine -q
```
`PT_LOCAL=1` makes `common/s3io.py` read/write `./.local-s3/<key>` instead of S3, so the whole pipeline runs
offline once Tejas's `common/` and a sample GFS run are in place (`scripts/run_engine_local.sh <run_id>`).

## Known limitations (state these in the pitch — brief §2.4, §6)

- **FIRMS is a lower bound.** VIIRS overpasses (~13:30 / 01:30 local) miss late-afternoon fires and fires under
  cloud/haze. FRP is a relative index, not an absolute emission.
- **Future fires = persistence.** Beyond the latest detection we repeat the last-24 h fires scaled ×0.8/day
  (`config.fire_persist_decay_per_day`). This is the single biggest forecast uncertainty.
- **Trajectories are kinematic.** A simple back-trajectory on a mean transport wind, not full dispersion.
- **Backtest skill is optimistic.** Training uses ERA5 reanalysis; live uses GFS forecasts. The Skill page
  reports backtest and live **separately** for this reason (§6.4).
- **Attribution is an estimate with a range.** Always shown as p10–p90, never a verdict (§2.4).
