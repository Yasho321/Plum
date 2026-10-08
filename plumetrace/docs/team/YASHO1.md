# YASHO1: Science Engine Lead (Python)

> **For the AI agent:** you work for **Yasho1**. Follow `CLAUDE.md` rules. Work through the task list below in order of `DUE`.
> Edit only files whose header says `OWNER : Yasho1`. Mark the header `STATUS` as WIP/DONE as you go.

## 1. Mission
Build the forecasting brain of PlumeTrace. It traces air backwards from every Delhi-NCR station and measures how much
fire smoke the air passed over. It then trains and runs LightGBM quantile models to forecast PM2.5 for 0–72 h with
p10/p50/p90, estimates **what share comes from crop fires and from which districts** (counterfactual), grids the result
onto H3 and measures how good the forecast is. Everything else in the product displays or acts on your numbers.
**Your work is the critical path.**

## 2. Read first
Brief §6.1–6.5 (data), **§7 (conventions)**, **§10 (all of it; implement exactly this)**, §12.1 (hotspot ranking), §8.1–8.2 (where outputs go), §17 AC1/AC3/AC4, §21 mandatory tests. Also docs/DECISIONS.md D-08, D-10, D-12.

## 3. You own
```
engine/plumetrace_engine/config.py
engine/plumetrace_engine/trajectories/*      winds, backtrack, ensemble
engine/plumetrace_engine/features/*          districts, fire_load, build_features
engine/plumetrace_engine/model/*             infer, attribution
engine/plumetrace_engine/hotspots/rank.py
engine/plumetrace_engine/gridding/idw_h3.py
engine/plumetrace_engine/publish/summarize.py
engine/plumetrace_engine/verify/*            fill_obs, skill
engine/requirements.txt, engine/README.md
training/build_training_set.py, train.py, backtest.py, sagemaker_job.py, requirements.txt
tests/conftest.py, tests/engine/test_trajectory.py, test_fire_load.py, test_fire_share.py
scripts/run_engine_local.sh
```
**Do not touch:** `ingest/`, `common/`, `handlers.py`, `publish/publish_event.py`, `Dockerfile` (Tejas). Ask through HANDOFFS.

## 4. Inputs you depend on (and what to do while waiting)
| Input | From | When | While waiting |
|---|---|---|---|
| GFS NetCDF `raw/gfs/run=<id>/fFFF.nc`, vars `u10 v10 u925 v925 u850 v850 hpbl t2m rh2m` | Tejas | D1 13:00 | Build `WindField` on a synthetic xarray Dataset with the same variable names, and write the tests first |
| `static/districts.geojson` (property `district`) | Khare | D1 14:00 | Use a 2-polygon fake GeoJSON |
| ERA5 / FIRMS archive / OpenAQ archive in S3 | Tejas | D1 22:00 | Finish fire_load and build_features on live data |
| `common/s3io.py` key builders and `common/ddb.py` writers | Tejas | D1 13:00 / 18:00 | Write to local parquet and swap later |
| pydantic models (`plumetrace_contracts`) | Yasho2 | D1 13:00 | — |

## 5. Outputs others depend on
| Output | Consumer | When |
|---|---|---|
| `outputs/run=<id>/trajectories.geojson` (LineString + `timestamps[]`) | Tanmay (TripsLayer), Khare (report map) | D2 17:00 |
| `outputs/run=<id>/fires_48h.geojson` | Tanmay, Khare | D2 17:00 |
| `Forecast`, `StationForecast`, `Attribution` tables | Yasho2 API, Khare dose/report | D2 17:00 |
| `outputs/run=<id>/pm25_h3_<hour>.geojson` | Tanmay | D2 17:00 |
| `summary.json` incl. `hotspot_districts`, `hotspot_villages`, `degraded` | everyone | D2 17:00 |
| `outputs/skill/backtest.json`, `latest.json` | Tanmay Skill page, agent tool | D2 12:00 / D3 13:00 |
| Python functions callable from `handlers.py` (see §7) | Tejas | D2 12:00 |

## 6. Task list
- [ ] **D1 12:00** `config.py`: every ASSUMPTION parameter, env-overridable (`PT_<NAME>`). Review the contracts at the freeze.
- [ ] **D1 15:00** `trajectories/winds.py`: `WindField`
- [ ] **D1 16:00** `trajectories/backtrack.py` + `tests/engine/test_trajectory.py` (mandatory)
- [ ] **D1 17:00** `features/districts.py`
- [ ] **D1 20:00** `trajectories/ensemble.py` + trajectories.geojson
- [ ] **D1 22:00** `features/fire_load.py` + `tests/engine/test_fire_load.py` (mandatory) + fires_48h.geojson
- [ ] **D2 02:00** `features/build_features.py`
- [ ] **D2 04:00** `training/build_training_set.py` (start it running before you sleep)
- [ ] **D2 10:00** `training/train.py`: 3 quantile models + metadata.json
- [ ] **D2 12:00** `training/backtest.py`: vs persistence and diurnal persistence, BACKTEST.md
- [ ] **D2 14:00** `model/infer.py` (with the `persistence-v0` fallback)
- [ ] **D2 15:00** `model/attribution.py` + `tests/engine/test_fire_share.py` (mandatory)
- [ ] **D2 16:00** `gridding/idw_h3.py`
- [ ] **D2 17:00** `hotspots/rank.py`, `publish/summarize.py`, `scripts/run_engine_local.sh`
- [ ] **D2 18:00 CHECKPOINT 1**: the real run replaces the mocks
- [ ] **D3 11:00** `verify/fill_obs.py`
- [ ] **D3 13:00** `verify/skill.py` (live + backtest, 4 lead buckets)
- [ ] **D3 PM** Performance: EngineRun < 15 min. Tune the ASSUMPTIONs only if the backtest supports it. Finish `engine/README.md`.

## 7. How to implement (key guidance)

**Function interfaces for Tejas's `handlers.py`.** Agree on these at D1 12:00 and keep them stable:
```python
# trajectories/ensemble.py
def run_trajectories(run_id: str, stations: list[dict], winds: "WindField") -> "TrajectorySet"   # also writes geojson
# features/fire_load.py
def compute_fire_load(traj: "TrajectorySet", fires: pd.DataFrame, issue_time) -> pd.DataFrame  # cols: station_id, valid_hour, member, fl, fl_<district>...
# model/infer.py + attribution.py
def run_forecast(run_id: str) -> dict          # writes StationForecast + Attribution, returns stats
# gridding/idw_h3.py
def run_gridding(run_id: str) -> dict          # writes Forecast + pm25_h3_*.geojson
# publish/summarize.py
def run_summarize(run_id: str, degraded: list[str]) -> dict   # writes summary.json and outputs/latest.json, returns it
# verify/*
def run_fill_obs(now) -> int ; def run_skill(days: int = 7) -> dict
```
Intermediate artefacts between Lambda steps go to S3 under `features/run=<id>/` (parquet). Never pass big payloads through Step Functions (256 KB limit).

**WindField (winds.py)**
- Open all the hours with `xr.open_mfdataset` (or concatenate) along `time`. Use `ds.interp(latitude=..., longitude=..., time=..., method="linear")` with vectorised `xr.DataArray` indexers (pointwise). That gives bilinear interpolation in space and linear in time in one call.
- Transport wind: `u = 0.5*(u925+u10)`, but where `hpbl < 300` use `u10`. Read the threshold and the mode from config.
- Past hours (back-tracking from issue time): load the f000–f005 files of the previous 2 cycles (Tejas fetches them; add a HANDOFF if they're missing) or fall back to the earliest lead available. ERA5 files use the same variable names, so training uses the same class.

**backtrack.py.** Vectorise over N parcels as NumPy arrays and loop only over the 48 steps. Use `cos(radians(lat))` with the *current* latitude. Set `alive=False` once a parcel leaves AOI ± 1°, and freeze its position.

**ensemble.py.** For each (station, T): 9 start points (3×3, ±0.1°). For each member, draw a speed factor in [0.9, 1.1] and a rotation in [−15°, +15°] with `np.random.default_rng(config.seed)`. Rotate (u, v) at each step. Batch all stations × 73 valid hours × 9 members into one array of about 17k parcels. That's fast.

**fire_load.py**
- Project lat/lon to km with a local equirectangular projection centred on the AOI (x = R·λ·cos φ0, y = R·φ). That's good enough at this scale.
- Build `cKDTree` over the fires once. For each trajectory point, `query_ball_point(r=50)`. Weights: `exp(-d²/(2·15²))`, `|t_f − t_k| ≤ 12 h`, `exp(-(T−t_k)/24)`. Sum `FRP × weights`.
- Per-district sums: groupby district code. Return FL, FL_d, and the per-ensemble FL so you get `fire_load_p90`.
- **Future fires (persistence):** for t_k beyond the latest detection, clone the fires of the last 24 h with `acq_ts += 24h·n` and `frp *= 0.8**n`. Document this in the README and on the Skill page; it is the biggest uncertainty.

**build_features.py.** Exactly the §10.3 columns. Use cyclic sin/cos for hour_ist, dow and doy. `station_id` is a pandas `category`. Target `log1p(pm25)`. **The same function serves training and live**, so the only difference is the WindField source (ERA5 vs GFS).

**train.py.** `lgb.train` with `objective="quantile", alpha=a`, about 1000 rounds with early stopping on the Nov-2025 validation set. Start with `learning_rate=0.05, num_leaves=31, min_data_in_leaf=50`. Save `model.save_model()` text plus `metadata.json`: features, categorical levels, date ranges, val MAE by lead bucket, git sha, and `model_version` = `lgbm-<YYYY-MM-DD><letter>`.

**attribution.py.** For each quantile q: `y_full = expm1(pred(X))`, `y_nf = expm1(pred(X with fire_load=fire_load_p90=0))`, then `fire_share = clip((y_full - y_nf)/y_full, 0, 1)`. Sort the three fire_share values to get p10 ≤ p50 ≤ p90. District share = `fire_share × FL_d/ΣFL_d` (guard ΣFL_d = 0). The Attribution table is per **date** (IST day of the valid hours) and per district: average over NCR stations and the valid hours of that day.

**idw_h3.py.** `h3.polygon_to_cells` (h3 v4 API: `h3.LatLngPoly`) over the NCR box at res 7. For each cell, take the 6 nearest stations within 25 km (cKDTree in km space) and use weights `1/d²`. If no station is within 25 km, set the values to `None`. Write GeoJSON polygons with `h3.cell_to_boundary`, swapping to `[lon, lat]`.

**rank.py.** `trend_7d = (fires_last_24h − mean_daily_prev_7d)/max(mean,1)`. Use DBSCAN with `metric="haversine"`, `eps = 2/6371` on radians, `min_samples=3`. Without a gazetteer, name each cluster `"<district> cluster <n>"` and include the centroid and the h3 cell.

**skill.py.** Lead buckets `[0,6), [6,24), [24,48), [48,72]`. Persistence = `pm25_now` of the issue time. Coverage = share of obs within [p10, p90] (target ~80 %). Severe hit rate = TP/(TP+FN) for obs > 250. The output shape is exactly `SkillResponse` in the contracts.

## 8. Done checks
- `pytest tests/engine -q` is green (3 mandatory tests).
- `scripts/run_engine_local.sh <run_id>` produces every artefact in `.local-s3/`, and `summary.json` validates against the pydantic `RunSummary`.
- BACKTEST.md states honestly whether we beat persistence for leads ≥ 12 h (brief §10.7). If we don't, say where we fail.

## 9. Gotchas
- ERA5 longitudes are 0–360 and its latitudes descend. Normalise them to −180..180 and ascending in one place (ask Tejas to do it at backfill).
- GFS `HPBL` is in metres, and `RH` is in %. Keep the units as in brief §7.
- Never shuffle across time when training. Leakage makes the backtest look too good.
- Training on ERA5 and running on GFS makes the backtest optimistic. Say so on the Skill page (§6.4 caveat).
- Lambda memory: load models once at module level. Keep the trajectory arrays float32.
