# PlumeTrace: Project Plan

> **Hackathon:** WeMakeDevs × AWS *Environmental Hacks*, Air track, **Oct 8–11, 2026**
> **Source of truth for *what* we build:** [docs/PROJECT_BRIEF.md](docs/PROJECT_BRIEF.md)
> **This file covers *who* builds it, *when*, and *how we stay parallel*.**
> Every file in the repo has an `OWNER / DUE / TASK / DONE WHEN` header. The full index is in [docs/FILE_OWNERS.md](docs/FILE_OWNERS.md).

---

## 1. Team and roles (one line each)

Yasho does twice the work and is planned as two people, **Yasho1** and **Yasho2**. They get the AI, backend and complex work.

| Person | Role | In one sentence | Agent guide |
|---|---|---|---|
| **Yasho1** | Science Engine Lead (Python) | Builds the forecasting brain: back-trajectories, fire load, LightGBM p10/p50/p90 model, counterfactual fire attribution, H3 gridding, hotspot ranking and forecast-skill metrics. | [docs/team/YASHO1.md](docs/team/YASHO1.md) |
| **Yasho2** | AI and Backend Lead (Bun/Express + Bedrock + OR-Tools) | Freezes the shared contracts and mocks in hour 2. Builds the whole REST API, the Bedrock Copilot agent (tool loop, guardrail, SSE), the approval state machine and the OR-Tools shift re-planner. Acts as integration lead. | [docs/team/YASHO2.md](docs/team/YASHO2.md) |
| **Tejas** | Cloud Infra and Data Ingest | Builds all AWS CDK stacks and the data feeds: FIRMS, GFS (idx/range fetcher) and OpenAQ ingest, the historical backfill for training, Step Functions, EventBridge, Cognito, Amplify, observability and cost. | [docs/team/TEJAS.md](docs/team/TEJAS.md) |
| **Tanmay** | Frontend | Builds the React + Vite web app: the deck.gl smoke/trajectory map and time slider, the Government, Fleet, Forecast Skill and Approvals views, the Copilot chat panel and Cognito login. | [docs/team/TANMAY.md](docs/team/TANMAY.md) |
| **Khare** | Gov and Fleet Domain Modules | Builds the district PDF report, the Punjabi farmer alert (Translate + Polly), Telegram delivery and the action executor, the fleet simulator and dose engine, rider notifications, and next-day verification for both modules. Also owns slides and the demo script. | [docs/team/KHARE.md](docs/team/KHARE.md) |

**How the brief's 4 roles map onto 5 people:** brief role A → Tejas. B → Yasho1. C → Yasho2 (agent and API) plus Khare (report, alerts, delivery). D → Tanmay (frontend) plus Khare (simulator, dose) plus Yasho2 (re-planner).

---

## 2. Tech stack (mirrors our NotebookLM-Clone repo, mapped onto AWS)

| Layer | NotebookLM-Clone | PlumeTrace | Why it changed (if it did) |
|---|---|---|---|
| Frontend | React 19 + Vite, Zustand, Tailwind v4, Radix/shadcn, TanStack Query, axios, react-markdown, sonner | **Same**, plus MapLibre GL + deck.gl, recharts and aws-amplify (Cognito) | Replaces the brief's Next.js so we reuse what we know. Hosted on **Amplify Hosting** |
| API | Bun + Express 5, zod validators, pino, helmet, rate-limit | **Same**, packaged as a container on **Lambda (via AWS Lambda Web Adapter)** behind **API Gateway HTTP API + Cognito JWT** | Serverless, with no server to babysit |
| AI | OpenAI SDK / @openai/agents tool loop, SSE streaming | **Amazon Bedrock (Claude) ConverseStream tool-use loop** + **Bedrock Guardrails**, SSE streaming | Same pattern on AWS |
| Async work | BullMQ worker + Redis | **Step Functions + EventBridge + Lambda** | AWS-native, and the brief requires it |
| Data | MongoDB, Qdrant, S3/R2 | **DynamoDB** (on-demand), **S3**, Glue/Athena | Matches the frozen contracts in brief §8 |
| Validation | zod | **zod contracts package** (`contracts/`) → JSON Schema → Pydantic mirror | One schema shared by JS and Python |
| Science / solver | (none) | **Python 3.12**: xarray/cfgrib, NumPy/SciPy, LightGBM, h3, OR-Tools | No practical JS alternative for these libraries |
| IaC / CI | GitHub Actions | **AWS CDK (TypeScript)** + GitHub Actions | |

The full list of decisions is in [docs/DECISIONS.md](docs/DECISIONS.md).

---

## 3. How we stay parallel (the 5 rules)

1. **Contracts first, frozen at D1 12:00.** Yasho2 writes `contracts/` (zod schemas, Pydantic mirror, **mock JSON for every API response and event**) in the first two hours. After the freeze, everybody codes against the contracts and never against another person's code.
2. **Everything has a mock mode.** The API serves `contracts/mocks` when `MOCK_MODE=1`. Python runs offline with `PT_LOCAL=1`, which writes to `./.local-s3/`. Lambdas take contract-shaped JSON input. No one waits for anyone.
3. **One owner per file.** The owner is in the file header. To change someone else's file, add a line to [docs/HANDOFFS.md](docs/HANDOFFS.md) and ping them. CODEOWNERS enforces review.
4. **Small PRs to `main`, at least twice a day.** Use branches named `<name>/<feature>` (e.g. `tejas/gfs-ingest`). CI must be green. Squash-merge.
5. **Event-driven seams.** The engine publishes `forecast.published`. Gov and fleet react to it. The approve endpoint publishes `action.approved` and the executor reacts. No module calls another module's internals.

---

## 4. Timeline (IST; assumes kickoff at D1 10:00)

Internal goal: **feature-complete by D3 20:00**. That leaves D3 night and D4 morning as buffer before the official D4 12:00 freeze.

### Day 1: Thu Oct 8 (foundations and mocks)
| Time | Yasho1 | Yasho2 | Tejas | Tanmay | Khare |
|---|---|---|---|---|---|
| 10–12 | `config.py`; review contracts; read GFS/ERA5 docs | **Write contracts + mocks → FREEZE 12:00**; check Bedrock model access | AWS account, IAM users, **Bedrock model access request**, secrets, CDK bootstrap, repo + CI | Scaffold Vite app (copy NotebookLM setup), routing, AppShell | Find district GeoJSON + licence; Telegram bot; check Polly Punjabi voice |
| 12–16 | `winds.py`, `backtrack.py` + trajectory test on **Tejas's GFS sample (13:00)** | Express API in MOCK_MODE → container → deployed **by 14:00** | **GFS fetcher sample by 13:00**; DataStack; Dockerfile with eccodes; FIRMS ingest | Map + deck.gl layers on mocks; AQI scale; RangeText | `dose.py` + test **by 14:00** (Yasho2 depends on it); fleet + rider generator |
| 16–20 | `districts.py`, `ensemble.py`, trajectories.geojson | Auth middleware, ApiStack review, AgentStack guardrail, system prompt | OpenAQ ingest; ApiStack (Cognito + Lambda + HTTP API); **start backfills** | TimeSlider + TripsLayer animation; Government page skeleton | Orders generator + baseline plan; `forecast_lookup.py`; Telegram test message |
| 20–02 | `fire_load.py` + test; start `build_features` | Bedrock tool loop + tools on mocks | **ERA5 / FIRMS / OpenAQ backfill done by 22:00** (critical path) | Queries hooks, Approvals page on mocks | Report template HTML + svgMap |

### Day 2: Fri Oct 9 (real engine, real agent)
| Time | Yasho1 | Yasho2 | Tejas | Tanmay | Khare |
|---|---|---|---|---|---|
| 00–10 | Training set → **train LightGBM by 10:00** | Agent streaming on mocks works end-to-end | (sleep / monitor backfill) | (sleep) | (sleep) |
| 10–14 | Backtest vs persistence (12:00); `infer.py` (14:00) | Real controllers (DynamoDB/S3); actions approve/reject + event; `seed_mocks.py` | `handlers.py`; EngineStack (Step Functions, Map, retries, Scheduler, bus, rules) | Copilot panel (SSE + tool steps); Government page | Report generator → PDF (13:00); farmer alert compose/translate |
| 14–18 | `attribution.py`, `idw_h3.py`, `rank.py`, `summarize.py` | Gov tool wiring; greedy re-planner; route matrix | GovStack + FleetStack + WebStack (Amplify) | Approvals page with previews; Fleet page start | Polly + farmer alert Lambda; fireTrend; dose handler |
| **18:00** | **CHECKPOINT 1: the first real `EngineRun` replaces the mocks. The scheduler is turned ON (so AC4 has ≥24 h of live data by D3 evening).** |||||
| 18–24 | Fix pipeline issues from CP1; speed up | CP-SAT re-planner + handler; fleet tools; contract tests | Fix CP1 infra; Glue/Athena | Fleet page before/after; DegradedBanner | autoDraft + **executor + Telegram delivery (AC6)** |

### Day 3: Sat Oct 10 (close the loop and prove it)
| Time | Yasho1 | Yasho2 | Tejas | Tanmay | Khare |
|---|---|---|---|---|---|
| 09–13 | `fill_obs.py`, `skill.py` (live + backtest) | Demo question works end-to-end (AC5); riders erase/consent routes | ObservabilityStack; run EngineRun 3× in a row (AC1) | Skill page; Cognito Hosted UI login; switch to the real API | Rider notifications; GPS replay; native-speaker check |
| **13:00** | **CHECKPOINT 2: full end-to-end demo run on real data, including a phone delivery** |||||
| 13–20 | Tuning; performance (< 15 min run) | Bug bash; `demo_reset.sh`; README draft | Cost Explorer numbers + architecture diagram | Polish the smoke animation; Consent page; responsive design | govVerify + fleet_verify; slides outline; demo script |
| **20:00** | **Internal feature freeze.** After this, fix bugs only. |||||

### Day 4: Sun Oct 11 (ship)
| Time | Everyone |
|---|---|
| 09–12 | Rehearse the demo 3× (Khare drives the script, Tanmay drives the UI, Yasho answers technical Q&A). Record the **backup video (AC10)**. Final `cdk deploy -c stage=demo`. Yasho2 finishes the README (AC9). |
| **12:00** | **Official feature freeze.** Submit. |

---

## 5. Critical path (protect it)

```
Tejas GFS sample (D1 13:00) ─► Yasho1 trajectories (D1 16:00) ─► fire_load (D1 22:00) ─┐
Tejas backfill ERA5/FIRMS/OpenAQ (D1 22:00) ───────────────────────────────────────────┴► training set (D2 04:00)
   ─► train (D2 10:00) ─► infer + attribution + gridding (D2 17:00) ─► CP1 real run (D2 18:00) ─► scheduler ON ─► ≥24 h live skill (AC4)
```
**Fallbacks so the critical path can't sink the demo:**
- If the model isn't ready by D2 14:00, `infer.py` ships `persistence-v0` and the pipeline still runs end-to-end.
- If GFS decoding fails in Lambda, run that step on Fargate (same image).
- If the CP-SAT solver isn't ready, `greedy.py` is built first and always returns a plan.

---

## 6. Dependency handoffs (who waits for whom)

| From → To | What | When |
|---|---|---|
| Yasho2 → everyone | `contracts/` + mocks frozen | D1 12:00 |
| Yasho2 → Tanmay | Deployed mock API URL | D1 14:00 |
| Tejas → Yasho1 | GFS sample f000–f072 with agreed variable names | D1 13:00 |
| Khare → Yasho1 | `static/districts.geojson` | D1 14:00 |
| Khare → Yasho2 | `fleet/dose/dose.py` + `forecast_lookup.py` interface | D1 14:00 / 18:00 |
| Tejas → Yasho1 | ERA5 + FIRMS archive + OpenAQ archive backfill | D1 22:00 |
| Tejas → all | DataStack (tables, bucket), ApiStack | D1 14:00 / 18:00 |
| Yasho1 → Khare | `summary.json` with `hotspot_villages`, `fires_48h.geojson` (mocks until then) | D2 17:00 |
| Khare → Yasho2 | Report / farmer-alert / fireTrend / rider-notify Lambdas (contract I/O) | D2 13:00–18:00, D3 11:00 |
| Yasho2 → Khare | `action.approved` events from the approve endpoint | D2 14:00 |
| Tejas → all | EngineStack, GovStack, FleetStack, WebStack | D2 14:00–18:00 |

---

## 7. Daily rhythm

- **Stand-ups (10 min):** 10:00, 15:00 and 21:00 IST. Each person says: what's done (file headers set to DONE), what's next, and what's blocking.
- **Status lives in the files.** Set the `STATUS` line in each file header to `TODO`, `WIP` or `DONE`. To see what's left:
  `grep -rn "STATUS   : TODO" --include=*.* .`
- **Blockers** go into [docs/HANDOFFS.md](docs/HANDOFFS.md) and get a ping in the team chat.
- **Decisions** go into [docs/DECISIONS.md](docs/DECISIONS.md) with a one-line reason.

## 8. Using AI coding agents (Claude Code / Cursor / Codex / Gemini)

1. Open the repo root. The agent reads [CLAUDE.md](CLAUDE.md) (or [AGENTS.md](AGENTS.md)) automatically.
2. Start every session with: **"I am `<NAME>`. Read docs/team/`<NAME>`.md and continue my next TODO task."**
3. The agent edits only files whose header says your name. Anything else becomes a HANDOFFS entry.
4. Review every diff yourself. Never let an agent commit secrets or change `contracts/` on its own.

## 9. Acceptance-criteria ownership (brief §17)

| AC | Owner | AC | Owner |
|---|---|---|---|
| AC1 engine runs 3× < 15 min | Tejas (+Yasho1) | AC6 approval → phone in < 30 s | Khare (+Yasho2) |
| AC2 event triggers gov and fleet | Tejas | AC7 re-planner 50 riders < 60 s | Yasho2 |
| AC3 backtest skill page | Yasho1 (+Tanmay) | AC8 no secrets, scoped IAM, KMS health data | Tejas |
| AC4 ≥ 24 h of live skill | Yasho1 (scheduler ON at CP1) | AC9 README | Yasho2 |
| AC5 agent gives gov + fleet drafts | Yasho2 | AC10 backup video | Khare + Tanmay |
