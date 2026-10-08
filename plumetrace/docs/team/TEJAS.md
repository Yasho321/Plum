# TEJAS: Cloud Infrastructure and Data Ingest

> **For the AI agent:** you work for **Tejas**. Follow `CLAUDE.md` rules. Work through the task list below in order of `DUE`.
> Edit only files whose header says `OWNER : Tejas`. Mark the header `STATUS` as WIP/DONE as you go.

## 1. Mission
Make PlumeTrace **run on AWS by itself** and keep it **fed with real data**. You own:
1. The AWS account setup and every CDK stack (except the Bedrock guardrail).
2. The three live ingest feeds: NASA FIRMS fires, NOAA GFS winds (partial byte-range download) and OpenAQ PM2.5.
3. The **historical backfill** (ERA5, FIRMS archive, OpenAQ archive) that Yasho1 trains on. This is on the critical path.
4. The Step Functions `EngineRun`, schedules, the EventBridge bus and rules, Cognito, Amplify, observability, CI and cost.

## 2. Read first
Brief **§5, §6 (all data sources, exact endpoints)**, **§8.1–8.3**, **§9 (pipeline)**, §15 (security), **§16 (stacks)**, §17 AC1/AC2/AC8, §20 risks. docs/DECISIONS.md D-02, D-06, D-08, D-09, D-10, D-11.

## 3. You own
```
infra/** (except infra/lib/agent-stack.ts)
engine/plumetrace_engine/common/*        s3io (+ LOCAL mode), timeutil, ddb, aoi
engine/plumetrace_engine/ingest/*        resolve_run, gfs, firms, openaq
engine/plumetrace_engine/handlers.py     thin Lambda entrypoints for each Step Functions state
engine/plumetrace_engine/publish/publish_event.py
engine/Dockerfile
training/backfill/*                      era5, firms_archive, openaq_archive
tests/engine/test_ingest_parsers.py
.github/**, .gitignore, docs/COST.md
```

## 4. Inputs you depend on
| Input | From | When |
|---|---|---|
| Contracts (table keys, event shapes, S3 keys) | Yasho2 | D1 12:00 |
| Module functions to call from `handlers.py` (signatures in YASHO1.md §7) | Yasho1 | D2 12:00 (stub them until then) |
| `api/Dockerfile`, `gov/src/*/handler.js`, `fleet/*/handler.py` entry names | Yasho2 / Khare | D1–D2 (use the file paths in the repo now) |

## 5. Outputs others depend on
| Output | Consumer | When |
|---|---|---|
| AWS access for all 5 (IAM Identity Center or IAM users with MFA) + **Bedrock model access requested** | everyone | **D1 11:00** |
| Secrets created: `plumetrace/firms_map_key`, `plumetrace/openaq_key`, `plumetrace/telegram` | ingest, Khare | D1 12:00 |
| **GFS sample f000–f072** in `.local-s3` and S3 | **Yasho1 (blocked until then)** | **D1 13:00** |
| `common/s3io.py` key builders + LOCAL mode | Yasho1, Khare | D1 13:00 |
| DataStack (bucket, tables, KMS) | everyone | D1 14:00 |
| ApiStack (Cognito pool + groups + test users, HTTP API, API image) | Yasho2, Tanmay | D1 18:00 |
| **Backfill ERA5 + FIRMS + OpenAQ, Oct–Nov 2024 & 2025** | **Yasho1 (critical path)** | **D1 22:00** |
| EngineStack (Step Functions, schedules, bus, rules) | everyone | D2 14:00 |
| Gov/Fleet/Web stacks | Khare, Yasho2, Tanmay | D2 18:00 |

## 6. Task list
- [ ] **D1 10:30** AWS: account and region us-east-1, access for the team, budget alarm ($50), **Bedrock → Model access → enable the latest Claude** (tell Yasho2 the ID). Get the FIRMS MAP_KEY and the OpenAQ key and put them in Secrets Manager.
- [ ] **D1 11:00** GitHub repo, push this skeleton, branch protection on main, fill the CODEOWNERS handles, CI green on the skeleton.
- [ ] **D1 12:00** `infra/lib/config.ts`, `common/timeutil.py`, `common/aoi.py`; `cdk bootstrap`
- [ ] **D1 13:00** `ingest/gfs.py`: **sample run delivered to Yasho1**; `common/s3io.py`
- [ ] **D1 14:00** `data-stack.ts` deployed; `bin/plumetrace.ts`
- [ ] **D1 15:00** `engine/Dockerfile` (cfgrib decode tested *inside* the image); `ingest/firms.py`
- [ ] **D1 16:00** `ingest/openaq.py`, `ingest/resolve_run.py`, `tests/engine/test_ingest_parsers.py`
- [ ] **D1 18:00** `api-stack.ts` (Cognito + groups + one test user per group, HTTP API, API container); `common/ddb.py`; `infra/README.md`
- [ ] **D1 18:00 → 22:00** Start the **backfills** in the background on an EC2 box (or SageMaker notebook) in us-east-1: `firms_archive.py`, `openaq_archive.py`, `era5.py`
- [ ] **D2 12:00** `handlers.py`, `publish/publish_event.py`
- [ ] **D2 14:00** `engine-stack.ts`: Step Functions per §9 (Parallel, Map, retries, FIRMS degraded catch), Scheduler 04/10/16/22 UTC, bus `plumetrace-<stage>`, rules, hourly verify
- [ ] **D2 18:00** `gov-stack.ts`, `fleet-stack.ts` (IoT rule, Location route calculator + map + API key, KMS grants), `web-stack.ts` (Amplify). **CHECKPOINT 1: turn the scheduler ON.**
- [ ] **D2 PM** Glue database + crawlers on `curated/` and `features/` (Athena queries for the slides)
- [ ] **D3 12:00** `observability-stack.ts` (dashboard + alarms → SNS email)
- [ ] **D3 13:00** AC1: 3 consecutive green runs in < 15 min. AC8 audit: no secrets in git, scoped IAM, RiderHealth decryptable only by the dose Lambda.
- [ ] **D3 18:00** `docs/COST.md` (Cost Explorer), architecture diagram (`docs/architecture.png`), deploy the `demo` stage from main.

## 7. How to implement (key guidance)

**GFS partial download (`ingest/gfs.py`)**
```python
base = f"https://noaa-gfs-bdp-pds.s3.amazonaws.com/gfs.{ymd}/{hh}/atmos/gfs.t{hh}z.pgrb2.0p25.f{fff:03d}"
idx = requests.get(base + ".idx").text.splitlines()      # "n:offset:d=YYYYMMDDHH:VAR:LEVEL:fcst:"
# for each wanted (VAR, LEVEL): start = offset(line i), end = offset(line i+1) - 1  (last record: open-ended)
# GET base with header Range: bytes=start-end ; concatenate chunks into one .grib2 temp file
ds = xr.open_dataset(tmp, engine="cfgrib", backend_kwargs={"filter_by_keys": {...}})  # open per level type, merge
```
- Wanted: `UGRD/VGRD` at `10 m above ground`, `925 mb`, `850 mb`; `HPBL:surface`; `TMP:2 m above ground`; `RH:2 m above ground`.
- cfgrib can't open mixed level types in one go. Open with `filter_by_keys={'typeOfLevel': 'heightAboveGround', 'level': 10}` and similar for each group, rename to `u10 v10 u925 v925 u850 v850 hpbl t2m rh2m`, merge, crop to AOI ± 1° (lon 72.5–79, lat 26.5–33.7), and save NetCDF.
- `herbie-data` can do all of this. Use it if it's faster for you, but the output variable names are the contract.
- Map state: one Lambda call per forecast hour (73 calls, MaxConcurrency 20). Each call is about 10 MB of download.
- **Past-hour winds:** for back-trajectories from issue time, also fetch f000–f005 of the 2 previous cycles (`raw/gfs/run=<prev>/`). Yasho1 needs them.

**FIRMS.** `https://firms.modaps.eosdis.nasa.gov/api/area/csv/{KEY}/{SOURCE}/73.5,27.5,78.0,32.7/1`. Build `acq_ts` from acq_date + acq_time (HHMM, zero-pad). Drop `confidence == 'l'`. De-dup. For the backfill use the same URL with `/{DAY_RANGE}/{YYYY-MM-DD}`, DAY_RANGE ≤ 5, and sleep between calls (rate limit per key per 10 min; VERIFY).

**OpenAQ v3.** `GET /v3/locations?bbox=73.5,27.5,78,32.7&parameters_id=2&limit=1000` (VERIFY that parameter 2 = pm25). Then for each PM2.5 sensor, `GET /v3/sensors/{id}/hours?datetime_from=&datetime_to=`. QC per §6.5. Receptors are the locations inside lon 76.8–77.6, lat 28.3–28.95. If Delhi coverage is thin, record it in HANDOFFS and evaluate the data.gov.in CPCB feed.

**ERA5 backfill.** Read `s3://nsf-ncar-era5` anonymously (`--no-sign-request`). The surface files are monthly per variable (`e5.oper.an.sfc/YYYYMM/...128_165_10u...`, `128_166_10v`, `128_159_blh`, `128_167_2t`, `128_168_2d`). Pressure-level files are daily (`e5.oper.an.pl/YYYYMM/...128_131_u...`, `128_132_v`): select level 925/850 right after opening to save RAM. Normalise longitudes to −180..180 and latitudes to ascending. Compute rh2m from 2t/2d (Magnus formula). Write hourly files with **the same variable names as GFS**. Run it on an EC2 `m6i.large` in us-east-1 with `nohup` overnight. Don't do it on a laptop (egress, time).

**EngineRun state machine (§9).** ResolveRun → Parallel(IngestFIRMS [Catch → set degraded], Map(IngestGFS f000..f072), IngestOpenAQ) → BackTrajectories → Attribution → Forecast → Gridding → Summarize → Publish. Retry on ingest steps: 2× with exponential backoff. Pass only `{run_id, degraded[]}` between states. Use one Docker image with a different `cmd` per function (`plumetrace_engine.handlers.<name>`). Memory: trajectories/forecast 4–6 GB, ingest 1–2 GB, timeout 15 min.

**API stack.** HTTP API + JWT authorizer (issuer = Cognito pool, audience = app client). The API Lambda is a DockerImageFunction from `api/Dockerfile` (build context = repo root). Check with Yasho2 whether `/agent/chat` needs a Lambda Function URL with RESPONSE_STREAM (see YASHO2.md §7). Create the Cognito groups `gov`, `fleet`, `admin` and one demo user per group.

**Least privilege (AC8).** Use CDK `grant*` methods only. Never use `*` actions. Only the `fleet/dose` role gets `kms:Decrypt` on the RiderHealth key. S3 Block Public Access is on, and reports and audio are served with presigned URLs only.

## 8. Done checks
- `npx cdk synth -c stage=dev` is clean. `pytest tests/engine/test_ingest_parsers.py` passes.
- AC1: 3 consecutive scheduled EngineRuns each finish green in < 15 min.
- AC2: one `forecast.published` shows invocations of both `gov/autoDraft` and `fleet/dose` in CloudWatch.
- The CloudWatch dashboard shows run duration, failures and data freshness.

## 9. Gotchas
- GFS files appear about 3.5 h after the cycle. `resolve_run` must check that `f072.idx` exists, not just f000.
- The `eccodes` binary in Lambda is the #1 risk (§20). Test decoding inside the container on D1, not on D2.
- The Step Functions payload limit is 256 KB. Pass S3 keys, never data.
- Keep data out of git (`.gitignore` covers *.nc, *.parquet, .local-s3).
- Turn the scheduler ON at CP1 (D2 18:00). AC4 needs ≥ 24 h of live forecast vs observations by the final demo.
