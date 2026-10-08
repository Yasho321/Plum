# PlumeTrace: Project Brief for AI Coding Agents

> **How to use this file.** It is the single source of truth for the project. Read the whole file before writing any code.
> When it conflicts with your own assumptions, this file wins. When it is silent, choose the simplest option that keeps
> the **contracts in §8** intact, and record the decision in `docs/DECISIONS.md`.
> Sections marked **ASSUMPTION** are deliberate simplifications or tunable parameters. They are not established facts.
> Sections marked **VERIFY** were not confirmed at the time of writing; check them before you rely on them.

---

## 0. TL;DR

PlumeTrace is **one air-quality forecasting engine with two products on top of it**, built for the Air track of the
WeMakeDevs × AWS *Environmental Hacks* hackathon (Oct 8–11, 2026).

1. **Engine:** every 6 hours it combines satellite fire detections (NASA FIRMS), weather-model winds (NOAA GFS on AWS)
   and ground PM2.5 readings (OpenAQ/CPCB). It traces the air backwards in time from each Delhi-NCR station (back-trajectories), estimates **how much of
   the coming PM2.5 is caused by crop-residue fires and which districts they are in**, and produces a **0–72 h PM2.5
   forecast with uncertainty bands** on a shared H3 hexagon grid.
2. **Government module ("Accountability"):** evidence reports for each district and early-warning messages for farmers in
   hotspot villages, followed by a check the next day of whether fire activity dropped.
3. **Fleet module ("Protection"):** an exposure-dose engine and shift re-planner for gig-delivery riders, who must work
   outside in the smog. It moves and rotates work so that no rider exceeds a daily pollution-dose budget, then checks
   the forecast dose against the dose actually received.
4. **One Bedrock agent ("PlumeTrace Copilot")** with tools for both modules. Every outbound action is drafted by the
   agent and **approved by a human** before it is sent.

The **key demo moment** is a single question to the agent: *"Tomorrow morning looks severe. What should we do?"* It
produces the district report, the farmer alert, and a rider shift plan with "−X % exposure". A human approves, and the
alerts are delivered live.

---

## 1. Context

| Item | Detail |
|---|---|
| Event | WeMakeDevs × AWS **Environmental Hacks**, part of the Bharat Builds Tour |
| Dates | Oct 8–11, 2026 (4 days). Online, with an in-person venue in Delhi |
| Track | **Air** (AQI, pollution exposure, stubble burning, indoor air, school safety) |
| Prize eligibility | The project must **use at least one AWS open-source tool or be deployed on AWS**. We deploy everything on AWS |
| Extra incentive | The top 10 students across tracks get a fast-track Amazon interview, so engineering depth and clean architecture matter |
| Team | 4 people (roles in §18) |
| Past-winner signal | The previous winner closed the loop: detect → reason → act (with human approval) → verify. We follow the same pattern |

---

## 2. Problem Statement

### 2.1 The problem

Every October–November, PM2.5 in Delhi-NCR regularly rises to many times India's 24-hour standard (60 µg/m³) and far above
the WHO guideline (15 µg/m³). The sources include crop-residue (stubble) burning in Punjab and Haryana, vehicles,
industry, construction dust and winter weather. Winter weather matters because a low boundary layer and calm winds trap
pollutants near the ground.

Two failures follow:

1. **Arguments without evidence.** Governments and agencies argue about *how much* of Delhi's smog comes from stubble
   burning, and from *which* districts. Nobody publishes a neutral, daily, district-level estimate with uncertainty and
   evidence. So enforcement, subsidy outreach and machine distribution (for example Happy Seeders and other crop-residue-management (CRM) machines) are
   poorly targeted, and farmers are blamed without being helped.
2. **No protection for people who must work outdoors.** Lakhs of gig-delivery riders on two-wheelers breathe this air
   for 8–12 hours a day. Fleets plan shifts only for speed and cost. No tool forecasts *when and where* exposure will be
   worst and changes the plan to cap any one rider's dose.

Both failures share a root cause: **no reliable, explainable, short-term forecast of PM2.5 that also says where the
pollution comes from.**

### 2.2 Our solution in one sentence

A serverless AWS pipeline that turns open satellite and weather data into a **source-attributed 72-hour PM2.5 forecast**,
and an agent that turns that forecast into **targeted, human-approved actions** for governments (where the smoke comes from)
and fleets (who has to breathe it). The system then **checks whether those actions worked**.

### 2.3 Why now

The burning season overlaps the hackathon, so the demo uses **live, real data**, not a replay.

### 2.4 Positioning rules (important for the pitch and for every generated text)

- Attribution is an **estimate with a range**, never a verdict. Always show the p10–p90 band and the model's error metrics.
- The tone toward farmers is **supportive**: subsidies, machine-rental locations, early warning. It is never "catch the
  culprits". Generated reports must not name or shame individuals.
- Fleet data is **simulated**, and we say so openly.
- Every number used in the pitch must have a source or be labelled as an estimate.

---

## 3. Goals and Non-Goals

### Goals (must ship)
- G1: An automated pipeline that runs every 6 h end-to-end on AWS with real FIRMS, GFS and OpenAQ data.
- G2: Back-trajectory attribution of fire contribution, by district, for each Delhi-NCR station.
- G3: A 0–72 h PM2.5 forecast (hourly) per station and per H3 cell, with p10/p50/p90.
- G4: A forecast-skill page that compares predictions with actual readings (MAE, coverage of the p10–p90 band, skill versus a persistence baseline).
- G5: A Bedrock agent with government and fleet tools, a human approval gate, and real delivery of at least one channel.
- G6: A fleet simulator, a dose engine and a shift re-planner that show the reduction in exposure.
- G7: A web app with Government, Fleet and Forecast-skill views, and an animated smoke and trajectory map.
- G8: Next-day verification for both modules.

### Stretch
- S1: Sentinel-5P CO / aerosol-index / NO₂ layers as supporting evidence on the map.
- S2: A forecast-accuracy-weighted ensemble of GFS runs.
- S3: An interactive voice approval ("say approve").

### Non-goals
- Full chemical-transport modelling (WRF-Chem, HYSPLIT-grade dispersion). Our trajectory model is deliberately simple.
- Production SMS/voice delivery in India (it requires DLT registration). For the demo we deliver through the channels in §12.4.
- Real fleet integrations. We use a simulator with a realistic data shape.
- Attribution of non-fire sources (traffic, industry) beyond a single "non-fire baseline" term.

---

## 4. Users, Personas and User Stories

| Persona | Needs |
|---|---|
| **District officer / State Pollution Control Board analyst** | "Which districts contributed most to tomorrow's Delhi spike, with evidence I can forward?" |
| **Agriculture extension officer** | "Which villages should get messages about subsidies and machine availability today?" |
| **Farmer** (receives messages, does not use the app) | A short local-language message: the alternative to burning, the nearest machine-rental centre, the subsidy helpline |
| **Fleet operations manager** | "Which riders will exceed their safe dose tomorrow, and what is the least disruptive plan change?" |
| **Rider** | A notification: "Your 7–9 AM slot moved to 11–1; wear an N95. Today's projected dose: 62 % of your budget." |
| **Judge / public** | The forecast-skill page: "How accurate is this thing?" |

User stories (acceptance tests are in §17):
- US1: As an officer, I open the Government view and see today's and tomorrow's fire share for each district, with a 48 h smoke animation.
- US2: As an officer, I ask the agent for a report on Sangrur and get a 1-page PDF/HTML with the numbers, the uncertainty range, a map, the method and sources.
- US3: As an extension officer, I approve a farmer alert for the top-N hotspot villages and see that it was delivered.
- US4: As a fleet manager, I see riders who are over budget for tomorrow, ask for a plan, approve it, and riders get notified.
- US5: As anyone, I see how accurate the model was over the last 7 days.

---

## 5. System Overview

```
                 ┌──────────────────── SHARED CORE (PlumeTrace engine) ─────────────────────┐
 FIRMS ─┐        │                                                                            │
 GFS  ──┼─► S3 raw ─► Step Functions: ingest → trajectories → attribution → PM2.5 forecast    │
 OpenAQ ┤        │                          │                                                 │
 S5P  ──┘        │                          ▼                                                 │
                 │       Forecast Store (DynamoDB, key = H3 cell + hour)  +  S3 (map layers)  │
                 │                          │                                                 │
                 │        EventBridge event:  "forecast.published" {run_id, peak, hotspots}  │
                 └──────────────────────────┬─────────────────────────────────────────────────┘
                         ┌──────────────────┴───────────────────┐
                         ▼                                      ▼
           GOV MODULE (Accountability)              FLEET MODULE (Protection)
           • district attribution reports           • rider exposure-dose engine
           • farmer alerts (Translate + Polly)      • shift re-planner (Location Service + OR-Tools)
           • next-day fire-trend check              • rider alerts, dose check
                         └──────────────┬───────────────────────┘
                                        ▼
                Bedrock Agent "PlumeTrace Copilot" (one agent, two sets of tools)
                draft → human approve → execute → verify
                                        ▼
                Next.js app on Amplify Hosting: [Government] [Fleet] [Forecast Skill]
```

**Design principles**
- **Contract-first.** All modules communicate only through the schemas in §8 (DynamoDB items, S3 layouts, EventBridge events, REST API). Each team member builds against mocks on Day 1.
- **Event-driven.** The engine publishes `forecast.published`, and the modules subscribe to it. No module calls another directly.
- **Serverless by default.** Lambda (with container images for scientific Python), Step Functions, DynamoDB, S3, and EventBridge Scheduler. Use Fargate only if a job exceeds Lambda's 15-minute / 10 GB limits.
- **Idempotent runs.** Everything is keyed by `run_id`, so re-running a run overwrites the same keys.

---

## 6. Data Sources (exact access details)

### 6.1 Area of interest (AOI)
- **Bounding box (WGS84):** west **73.5**, south **27.5**, east **78.0**, north **32.7**. It covers Punjab, Haryana, Delhi and western UP.
- **Delhi-NCR receptor stations:** every OpenAQ location inside lon 76.8–77.6, lat 28.3–28.95 that reports PM2.5.

### 6.2 NASA FIRMS (fire hotspots)
- **Key:** free MAP_KEY from https://firms.modaps.eosdis.nasa.gov/api/map_key/. Store it in **Secrets Manager** as `plumetrace/firms_map_key`.
- **Endpoint (CSV):** `https://firms.modaps.eosdis.nasa.gov/api/area/csv/{MAP_KEY}/{SOURCE}/{W,S,E,N}/{DAY_RANGE}[/{YYYY-MM-DD}]`
- **SOURCE:** `VIIRS_SNPP_NRT`, `VIIRS_NOAA20_NRT`, `VIIRS_NOAA21_NRT` (375 m). `MODIS_NRT` is optional and coarser.
- **DAY_RANGE:** small integer (1–5). Fetch `1` every run and de-duplicate.
- **Columns used:** `latitude, longitude, frp, acq_date, acq_time (HHMM UTC), confidence, daynight, satellite`.
- **Filtering:** drop `confidence == 'l'` (VIIRS uses `l`/`n`/`h`). Keep day and night detections.
- **De-dup key:** `round(lat,4), round(lon,4), acq_date, acq_time, satellite`.
- **History for training:** use the FIRMS archive download (UI) or the area API with a date for Oct 1–Nov 30 of 2024 and 2025.
- **Known bias (state it in the pitch):** VIIRS overpasses are about 13:30 and 01:30 local time. Fires lit in the late afternoon are often missed, and clouds or haze hide fires. So FRP is a *lower bound* and a relative index.

### 6.3 NOAA GFS (wind and boundary layer; live forecasts) on AWS
- **Bucket:** `s3://noaa-gfs-bdp-pds` (us-east-1, public, no auth). It can also be read over HTTPS at `https://noaa-gfs-bdp-pds.s3.amazonaws.com/`.
- **Path:** `gfs.{YYYYMMDD}/{HH}/atmos/gfs.t{HH}z.pgrb2.0p25.f{FFF}` with `HH ∈ {00,06,12,18}` and `FFF` = forecast hour (000–120 hourly).
- **Availability:** a run appears about 3.5 h after its cycle time. For example, the 00Z files land around 03:30 UTC. Always use the **latest complete** cycle.
- **Partial download (mandatory):** each file is about 500 MB. Read `{file}.idx`, where each line is `n:byte_offset:d=YYYYMMDDHH:VAR:LEVEL:fcst:`, and fetch only the needed records with HTTP `Range` requests.
- **Records needed:**
  - `UGRD:10 m above ground`, `VGRD:10 m above ground`
  - `UGRD:925 mb`, `VGRD:925 mb` (primary transport level, ASSUMPTION)
  - `UGRD:850 mb`, `VGRD:850 mb`
  - `HPBL:surface` (planetary boundary-layer height, m)
  - `TMP:2 m above ground`, `RH:2 m above ground` (features)
- **Library:** `herbie-data` can do this, or write the ~30-line idx/range fetcher yourself. Decode with `xarray` + `cfgrib` (needs eccodes, so use a Lambda container image).
- **Crop to the AOI** with a 1° margin before saving. Save as compact NetCDF/Zarr to `s3://<bucket>/raw/gfs/run=<cycle>/f<FFF>.nc`.

### 6.4 ERA5 reanalysis (historical weather for training) on AWS
- **Bucket:** `s3://nsf-ncar-era5` (public). Monthly NetCDF files for each variable at 0.25°.
- **Surface examples (verified):**
  - `e5.oper.an.sfc/202411/e5.oper.an.sfc.128_165_10u.ll025sc.2024110100_2024113023.nc` (10 m u)
  - `...128_166_10v...` (10 m v), `...128_159_blh...` (boundary-layer height)
- **Pressure levels:** `e5.oper.an.pl/YYYYMM/` with `128_131_u` / `128_132_v` (files are daily; filter to 925/850 hPa).
- Use ERA5 **only for training and backtesting** (Oct–Nov 2024 and 2025). It lags real time by months.
- **Caveat:** training on reanalysis and then running on forecasts makes training scores optimistic. Report backtest skill with that caveat, and measure live skill separately (§10.8).

### 6.5 OpenAQ (ground PM2.5, including CPCB stations)
- **Live API v3:** `https://api.openaq.org/v3/`, header `X-API-Key: <key>` (free signup). Store the key in Secrets Manager as `plumetrace/openaq_key`.
  - Locations: `GET /v3/locations?bbox=73.5,27.5,78,32.7&parameters_id=2&limit=1000` (parameter 2 = PM2.5; VERIFY the id).
  - Hourly values: `GET /v3/sensors/{sensor_id}/hours?datetime_from=...&datetime_to=...`
- **Archive on AWS (training):** `s3://openaq-data-archive/records/csv.gz/locationid={id}/year=YYYY/month=MM/...` (public, verified prefix).
- **QC:** drop values < 0 or > 1500 µg/m³; drop stuck sensors (the same value for ≥ 6 h); require ≥ 75 % hourly completeness for daily aggregates.
- **Units:** µg/m³. Timestamps: store in UTC.

### 6.6 Sentinel-5P (stretch: supporting evidence layer)
- **The AWS registry lists `s3://meeo-s5p`, but it returned `NoSuchBucket` on Oct 8, 2026. Do not depend on it.**
- **Use Copernicus Data Space (CDSE):** free account, then create an OAuth client in the dashboard.
  - Token: `POST https://identity.dataspace.copernicus.eu/auth/realms/CDSE/protocol/openid-connect/token` (client_credentials)
  - Statistical API: `POST https://sh.dataspace.copernicus.eu/api/v1/statistics`, collection `sentinel-5p-l2`, bands `CO`, `AER_AI_340_380`, `NO2`, daily aggregation over district polygons. (VERIFY the exact request against the CDSE docs.)
- Purpose: **show on the map only, as supporting evidence**. Do not feed it into the forecast model in v1.

### 6.7 Static reference data
- **District boundaries** (Punjab, Haryana, Delhi, UP): an open GeoJSON source such as the geoBoundaries ADM2 layer for India, or the DataMeet community maps. Store in `s3://<bucket>/static/districts.geojson`. VERIFY the licence and record it in the README.
- **Villages / CRM machine centres (Custom Hiring Centres):** if no open dataset is found in 2 hours, create a **clearly labelled synthetic** `chc_centres.geojson` with about 30 points across the hotspot districts.
- **Delhi road network:** provided by Amazon Location Service (no download needed).

---

## 7. Conventions (everyone must follow these)

| Topic | Convention |
|---|---|
| CRS | WGS84 (EPSG:4326) everywhere, `[lon, lat]` order in GeoJSON and `(lat, lon)` in function arguments. Document every function signature |
| Spatial index | **H3 resolution 7** (~5.2 km² per cell) for the forecast grid; resolution 5 for coarse map aggregation. Library: `h3` v4 (`latlng_to_cell`, `cell_to_latlng`, `polygon_to_cells`) |
| Time | Store everything in **UTC, ISO-8601 with `Z`**. Convert to IST (UTC+05:30) only in the UI and in generated text |
| `run_id` | GFS cycle used, e.g. `2026-10-09T00Z` |
| `valid_hour` | The hour a forecast value applies to, e.g. `2026-10-09T08:00Z` |
| Lead time | `lead_h = valid_hour − issue_time`, integer hours 0–72 |
| Units | PM2.5 µg/m³; FRP MW; distances km; wind m/s; dose µg (inhaled mass); boundary-layer height m |
| Numbers in text | PM2.5 to the nearest integer; shares as % with no decimals; always include the range: "31 % (22–40 %)" |
| Naming | Python `snake_case`; TypeScript `camelCase`; DynamoDB attribute names `snake_case` |
| Language | Backend Python 3.12; infrastructure **AWS CDK (TypeScript)**; frontend **Next.js + TypeScript** |

---

## 8. Shared Contracts (FROZEN after Day-1 hour 2; change only by team agreement)

Put these in `contracts/` as JSON Schemas + TypeScript types + Pydantic models, with **mock data files** for each.

### 8.1 DynamoDB tables (on-demand capacity)

**`Forecast`**: one item per H3 cell, run and valid hour
| Key | Value |
|---|---|
| PK `pk` | `h3#<cell>` |
| SK `sk` | `<run_id>#<valid_hour>` |
| attributes | `pm25` (p50), `pm25_p10`, `pm25_p90`, `fire_share`, `fire_share_p10`, `fire_share_p90`, `top_sources` (list of `{district, share}`, top 3), `hpbl_m`, `lead_h`, `ttl` (epoch + 7 days) |

GSI `byRun`: PK `run_id`, SK `valid_hour#h3`, used for "give me the whole map for hour X".

**`StationForecast`**: forecasts and actual readings per station
| PK `station#<openaq_location_id>` | SK `<run_id>#<valid_hour>` | `pm25_p10/p50/p90`, `fire_share*`, `obs_pm25` (filled in later), `lead_h` |

**`Attribution`**: per receptor and per source district
| PK `date#<YYYY-MM-DD>` | SK `district#<name>` | `share_p50`, `share_p10`, `share_p90`, `fire_count`, `frp_sum_mw`, `receptor_stations` (list) |

**`Actions`**: everything the agent proposes or executes
| PK `action#<uuid>` | `type` (`district_report` / `farmer_alert` / `shift_plan` / `rider_notify`), `status` (`draft` → `approved` → `executed` / `rejected` / `failed`), `payload`, `created_by` (`agent`), `approved_by` (Cognito sub), `run_id`, timestamps, `verification` (filled the next day) |

**`Riders`** (fleet): PK `rider#<id>`: `name` (synthetic), `home_h3`, `vehicle` (`2w`), `dose_budget_ug`, `consent_health` (bool), `consent_ts`
**`RiderHealth`** (separate table, **KMS customer-managed key**): PK `rider#<id>`: `conditions` (e.g. `asthma`), `budget_multiplier`
**`Shifts`**: PK `fleet#<id>#date#<YYYY-MM-DD>`, SK `rider#<id>`: `planned_stops` (list of `{order_id, h3, eta}`), `forecast_dose_ug`, `actual_dose_ug`, `plan_version`

### 8.2 S3 layout (`plumetrace-<account>-<region>`)
```
raw/firms/date=YYYY-MM-DD/<source>-<fetch_ts>.csv
raw/gfs/run=<run_id>/f<FFF>.nc
raw/openaq/date=YYYY-MM-DD/<location_id>.json
raw/era5/...                          (training only)
curated/fires/date=YYYY-MM-DD/fires.parquet          (de-duped, QC'd)
curated/obs/date=YYYY-MM-DD/pm25.parquet
features/run=<run_id>/station_features.parquet
models/lightgbm/<model_version>/{q10,q50,q90}.txt + metadata.json
outputs/run=<run_id>/trajectories.geojson            (map animation)
outputs/run=<run_id>/pm25_h3_<valid_hour>.geojson    (map layers; or one PMTiles file)
outputs/run=<run_id>/summary.json
reports/<action_id>.html|.pdf
audio/<action_id>.mp3
static/districts.geojson, static/chc_centres.geojson
```
Glue crawler / tables on `curated/` and `features/` so Athena can query them.

### 8.3 EventBridge events (custom bus `plumetrace`)
```json
{ "source": "plumetrace.engine", "detail-type": "forecast.published",
  "detail": { "run_id": "2026-10-09T00Z", "issued_at": "2026-10-09T04:10Z",
              "max_pm25": 310, "peak_window_utc": ["2026-10-10T00:30Z","2026-10-10T04:30Z"],
              "delhi_fire_share_p50": 0.31,
              "hotspot_districts": [{"district":"Sangrur","share":0.12},{"district":"Patiala","share":0.07}],
              "summary_s3": "s3://.../outputs/run=2026-10-09T00Z/summary.json",
              "model_version": "lgbm-2026-10-09a" } }
```
Other events: `action.approved`, `action.executed`, `verification.completed` (source `plumetrace.agent` / `plumetrace.verify`). The detail for each is the `Actions` item.

**Rules:** `forecast.published` → (1) the Gov Step Function (draft reports if `delhi_fire_share_p50 ≥ 0.20` or `max_pm25 ≥ 250`, ASSUMPTION thresholds); (2) the Fleet re-planner Lambda (recompute tomorrow's doses and draft a plan if any rider exceeds 100 % of budget).

### 8.4 REST API (API Gateway HTTP API + Lambda, Cognito JWT authorizer)
| Method & path | Returns |
|---|---|
| `GET /runs/latest` | `summary.json` of the latest run |
| `GET /forecast?run_id=&valid_hour=&bbox=` | GeoJSON of H3 cells (p10/p50/p90, fire_share) |
| `GET /stations/{id}/forecast?run_id=` | time series for 0–72 h plus actual readings |
| `GET /attribution?date=` | district shares |
| `GET /trajectories?run_id=&station=` | GeoJSON LineStrings with a time property per vertex |
| `GET /skill?days=7` | MAE, band coverage and skill vs persistence, by lead bucket |
| `GET /fleet/{id}/exposure?date=` | per-rider forecast/actual dose and budget % |
| `GET /actions?status=draft` / `POST /actions/{id}/approve` / `POST /actions/{id}/reject` | approval queue |
| `POST /agent/chat` | proxies to the Bedrock agent (streaming if possible) |
| `DELETE /riders/{id}/data` | DPDP "erase my data" |

---

## 9. Engine Pipeline (Step Functions `EngineRun`)

Trigger: **EventBridge Scheduler** at 04:00, 10:00, 16:00 and 22:00 UTC (about 4 h after each GFS cycle). Also manually triggerable with `{run_id}`.

```
1. ResolveRun        → pick the latest complete GFS cycle (check that f072.idx exists)
2. Parallel:
   a. IngestFIRMS    → raw → curated/fires (last 72 h window)
   b. IngestGFS      → Map state over f000..f072 (step 1 h; 3 h acceptable if slow) → raw/gfs
   c. IngestOpenAQ   → latest 72 h of PM2.5 for all AOI stations → curated/obs
3. BackTrajectories  → for every receptor station × every valid hour (0..72) → outputs/trajectories + features
4. Attribution       → fire load per district along each trajectory → Attribution table
5. Forecast          → LightGBM q10/q50/q90 per station × lead; counterfactual for fire_share
6. Gridding          → interpolate station forecasts to H3 res-7 cells → Forecast table + map layers
7. Summarize         → summary.json
8. Publish           → EventBridge forecast.published
9. (separate schedule, hourly) Verify → fill obs_pm25 for past valid hours; compute skill
```
Retry: 2 retries with exponential backoff on ingest steps. On FIRMS failure, continue with the last available fires and set `summary.degraded = ["firms"]`. Show a warning banner in the UI.

---

## 10. Science and Modelling (implement exactly this; tune only the parameters marked ASSUMPTION)

### 10.1 Back-trajectories
For each receptor station `r` and each valid hour `T`, trace an air parcel **backwards for 48 h** with an hourly step.

```
pos(T) = station lat/lon
for k in 1..48:
    t = T - k hours
    (u, v) = wind at pos, time t, transport level      # bilinear in space, linear in time
    lat -= v * 3600 / 111_320
    lon -= u * 3600 / (111_320 * cos(radians(lat)))
    record (lat, lon, t)
```
- **Transport wind (ASSUMPTION):** the mean of the 925 hPa and 10 m winds. If HPBL < 300 m, use 10 m only. Expose this as config.
- **Wind source:** for valid hours in the future, use GFS forecast hours. For past hours (back-tracking from now), use the GFS analysis (f000) and short-range forecasts (f001–f005) of earlier cycles, or simply the earliest available lead time. For training, use ERA5.
- Stop the trajectory if it leaves the AOI with a 1° margin.
- **Ensemble for uncertainty:** 9 trajectories per (r, T), starting points offset ±0.1° in a 3×3 grid, plus winds perturbed by ±10 % speed and ±15° direction (random, fixed seed). This gives the spread for the p10/p90 of fire load.
- Library: pure NumPy / xarray. No HYSPLIT.

### 10.2 Fire load
For each trajectory point `p_k` (time `t_k`), fires `f` with detection time `t_f`:
```
w_space = exp(-d(p_k, f)^2 / (2 * σ^2))        σ = 15 km, cut off at 50 km   (ASSUMPTION)
w_time  = 1 if |t_f - t_k| ≤ 12 h else 0                                       (ASSUMPTION; overpass gaps)
w_age   = exp(-(T - t_k) / τ)                  τ = 24 h                        (ASSUMPTION; dilution/deposition)
FL(r, T) = Σ_k Σ_f FRP_f * w_space * w_time * w_age
FL_d(r, T) = the same sum restricted to fires in district d     (district from point-in-polygon)
```
- **Forecasting future fires:** for valid hours after the latest detection, assume **fire persistence**. Fires detected in the last 24 h repeat at the same locations, scaled by 0.8 per day (ASSUMPTION). Document this clearly; it is the biggest forecast uncertainty.
- Use a KD-tree (`scipy.spatial.cKDTree` on projected coordinates) for the fire lookup. Do not use O(N²) loops.

### 10.3 Features (one row per station × issue time × lead_h)
| Feature | Description |
|---|---|
| `pm25_now` | latest reading at issue time |
| `pm25_mean_24h` | mean of the last 24 h |
| `pm25_same_hour_yday` | reading 24 h before the valid hour (if ≤ issue time) |
| `fire_load` | FL(r, T) (log1p-transformed) |
| `fire_load_p90` | 90th percentile across the trajectory ensemble |
| `hpbl_m` | at valid hour (log) |
| `wind_speed_10m` | at valid hour |
| `rh_2m`, `t_2m` | at valid hour |
| `hour_ist`, `dow`, `doy` | cyclic encoding (sin/cos) |
| `lead_h` | 0–72 |
| `station_id` | categorical (LightGBM native) |

Target: `pm25` at the valid hour (log1p-transformed; transform back for metrics).

### 10.4 Model
- **LightGBM, three quantile models** (`objective='quantile'`, `alpha ∈ {0.1, 0.5, 0.9}`). Fix crossing quantiles afterwards by sorting.
- **Training data:** Oct 1–Nov 30 of 2024 and 2025 (ERA5 weather + FIRMS archive + OpenAQ archive), all Delhi-NCR stations, issue times every 6 h, leads 0–72.
- **Split:** train 2024 + Oct 2025; validate Nov 2025. **Never shuffle across time.**
- Train with a SageMaker training job (script mode, `ml.m5.xlarge`) or a local notebook. Store artefacts in `models/` with `metadata.json` (features, data ranges, metrics, git sha).
- Inference: a Lambda container that loads the model from S3 once per cold start.

### 10.5 Fire share (counterfactual attribution)
```
y_full   = model(features)
y_nofire = model(features with fire_load = 0 and fire_load_p90 = 0)
fire_share = clip((y_full - y_nofire) / y_full, 0, 1)
district share_d = fire_share * FL_d / Σ_d FL_d
```
Compute it for the p10/p50/p90 models to get a range. Label it **"estimated share attributable to crop fires (model-based)"**.

### 10.6 Gridding to H3
- Use inverse-distance weighting from station forecasts to each H3 res-7 cell in Delhi-NCR (power 2, max 6 nearest stations, max 25 km). Outside NCR, show fires and trajectories only, with no PM2.5 surface.
- Cells beyond 25 km from any station: `pm25 = null` (the UI shows them hatched as "no data").

### 10.7 Baselines (must be reported)
- **Persistence:** forecast = `pm25_now` for all leads.
- **Diurnal persistence:** forecast = the value 24 h before the valid hour.
- Our model must beat persistence on MAE for leads ≥ 12 h. If it doesn't, say so and show where it fails.

### 10.8 Metrics (Forecast Skill page)
By lead bucket (0–6, 6–24, 24–48, 48–72 h): **MAE**, **RMSE**, **coverage of the p10–p90 band** (target ~80 %), **skill score** = 1 − MAE_model / MAE_persistence, and the hit rate for "Severe" (> 250 µg/m³) events. Compute separately for the backtest (ERA5) and live (GFS) data.

---

## 11. Agent: "PlumeTrace Copilot"

- **Platform:** Amazon Bedrock Agents (or Bedrock AgentCore, whichever the team can get working fastest), with action groups backed by Lambda. Use the latest Claude model enabled in the Bedrock console for the account's region. **Check model access in the first hour.** If `ap-south-1` lacks the model, run Bedrock in `us-east-1` (data is also there).
- **Guardrail:** Bedrock Guardrails. Block personal data about individual farmers, and block claims of certainty beyond the model output.

### 11.1 System prompt (summary)
> You are PlumeTrace Copilot. You help district officers and fleet managers act on PM2.5 forecasts for Delhi-NCR.
> Use only tool outputs for numbers, and always quote the p10–p90 range. Never claim certainty about attribution.
> Toward farmers, be supportive: offer subsidy information, the nearest machine-rental centre, and alternatives to burning.
> Never blame individuals. Any outbound communication must be created as a DRAFT action that a human approves.
> You may never call execute tools yourself. When asked "what should we do", consider BOTH the government and fleet
> actions and propose them together, with expected impact.

### 11.2 Tools (action groups; OpenAPI schemas live in `contracts/agent/`)
| Group | Tool | Input | Output |
|---|---|---|---|
| shared | `getForecastSummary` | `{run_id?}` | `summary.json` |
| shared | `getStationForecast` | `{station_id, run_id?}` | time series |
| shared | `getAttribution` | `{date}` | district shares + ranges |
| shared | `getForecastSkill` | `{days}` | metrics |
| gov | `draftDistrictReport` | `{district, date}` | `{action_id, preview_url}` (HTML/PDF in `reports/`) |
| gov | `draftFarmerAlert` | `{districts[], language: "pa"\|"hi", max_villages}` | `{action_id, text, audio_url}` |
| gov | `checkFireTrend` | `{district, days}` | daily fire counts / FRP |
| fleet | `getFleetExposure` | `{fleet_id, date}` | per-rider forecast dose and % of budget |
| fleet | `draftShiftPlan` | `{fleet_id, date, objective?}` | `{action_id, riders_changed, dose_reduction_pct, extra_minutes}` |
| fleet | `draftRiderNotifications` | `{plan_action_id}` | `{action_id, messages[]}` |

Execution is **not** an agent tool. `POST /actions/{id}/approve` (a human, from the UI) triggers the executor Lambda through `action.approved`.

### 11.3 District report template (HTML → PDF with WeasyPrint or headless Chromium)
1. Header: district, date, run_id, model version
2. Headline: "Estimated contribution of crop fires in <district> to Delhi-NCR PM2.5 on <date>: X % (range A–B %)"
3. Map: district fires (last 48 h), trajectories that crossed the district, Delhi receptor stations
4. Table: fire count, FRP sum, trend vs the previous 7 days
5. Supportive actions: number of nearby CRM machine centres, subsidy scheme reference (text must be checked by a team member before the demo), suggested outreach villages
6. Method and limitations: the 5-line method, satellite detection limits, the model's MAE
7. Sources: FIRMS, GFS, OpenAQ, and the date and time of each

---

## 12. Government Module Details

### 12.1 Hotspot ranking
District priority = `share_p50 × (1 + trend_7d)`, where `trend_7d` = relative change in fire count. Take the top 5 districts. Villages: cluster the last 48 h of fires (DBSCAN, eps 2 km) and name each cluster by its nearest village or settlement if a gazetteer is available; otherwise use the cluster centroid and the H3 cell.

### 12.2 Farmer alert content
- Under 300 characters of text, plus an audio file of 20–30 s.
- Content: the smoke forecast for the coming days (non-blaming), the nearest machine centre and its distance, the helpline/subsidy line, and one alternative practice.
- Languages: Punjabi (`pa`) text via **Amazon Translate**; voice via **Amazon Polly**. **VERIFY whether Polly has a Punjabi voice.** If it doesn't, use the Hindi voice (Aditi/Kajal, `hi-IN`) for audio and send Punjabi as text. A native speaker on the team must check the translated text before the demo.

### 12.3 Next-day verification
For alerted districts versus non-alerted comparable districts: fire counts and FRP for the next 1–3 days. Store the result in `Actions.verification`. Show it in the UI as "an early signal, not causal proof".

### 12.4 Delivery channels (demo-safe)
- **Primary demo channel:** a Telegram bot (or email via **Amazon SES** in sandbox with verified addresses) that delivers the text and the Polly MP3. It shows up live on a phone.
- **In-app:** an "inbox" panel that plays the audio.
- **Production path (slide only):** Amazon Connect outbound voice / SNS SMS. In India this needs **TRAI DLT registration** (entity and template IDs), so it is not used live.

---

## 13. Fleet Module Details

### 13.1 Simulator
- 1 fleet (`fleet_demo`), **50 riders**, home bases spread over 6 dark stores in Delhi (synthetic coordinates).
- About **600 orders/day**. Arrival intensity follows a typical food/quick-commerce curve: peaks at 8–10, 13–14 and 19–22 IST. Each order has a `pickup_h3`, `drop_h3` and a time window of `[created, created + 45 min]`, of which **30 % are flexible** (`window = 3 h`, e.g. groceries).
- GPS replay: one point every 30 s, published to **IoT Core** (topic `fleet/<id>/rider/<id>/gps`) → IoT rule → **Kinesis Data Streams** → Lambda → `Shifts.actual` dose accumulation. Kinesis can be dropped for simplicity (IoT rule → Lambda).
- Mark everything as synthetic in the UI with a "SIMULATED FLEET" badge.

### 13.2 Dose model
```
dose_ug = Σ over route segments ( C_pm25(h3, hour) × minutes / 60 × VE )
VE (ventilation rate) = 1.4 m³/h for a two-wheeler rider in traffic   (ASSUMPTION; configurable)
In-traffic multiplier for roadside exposure = 1.3 × cell value         (ASSUMPTION)
Daily budget = 60 µg/m³ × 1.4 m³/h × shift_hours × budget_multiplier  (60 = India's 24-h standard; ASSUMPTION)
budget_multiplier = 1.0 by default, 0.7 if consented health condition
```
Show doses as **% of budget**, not raw µg, in the UI.

### 13.3 Re-planner (OR-Tools CP-SAT or a routing solver in Lambda/Fargate)
- Travel times: **Amazon Location Service `CalculateRouteMatrix`** between relevant H3 centroids (cache results in DynamoDB; the matrix is small because it is computed at H3 resolution).
- **Decision variables:** rider–time-slot assignment for each order; start-time shifts of flexible orders within their windows.
- **Hard constraints:** all non-flexible orders on time; shift length ≤ 10 h; no rider's forecast dose > 100 % of budget (soft with a large penalty if infeasible).
- **Objective:** minimize `max_rider_dose_pct × 1000 + total_dose + 2 × total_extra_minutes`.
- Output: `riders_changed`, `dose_reduction_pct` (fleet total and worst-rider), `extra_minutes`, and a per-rider diff.
- Time limit: 30 s solver budget. If it times out, fall back to a greedy heuristic (move flexible orders out of the 06–10 IST peak and rotate the most-exposed riders to cleaner zones).

### 13.4 Rider notification
Template: "Tomorrow, <date>: your <slot> moved to <slot>. Expected exposure <X>% of your safe budget (was <Y>%). Wear an N95 between <hours>." Delivered via the same demo channel as §12.4.

### 13.5 Verification
After the day, `actual_dose` (from the nowcast plus the GPS replay) vs `forecast_dose`, and the original plan vs the new plan → "dose avoided".

---

## 14. Frontend (Next.js on Amplify Hosting)

- **Map:** MapLibre GL with an **Amazon Location Service** map style; **deck.gl** overlays:
  - `ScatterplotLayer`: fires (size = FRP, color = age)
  - `TripsLayer`: animated back-trajectories flowing to Delhi stations (the "smoke flow" demo moment)
  - `H3HexagonLayer`: PM2.5 forecast (p50 colour; the p10–p90 width as opacity or a toggle)
  - `GeoJsonLayer`: districts coloured by fire share
- **Time slider:** 0–72 h with play/pause.
- **Views:**
  1. **Government:** map, a district ranking table with ranges, a Generate report button, a draft queue
  2. **Fleet:** riders table (dose % bars, over-budget highlighted), a before/after plan comparison, a Notify button
  3. **Forecast Skill:** forecast vs actual charts per station, metrics by lead, comparison against the persistence baseline
  4. **Copilot:** a chat panel (also accessible from every page) showing tool calls as collapsible steps
  5. **Approvals:** every draft action, with preview, approve and reject
- Use the AQI colour scale of India's National AQI for PM2.5 categories (Good 0–30, Satisfactory 31–60, Moderate 61–90, Poor 91–120, Very Poor 121–250, Severe > 250 µg/m³). Colour-blind safe palette check.
- Auth: Cognito Hosted UI. Roles (`gov`, `fleet`, `admin`) are Cognito groups that gate the views and the approve buttons.

---

## 15. Security and Privacy

- Cognito user pool with groups; the API Gateway JWT authorizer checks the group for each route.
- Health data **only** in `RiderHealth`, encrypted with a KMS customer-managed key; access only from the dose Lambda role.
- Explicit consent screen (purpose, retention 30 days, withdrawal), with `consent_ts` stored; `DELETE /riders/{id}/data` erases data. Mention **DPDP Act 2023** alignment on a slide.
- Secrets (FIRMS, OpenAQ, CDSE, Telegram) in **Secrets Manager**. Never hard-code or commit them.
- Least-privilege IAM per Lambda (CDK grants), S3 Block Public Access, presigned URLs for reports and audio.
- Bedrock Guardrails (§11). Prompt-injection safety: the agent never executes actions itself; all executions require a human approval.
- CloudTrail on; an audit log of every action (who approved what) in `Actions`.

---

## 16. AWS Infrastructure (CDK, TypeScript)

**Region:** `us-east-1` (GFS and OpenAQ archive in the same region, and Bedrock model availability). The frontend is global via Amplify.

| Stack | Resources |
|---|---|
| `DataStack` | S3 bucket, Glue database and crawlers, DynamoDB tables, KMS key |
| `EngineStack` | Lambda container images (ingest, trajectories, forecast, gridding), Step Functions `EngineRun`, EventBridge Scheduler, custom bus |
| `GovStack` | Report generator Lambda (Chromium/WeasyPrint layer), Translate/Polly permissions, delivery Lambda |
| `FleetStack` | IoT Core rule, (Kinesis), dose Lambda, re-planner (Lambda or Fargate task), Location Service route calculator + map |
| `AgentStack` | Bedrock agent, action-group Lambdas, guardrail |
| `ApiStack` | HTTP API, Cognito user pool and groups, approval endpoints |
| `WebStack` | Amplify app (or S3 + CloudFront) |
| `ObservabilityStack` | CloudWatch dashboard (run duration, failures, data freshness), alarms → SNS email |

**Cost estimate (ASSUMPTION, check in Cost Explorer):** a few dollars per day at demo scale. Lambda and Step Functions are cheap, DynamoDB is on-demand, and Bedrock tokens dominate. Put the real number on the architecture slide.

---

## 17. Acceptance Criteria (Definition of Done)

| ID | Criterion |
|---|---|
| AC1 | `EngineRun` completes end-to-end on real data in < 15 min, three times in a row, with no manual steps |
| AC2 | `forecast.published` triggers both the Gov and Fleet flows (visible in the Step Functions/CloudWatch history) |
| AC3 | The Forecast Skill page shows backtest metrics vs persistence for all 4 lead buckets |
| AC4 | At least 24 h of live forecast vs actual readings shown by the final demo |
| AC5 | The agent answers "what should we do tomorrow?" with ≥ 1 government draft and ≥ 1 fleet draft in one response, citing ranges |
| AC6 | Approving a draft delivers a message (text + audio) to a real phone within 30 s |
| AC7 | The re-planner shows a dose reduction and extra-minutes trade-off for 50 riders in < 60 s |
| AC8 | No secrets in git; the IAM policy for each Lambda is scoped; health data is in the KMS-encrypted table only |
| AC9 | README: architecture diagram, setup with `cdk deploy`, data sources and licences, limitations |
| AC10 | A backup demo video is recorded |

---

## 18. Team Split and Schedule

| Person | Owns |
|---|---|
| **A: Data and infrastructure** | CDK stacks, ingest Lambdas, S3/Glue/Athena, EventBridge, observability, cost slide |
| **B: Science** | Trajectories, fire load, LightGBM training and inference, attribution, gridding, skill metrics |
| **C: Agent and government** | Bedrock agent, tools, guardrail, report generator, Translate/Polly, delivery channel, approvals backend |
| **D: Fleet and frontend** | Simulator, dose engine, re-planner, Next.js app, deck.gl map, all views |

| Day | Milestones |
|---|---|
| **Day 1 (Oct 8)** | Hours 0–2: freeze `contracts/` + mocks. Bedrock model access confirmed. Skeleton CDK deployed. A: fetchers working. B: trajectory code on a sample GFS run. C: agent skeleton on mocks. D: map with mock forecast + simulator |
| **Day 2 (Oct 9)** | A: historical backfill (ERA5, FIRMS archive, OpenAQ archive) + Step Functions. B: model trained, backtest metrics. C: report + farmer alert + delivery. D: dose engine + re-planner. **Evening: integration checkpoint 1, real forecast replaces mocks** |
| **Day 3 (Oct 10)** | Full loop through the agent, approvals, verification jobs, smoke animation, skill page. **Midday: integration checkpoint 2, full end-to-end demo run** |
| **Day 4 (Oct 11)** | **Feature freeze at 12:00.** Bug fixes, demo rehearsal ×3, backup video, README, slides, final deploy |

---

## 19. Demo Script (3 minutes)

1. **(0:00–0:20) Problem.** The smog season is happening now. Every year people argue about its causes, and the riders who deliver our food breathe it anyway.
2. **(0:20–1:00) Engine.** Live map: fire dots in Punjab, animated trajectories flowing into Delhi, the 72 h forecast slider. "Our model estimates 31 % (22–40 %) of tomorrow morning's PM2.5 comes from crop fires; Sangrur and Patiala lead."
3. **(1:00–2:00) Agent.** Ask: "Tomorrow morning looks severe. What should we do?" Show the tool calls. Results: the Sangrur report draft, a Punjabi farmer alert with audio, and a fleet plan with "−34 % worst-rider exposure, +6 min average". Approve both, and a phone in hand receives the alert live.
4. **(2:00–2:30) Proof.** The Forecast Skill page (vs persistence) and the next-day fire-trend check.
5. **(2:30–3:00) Architecture and cost.** One slide, serverless, ~$X/day, what we'd do next (more cities, real fleet APIs, Connect/DLT voice).

---

## 20. Risks and Mitigations

| Risk | Mitigation |
|---|---|
| Bedrock model not enabled / region issue | Check access in hour 1; fall back to us-east-1 |
| GFS decoding (eccodes) fails in Lambda | Use a container image with `cfgrib` + `eccodes`; test on Day 1 |
| Model doesn't beat persistence | Report honestly; focus the pitch on attribution and decision support; show where it helps (24–72 h) |
| FIRMS API rate limits / downtime | Cache in S3; mark the run as degraded; continue with the last data |
| OpenAQ gaps for Delhi stations | Use the archive for history; for live data, fall back to the data.gov.in CPCB real-time feed (VERIFY) |
| Integration slips | Contracts frozen on Day 1; mocks; two scheduled checkpoints; feature freeze |
| Live demo network failure | Pre-recorded backup video; cached run selectable by `run_id` |
| Political sensitivity | Supportive framing, ranges, method and limitations on every report |
| Punjabi voice unsupported | Hindi voice + Punjabi text, verified by a native speaker |

---

## 21. Repository Layout

```
plumetrace/
├── README.md
├── docs/ (this brief, DECISIONS.md, architecture.png, slides/)
├── contracts/            # JSON Schemas, Pydantic + TS types, OpenAPI for API & agent tools, mocks/
├── infra/                # CDK app (TypeScript), one file per stack
├── engine/               # Python: ingest/, trajectories/, features/, model/, gridding/, verify/
│   └── Dockerfile        # Lambda container (python3.12 + eccodes + cfgrib + lightgbm + h3)
├── training/             # notebooks + SageMaker training script, backtest report
├── gov/                  # report generator, alerts, delivery, verification
├── fleet/                # simulator, dose engine, replanner (OR-Tools), notifications
├── agent/                # action-group Lambdas, system prompt, guardrail config
├── web/                  # Next.js app
└── tests/                # unit tests (trajectory math, fire load, dose), contract tests vs mocks
```

**Mandatory unit tests:**
- A trajectory under constant wind moves the expected distance.
- Fire load is 0 when there are no fires and increases as fires get closer.
- Fire share is between 0 and 1.
- The dose for a constant concentration matches the hand calculation.
- Every API response validates against `contracts/`.

---

## 22. Glossary

| Term | Meaning |
|---|---|
| PM2.5 | Particulate matter ≤ 2.5 µm; µg/m³ |
| FRP | Fire Radiative Power (MW), a proxy for fire intensity and emissions |
| HPBL / BLH | Planetary boundary-layer height: the mixing depth. Low values trap pollution |
| Back-trajectory | The path an air parcel took to reach a location, traced backwards in time using wind fields |
| Receptor | A ground station where we explain or forecast PM2.5 |
| GFS | NOAA Global Forecast System, a global weather model (0.25°) |
| ERA5 | ECMWF reanalysis: the best estimate of past weather |
| H3 | Uber's hierarchical hexagonal grid system |
| p10/p50/p90 | 10th/50th/90th percentile forecast (uncertainty band) |
| Persistence | Baseline forecast: "the future equals now" |
| CRM / CHC | Crop Residue Management machinery / Custom Hiring Centres that rent it out |
| DLT | India's TRAI registry required for commercial SMS/voice |
| DPDP Act | India's Digital Personal Data Protection Act, 2023 |

---

## 23. Open Questions (decide and log in `docs/DECISIONS.md`)
1. Bedrock Agents vs AgentCore: whichever is enabled and fastest for the team.
2. Telegram bot vs SES email as the live delivery channel.
3. Hourly vs 3-hourly GFS steps (cost/time vs smoothness).
4. Whether to include Sentinel-5P layers (stretch S1) after integration checkpoint 2.
5. Source of the district and village boundary data and its licence.
