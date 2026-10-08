# Handoffs and change requests

> Use this when you (or your AI agent) need something from a file you don't own, or are blocked by someone.
> Append a row, ping the owner in the chat, and the owner sets the status. Keep it short.

| # | From | To (owner) | File / thing | Request | Needed by | Status |
|---|---|---|---|---|---|---|
| 1 | Yasho1 | Tejas | `engine/plumetrace_engine/ingest/gfs.py` | Sample run f000–f072 with vars u10 v10 u925 v925 u850 v850 hpbl t2m rh2m | D1 13:00 | OPEN |
| 2 | Yasho1 | Khare | `static/districts.geojson` | ADM2 districts for Punjab, Haryana, Delhi and UP with a `district` name property | D1 14:00 | OPEN |
| 3 | Yasho2 | Khare | `fleet/dose/dose.py` | Function signatures as in the file header (the re-planner imports them) | D1 14:00 | OPEN |
| 4 | Yasho1 | Tejas | `training/backfill/*` | ERA5 + FIRMS + OpenAQ for Oct–Nov 2024/2025 in S3 | D1 22:00 | OPEN |
| 5 | Tanmay | Yasho2 | mock API URL | Deployed MOCK_MODE API + a Cognito test user per group | D1 14:00 / 18:00 | OPEN |
| 6 | Tejas | Yasho1 | `engine/plumetrace_engine/config.py` | AOI + NCR receptor box now live in `common/aoi.py` (AOI, NCR_RECEPTOR, GFS_CROP_MARGIN_DEG) — please `from plumetrace_engine.common.aoi import AOI, NCR_RECEPTOR` in config.py instead of re-hardcoding those numbers, so there's one source (no-magic-numbers rule). | D1 12:00 | OPEN |
| 7 | Tejas | Yasho1 | `engine/requirements.txt` | Fill in the pinned deps (numpy pandas pyarrow xarray netCDF4 cfgrib eccodes scipy h3>=4 lightgbm shapely scikit-learn boto3 requests pydantic>=2). engine/Dockerfile `pip install -r` it, so the image can't build until it's filled. | D1 15:00 | OPEN |
| 8 | Tejas | Yasho2 | `contracts/src/dynamo.js` | Confirm the Forecast GSI `byRun` sort key. DataStack built it as pk=`run_id`, sk=`valid_hour` (both attrs ddb.py already writes). If the frozen contract uses `valid_hour#h3`, tell me and I'll change the index + ddb item builder. | D1 14:00 | OPEN |
| 9 | Khare | Tejas | Secrets Manager | Create Telegram bot (@BotFather) and put {bot_token, chats:{gov, farmer_demo, rider_demo}} in `plumetrace/telegram` | D1 11:00 | OPEN |
| 10 | Tejas | Yasho1 | `engine/plumetrace_engine/trajectories/winds.py` | handlers.py `trajectories` state calls `winds.build_wind_field(run_id)` to get the WindField, then `ensemble.run_trajectories(run_id, stations, field)` (stations loaded from curated/stations.json). Please expose `build_wind_field(run_id)` (or tell me the real WindField constructor) so the handler wires cleanly. | D2 12:00 | OPEN |
