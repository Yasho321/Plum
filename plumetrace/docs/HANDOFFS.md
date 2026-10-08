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
