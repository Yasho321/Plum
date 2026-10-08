# Handoffs and change requests

> Use this when you (or your AI agent) need something from a file you don't own, or are blocked by someone.
> Append a row, ping the owner in the chat, and the owner sets the status. Keep it short.

| # | From | To (owner) | File / thing | Request | Needed by | Status |
|---|---|---|---|---|---|---|
| 1 | Yasho1 | Tejas | `engine/plumetrace_engine/ingest/gfs.py` | Sample run f000–f072 with vars u10 v10 u925 v925 u850 v850 hpbl t2m rh2m | D1 13:00 | OPEN |
| 2 | Yasho1 | Khare | `static/districts.geojson` | ADM2 districts for Punjab, Haryana, Delhi and UP with a `district` name property | D1 14:00 | OPEN |
| 3 | Yasho2 | Khare | `fleet/dose/dose.py` | Function signatures as in the file header (the re-planner imports them) | D1 14:00 | OPEN |
| 4 | Yasho1 | Tejas | `training/backfill/*` | ERA5 + FIRMS + OpenAQ for Oct–Nov 2024/2025 in S3 | D1 22:00 | OPEN |
| 5 | Tanmay | Yasho2 | mock API URL | Deployed MOCK_MODE API + a Cognito test user per group | D1 14:00 / 18:00 | API READY (runs `MOCK_MODE=1`, all §8.4 routes); needs Tejas to deploy (see #7). Local: `cd api && MOCK_MODE=1 bun run dev` |
| 8 | Yasho1 | Tejas | `common/s3io.py` + `common/ddb.py` | Need the real key builders + batch DynamoDB writers (currently stubs) to wire `model/infer.run_forecast` (StationForecast+Attribution writes), `gridding` Forecast writes, `verify/fill_obs`, and `scripts/run_engine_local.sh`. All my science modules are DONE and return contract-shaped objects; only the S3/DDB write path is blocked. | D1 18:00 | OPEN — **blocks my remaining 4 items** |
| 9 | Yasho1 | Tejas | `handlers.py` interfaces | Confirm the function signatures in docs/team/YASHO1.md §7 (run_trajectories/compute_fire_load/run_forecast/run_gridding/run_summarize/run_fill_obs/run_skill). I've kept them stable; handlers just need to call them + do I/O. | D2 12:00 | OPEN |
| 6 | Yasho2 | Tejas | `infra/cdk.json` | Confirm the Bedrock Claude model is enabled in us-east-1 and record its model/inference-profile ID (e.g. `us.anthropic...`) in `infra/cdk.json`; `api/.env` reads it as `BEDROCK_MODEL_ID`. | D1 11:00 | OPEN |
| 7 | Yasho2 | Tejas | ApiStack | Deploy `api/Dockerfile` (Lambda Web Adapter, `AWS_LWA_INVOKE_MODE=response_stream` for SSE). **VERIFY HTTP API streaming**; if unsupported, expose `/agent/chat` via a Lambda Function URL `InvokeMode=RESPONSE_STREAM`. Provide the URL + a Cognito test user per group (gov/fleet/admin). Attach AgentStack's `bedrock-access` managed policy to the API role and pass GUARDRAIL_ID/VERSION + BEDROCK_MODEL_ID as env. | D1 14:00 | OPEN |
| 10 | Yasho2 | Tejas | DataStack Forecast GSI `byRun` | Define GSI `byRun` as PK `run_id`, SK `gsi1sk` (String) per DECISIONS D-15 (not `valid_hour#h3` directly). The API reads the map-for-hour via `begins_with(gsi1sk, valid_hour)`. | D1 18:00 | OPEN |
| 11 | Yasho2 | Yasho1 | `gridding` Forecast writer | Write `gsi1sk = "<valid_hour>#<h3>"` on every Forecast item (DECISIONS D-15) so the API's `byRun` map query works. | D2 17:00 | OPEN |
