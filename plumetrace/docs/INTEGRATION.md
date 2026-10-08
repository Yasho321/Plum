# Integration runbook

> OWNER: Yasho2 (integration lead) · Tejas co-owns the infra steps.

## Environments
| Stage | Who deploys | What |
|---|---|---|
| local | everyone | `MOCK_MODE=1` API, `PT_LOCAL=1` Python, `VITE_USE_MOCKS=1` web |
| `dev` | anyone, via `cd infra && npx cdk deploy <Stack> -c stage=dev` | shared AWS stage; DataStack is shared, so don't destroy it |
| `demo` | Tejas only, from `main`, from D3 | what the judges see |

## Checkpoint 0: D1 12:00, contracts freeze
- [x] `contracts/` built on `yasho2/contracts`; `cd contracts && npm run validate` passes (11/11); `pytest tests/contracts` passes (12). Awaiting merge to `main`.
- [ ] Every owner has read the schemas for their inputs and outputs and said "OK" in the chat
- [ ] The Bedrock model is enabled in us-east-1 (model ID recorded in `infra/cdk.json`) — **blocked on Tejas** (HANDOFFS #6)
- [x] Mock API ready for Tanmay: `cd api && MOCK_MODE=1 bun run dev` serves every §8.4 route from `contracts/mocks` on `:8080` (14/14 contract tests pass). Needs Tejas to deploy `api/Dockerfile` for a shared URL (HANDOFFS #7).

> **Windows note:** if `bun install` in `api/` reports "Failed to install 1 package" for
> `@plumetrace/contracts` (EPERM copying the local file: dep), recreate the link with a
> junction: `New-Item -ItemType Junction api/node_modules/@plumetrace/contracts -Target contracts`.
> Not an issue on Linux/CI.

## Checkpoint 1: D2 18:00, real data replaces mocks
- [ ] `EngineRun` succeeds on the latest GFS cycle (Step Functions console is green)
- [ ] `GET /runs/latest` returns a real `summary.json` (`run_id` is not `mock`)
- [ ] The map shows real fires, trajectories and the H3 PM2.5 surface
- [ ] `forecast.published` fired `gov/autoDraft` and the `fleet/dose` handler (CloudWatch logs)
- [ ] **The EventBridge Scheduler is ON** (04/10/16/22 UTC) plus the hourly Verify job

## Checkpoint 2: D3 13:00, full loop
- [ ] Ask "Tomorrow morning looks severe. What should we do?" and get ≥ 1 gov draft and ≥ 1 fleet draft, with ranges (AC5)
- [ ] Approve the farmer alert and the phone receives text + audio in < 30 s (AC6)
- [ ] The shift plan for 50 riders is ready in < 60 s and shows the dose reduction and extra minutes (AC7)
- [ ] The Skill page shows the backtest for 4 buckets plus the live data so far (AC3, AC4)
- [ ] 3 consecutive scheduled runs succeeded in < 15 min (AC1)

## Demo-day checklist (D4)
- [ ] `scripts/demo_reset.sh` has been run
- [ ] A cached `run_id` is pinned in case the live run fails
- [ ] The backup video is on 2 laptops
- [ ] The phone is charged, the Telegram chat is open, and the volume is up
