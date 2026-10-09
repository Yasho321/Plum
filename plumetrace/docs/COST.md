# COST.md

> OWNER    : Tejas
> DUE      : D3 18:00
> TASK     :
>   Real cost/day from Cost Explorer + breakdown (Lambda, SFN, DynamoDB, S3, Bedrock tokens, Location). Number goes on the architecture slide.
> DONE WHEN: -
> GUIDE    : docs/team/TEJAS.md  |  brief: docs/PROJECT_BRIEF.md
> STATUS   : WIP  (structure + estimates filled; replace the ESTIMATE column with real Cost Explorer numbers after ≥1 day at demo scale)

**Demo scale:** 4 scheduled `EngineRun`s/day (04/10/16/22 UTC) + hourly verify, ~20 NCR receptor
stations, 72 h hourly forecast, H3 res-7 over the NCR box, ~50 simulated riders, a handful of
agent conversations. One AWS account, us-east-1. All figures below are **ESTIMATE (ASSUMPTION)**
until read from Cost Explorer — brief §16 says a few dollars/day, Bedrock tokens dominating.

## How to get the real number (after a day of running)
```bash
# yesterday's spend grouped by service
aws ce get-cost-and-usage \
  --time-period Start=$(date -u -d yesterday +%F),End=$(date -u +%F) \
  --granularity DAILY --metrics UnblendedCost \
  --group-by Type=DIMENSION,Key=SERVICE
```
Tag all stacks with `project=plumetrace` and filter by that tag for a clean total.

## Estimated daily breakdown
| Service | What drives it | ESTIMATE $/day | Notes |
|---|---|---|---|
| Amazon Bedrock | Claude input/output tokens per agent turn | **TBD (dominant)** | Measure tokens × model price; biggest lever |
| Lambda (containers) | ~4 runs × (1 resolve + ~75 ingest + traj/forecast/grid/summarize/publish) + hourly verify | ~0.20–0.80 | 4–6 GB science fns are the cost; GFS Map is 73 short calls |
| Step Functions | state transitions per run (~90 incl. Map) × 4 | < 0.05 | standard workflow |
| DynamoDB (on-demand) | write ~Forecast cells × hours per run; reads from API | ~0.10–0.40 | TTL expires items after 7 days |
| S3 | raw GFS/FIRMS/OpenAQ + outputs; 14-day raw/ lifecycle | < 0.10 | NetCDF/parquet are small after AOI crop |
| Amazon Location | route-matrix calls for the re-planner (cached in RouteCache) | ~0.05–0.20 | cache keeps repeat calls near zero |
| CloudWatch + SNS | logs, dashboard, alarms, 1 email topic | < 0.10 | ERROR-level SFN logs only |
| Translate + Polly | per farmer-alert draft (on approval) | negligible | a few requests/day at demo scale |
| Glue crawlers | on-demand crawls of curated/ + features/ | < 0.05 | run manually, not scheduled |
| **Total (non-Bedrock)** | | **~0.6–2.0** | matches "a few $/day" once Bedrock is added |

## Cost controls already in place
- DynamoDB on-demand (no idle capacity) + 7-day TTL on Forecast/StationForecast.
- S3 `raw/` 14-day expiration lifecycle; AOI+1° crop keeps GFS objects ~10 MB each.
- GFS partial (idx/range) download instead of ~500 MB full files.
- RouteCache table for Location route-matrix results (brief §13.3 / D-11).
- `dev` resources auto-destroy; `demo` deployed only from `main` (D3+).
