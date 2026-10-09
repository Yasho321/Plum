# PlumeTrace

> OWNER    : Yasho2
> DUE      : D4 10:00
> TASK     :
>   AC9: architecture diagram, `cdk deploy` setup, data sources + licences, limitations (FIRMS overpass bias, persistence-of-fires assumption, simulated fleet, ERA5 vs GFS skill caveat), team.
> DONE WHEN: Judges can understand + reproduce.
> GUIDE    : docs/team/YASHO2.md  |  brief: docs/PROJECT_BRIEF.md
> STATUS   : DONE

**A source-attributed 72-hour PM2.5 forecast for Delhi-NCR, with a government
accountability module, a gig-rider protection module, and a human-approved
Bedrock Copilot — all serverless on AWS.**

Built for the WeMakeDevs × AWS *Environmental Hacks* (Air track), Oct 8–11, 2026.

PlumeTrace is **one forecasting engine with two products on top of it**. Every 6
hours it combines satellite fire detections (NASA FIRMS), weather-model winds
(NOAA GFS) and ground PM2.5 (OpenAQ/CPCB), traces the air backwards from each
Delhi-NCR station, and estimates **how much of the coming PM2.5 comes from crop
fires and which districts they are in** — with uncertainty bands on an H3 grid.
An agent turns that forecast into **targeted, human-approved actions**: district
evidence reports, supportive farmer alerts, and rider shift plans that cap
pollution dose. Then it **checks whether the actions worked**.

> The key demo moment: ask the Copilot *"Tomorrow morning looks severe. What
> should we do?"* → it drafts a district report, a Punjabi farmer alert (with
> audio), and a rider shift plan (−worst-rider exposure, +few minutes). A human
> approves, and the alert is delivered live to a phone.

---

## Architecture

```
 FIRMS ─┐                         ┌───────────── SHARED CORE (engine/) ─────────────┐
 GFS  ──┼─► S3 raw ─► Step Functions EngineRun: ingest → back-trajectories →         │
 OpenAQ ┘            attribution → LightGBM p10/p50/p90 forecast → H3 gridding →      │
                     summarize → EventBridge "forecast.published"                     │
                                   │                                                  │
                     Forecast/StationForecast/Attribution (DynamoDB) + S3 map layers  │
                                   └───────────────┬──────────────────────────────────┘
                     ┌─────────────────────────────┴─────────────────────────────┐
             GOV MODULE (gov/)                                   FLEET MODULE (fleet/)
             district reports · farmer alerts                    dose engine · OR-Tools
             (Translate + Polly) · fire-trend verify             shift re-planner · verify
                     └─────────────────────────────┬─────────────────────────────┘
                     PlumeTrace Copilot (api/ + Bedrock ConverseStream + Guardrail)
                                   draft → human approve → execute → verify
                                   │ POST /actions/{id}/approve → "action.approved"
                     React + deck.gl app on Amplify  (web/)   ·   REST API on Lambda (api/)
```

- **Contract-first, event-driven, serverless.** Every module talks only through
  the frozen schemas in [`contracts/`](contracts/) (brief §8) and EventBridge
  events — never another module's internals. See [`docs/DECISIONS.md`](docs/DECISIONS.md).
- **The agent never executes actions.** Every outbound message is a *draft* that
  a human approves; approval (not the agent) triggers delivery. This is the
  prompt-injection defence (brief §15).

| Area | Stack |
|---|---|
| Engine / science | Python 3.12 · xarray/cfgrib · NumPy/SciPy · LightGBM · h3 |
| API + Copilot | Bun + Express 5 on Lambda (Lambda Web Adapter, response streaming) · Amazon Bedrock (Claude) ConverseStream + Guardrails · SSE |
| Fleet solver | OR-Tools CP-SAT (+ greedy fallback) · Amazon Location route matrix |
| Data | DynamoDB (on-demand) · S3 · Glue/Athena · EventBridge · Step Functions |
| Web | React 19 + Vite · MapLibre + deck.gl · Cognito Hosted UI · Amplify Hosting |
| IaC | AWS CDK (TypeScript), region `us-east-1` |

---

## Repository layout

| Path | What |
|---|---|
| [`contracts/`](contracts/) | Frozen zod schemas → JSON Schema → Pydantic mirror, + 11 realistic mocks. The single source of truth (brief §8). |
| [`engine/`](engine/) | Python pipeline: trajectories, fire load, model, gridding, verify. |
| [`training/`](training/) | LightGBM training + backtest. |
| [`api/`](api/) | Bun/Express REST API + Bedrock Copilot (tool loop, guardrail, SSE, approvals). |
| [`gov/`](gov/) | District report, farmer alert (Translate/Polly), Telegram delivery, verify. |
| [`fleet/`](fleet/) | Simulator, dose engine, OR-Tools re-planner, rider notify, verify. |
| [`web/`](web/) | React + Vite app (deck.gl map, Government/Fleet/Skill/Approvals/Copilot). |
| [`infra/`](infra/) | CDK app, one stack per concern. |
| [`docs/`](docs/) | Brief, plan, decisions, handoffs, integration runbook, team playbooks. |

---

## Run it locally (no AWS needed)

Everything has a mock/local mode so no part blocks on another.

```bash
# API + Copilot against the frozen mocks (serves every route on :8080)
cd api && bun install && MOCK_MODE=1 bun run dev

# Web against the mock API
cd web && VITE_USE_MOCKS=1 npm run dev

# Python engine/fleet offline (reads/writes ./.local-s3 instead of S3)
PT_LOCAL=1 python scripts/seed_mocks.py     # load the mocks into ./.local-s3
PT_LOCAL=1 pytest tests -q
```

> **Windows note:** if `bun install` in `api/` reports it failed to copy the
> local `@plumetrace/contracts` dep (EPERM), recreate the link with a junction:
> `New-Item -ItemType Junction api/node_modules/@plumetrace/contracts -Target contracts`.
> Not an issue on Linux/CI.

### Tests
```bash
cd contracts && npm install && npm run validate   # 11/11 mocks valid against zod
pytest tests/contracts -q                          # mocks valid against the Pydantic mirror
cd api && MOCK_MODE=1 bun test                      # every API response validates against contracts
pytest tests/fleet/test_replanner.py -q            # re-planner correctness + AC7 (50 riders < 60 s)
```

---

## Deploy to AWS

```bash
# 1. One-time: request Bedrock model access in us-east-1; set secrets in Secrets Manager:
#    plumetrace/firms_map_key, plumetrace/openaq_key, plumetrace/telegram, plumetrace/cdse
cd infra && npm install && npx cdk bootstrap

# 2. Deploy the stage (dev shared; demo from main from D3)
npx cdk deploy --all -c stage=dev
```
Stacks deploy in order Data → Engine → Gov → Fleet → Agent → Api → Web →
Observability. The API container is built from [`api/Dockerfile`](api/Dockerfile)
(Lambda Web Adapter with `AWS_LWA_INVOKE_MODE=response_stream` so the Copilot SSE
streams through). The engine runs on EventBridge Scheduler at 04/10/16/22 UTC and
is also manually triggerable with a `run_id`.

Config env for the API is documented in [`api/.env.example`](api/.env.example).
Never commit secrets or a real `.env` — keys live in AWS Secrets Manager.

---

## Data sources and licences

| Source | Use | Access | Licence / notes |
|---|---|---|---|
| **NASA FIRMS** (VIIRS 375 m) | fire detections | MAP_KEY area API | NASA open data; cite FIRMS. 375 m active-fire. |
| **NOAA GFS 0.25°** | winds + boundary layer (live forecast) | `s3://noaa-gfs-bdp-pds` (public, no auth) | U.S. Govt public domain (NOAA Open Data Dissemination). |
| **ERA5** | historical weather (training/backtest only) | `s3://nsf-ncar-era5` (public) | Copernicus/ECMWF licence; attribute ECMWF. |
| **OpenAQ / CPCB** | ground PM2.5 | API v3 (key) + `s3://openaq-data-archive` | OpenAQ open data; CPCB stations. |
| **District boundaries** | attribution polygons | geoBoundaries / DataMeet ADM2 | _see [`docs/DECISIONS.md`](docs/DECISIONS.md) D-14 — verify & record the exact licence._ |
| **Sentinel-5P** (stretch) | supporting map layer | Copernicus Data Space | Copernicus licence; decided after CP2. |
| **Amazon Location** | route matrix + base map | AWS service | per AWS terms. |

Fleet rider data is **synthetic** and labelled **SIMULATED** everywhere in the UI.

---

## Limitations (read these before trusting a number)

- **Attribution is an estimate with a range, never a verdict.** We always show the
  p10–p90 band and the model's error metrics. Reports never name or shame individuals.
- **FIRMS overpass bias.** VIIRS overpasses are ~13:30 and ~01:30 local; fires lit
  late afternoon are often missed and cloud/haze hides fires, so FRP is a *lower
  bound* and a relative index.
- **Fire persistence assumption.** For valid hours after the latest detection we
  assume detected fires persist (scaled 0.8/day). This is the single biggest
  forecast uncertainty and is stated on every report.
- **ERA5 (training) vs GFS (live) gap.** Training on reanalysis then running on
  forecasts makes backtest skill optimistic; we measure **live** skill separately
  and show both on the Forecast Skill page.
- **Simulated fleet.** The fleet, orders and GPS are synthetic with a realistic
  shape; dose is a simplified ventilation-rate model (brief §13.2), not a clinical one.
- **Trajectory model is deliberately simple** (kinematic back-trajectories on mean
  925 hPa / 10 m winds), not WRF-Chem/HYSPLIT-grade dispersion.
- **Privacy.** Rider health data lives only in a KMS-encrypted table and is never
  returned over the API (only the budget %). `DELETE /riders/{id}/data` erases a
  rider; DPDP Act 2023 alignment is on the architecture slide.

---

## Team

Yasho (planned as **Yasho1** + **Yasho2**) · **Tejas** · **Tanmay** · **Khare**.
Roles and the parallel-work plan are in [`PROJECT_PLAN.md`](PROJECT_PLAN.md);
per-person playbooks are in [`docs/team/`](docs/team/).

## Acceptance criteria

See brief §17 and [`docs/INTEGRATION.md`](docs/INTEGRATION.md) for the checkpoint
runbook (CP0 contracts freeze, CP1 real data replaces mocks, CP2 full loop).
