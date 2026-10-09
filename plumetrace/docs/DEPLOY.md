# PlumeTrace — keys, env & deployment

> Everything you must provide to run PlumeTrace for real, how to obtain each
> value, and the end-to-end deploy steps. Local demo needs **none** of this.

## 0. Local demo (no keys, no AWS)
```bash
cd api && bun install && cd ../web && npm install   # once
# then, from repo root:
bash scripts/demo_local.sh          # API :8080 (MOCK_MODE) + web :5173
# open http://localhost:5173
```

---

## 1. Accounts & API keys — what to get and how

| # | Key / access | Used for | How to get it | Free? |
|---|---|---|---|---|
| 1 | **NASA FIRMS `MAP_KEY`** | satellite fire detections | https://firms.modaps.eosdis.nasa.gov/api/map_key/ → enter email → key mailed instantly | ✅ |
| 2 | **OpenAQ API key** | ground PM2.5 (CPCB) | https://explore.openaq.org/ → register → Account → API Keys → create | ✅ |
| 3 | **Telegram bot token + chat ids** | live alert delivery (text+audio) to a phone | In Telegram, message **@BotFather** → `/newbot` → copy token. Add the bot to a group/DM, send a message, then `https://api.telegram.org/bot<token>/getUpdates` to read each `chat.id` | ✅ |
| 4 | **AWS account + Bedrock model access** | the Copilot (Claude) + all infra | AWS Console → **Bedrock → Model access** (us-east-1) → enable the latest Claude → copy the model/inference-profile id (e.g. `us.anthropic.claude-...`) | pay-as-you-go |
| 5 | **Amazon Location** API key + map style | prod base map tiles | AWS Console → **Amazon Location Service** → Maps → create map (e.g. `Esri Dark Gray`) → create an API key → style descriptor URL. *(Local uses a keyless Esri basemap, so this is prod-only.)* | low cost |
| 6 | *(optional)* **CDSE** OAuth client | Sentinel-5P layer (stretch) | https://dataspace.copernicus.eu → register → Dashboard → OAuth clients → create (client_id + secret) | ✅ |

## 2. Secrets Manager (set the values once — never commit them)
```bash
aws secretsmanager create-secret --name plumetrace/firms_map_key --secret-string '<FIRMS_MAP_KEY>'
aws secretsmanager create-secret --name plumetrace/openaq_key     --secret-string '<OPENAQ_KEY>'
aws secretsmanager create-secret --name plumetrace/telegram \
  --secret-string '{"bot_token":"<TOKEN>","chats":{"gov":"<id>","farmer_demo":"<id>","rider_demo":"<id>"}}'
# optional: aws secretsmanager create-secret --name plumetrace/cdse --secret-string '{"client_id":"...","client_secret":"..."}'
```

## 3. Sample `.env` files

### `api/.env` (local real-mode testing; in prod ApiStack injects these automatically)
```dotenv
NODE_ENV=production
PORT=8080
MOCK_MODE=0
AWS_REGION=us-east-1
CORS_ORIGINS=http://localhost:5173,https://<your-amplify-domain>
# DynamoDB tables (DataStack outputs: pt-<stage>-<Name>)
TABLE_FORECAST=pt-dev-Forecast
TABLE_STATION_FORECAST=pt-dev-StationForecast
TABLE_ATTRIBUTION=pt-dev-Attribution
TABLE_ACTIONS=pt-dev-Actions
TABLE_RIDERS=pt-dev-Riders
TABLE_RIDER_HEALTH=pt-dev-RiderHealth
TABLE_SHIFTS=pt-dev-Shifts
TABLE_ROUTE_CACHE=pt-dev-RouteCache
BUCKET=plumetrace-<account>-us-east-1-dev
BUS_NAME=plumetrace-dev
# Cognito (ApiStack outputs)
COGNITO_POOL_ID=us-east-1_xxxxxxxxx
COGNITO_CLIENT_ID=xxxxxxxxxxxxxxxxxxxxxxxxxx
# Bedrock (from step 1.4 / AgentStack)
BEDROCK_MODEL_ID=us.anthropic.claude-sonnet-4-5-20250929-v1:0
GUARDRAIL_ID=<from AgentStack output>
GUARDRAIL_VERSION=1
# Tool Lambda names/ARNs (Gov/Fleet stacks)
FN_REPORT=
FN_FARMER_ALERT=
FN_FIRE_TREND=
FN_REPLANNER=
FN_RIDER_NOTIFY=
```

### `web/.env` (build the SPA against the deployed API — fill from stack outputs)
```dotenv
VITE_USE_MOCKS=0
VITE_API_URL=https://<HttpApi-url>
VITE_COGNITO_USER_POOL_ID=us-east-1_xxxxxxxxx
VITE_COGNITO_CLIENT_ID=xxxxxxxxxxxxxxxxxxxxxxxxxx
VITE_COGNITO_DOMAIN=pt-dev-<account>.auth.us-east-1.amazoncognito.com
VITE_LOCATION_STYLE_URL=https://maps.geo.us-east-1.amazonaws.com/maps/v0/maps/<MapName>/style-descriptor?key=<LocationApiKey>
# NOTE: never set VITE_DEV_NOAUTH in prod (that is the local-demo auth bypass).
```
> `web/.env.local` in the repo is the **local full-stack** config (`VITE_DEV_NOAUTH=1`, API on :8080). It is git-ignored and not used in prod.

## 4. Deploy (us-east-1, Docker running)
```bash
# one-time
cd infra && npm ci && npx cdk bootstrap aws://<account-id>/us-east-1
# set cdk.json context bedrockModelId to the id from step 1.4
# set the secrets from section 2

# deploy everything (order handled by the app)
npx cdk deploy --all -c stage=dev --require-approval never -c alarmEmail=you@example.com

# post-deploy
aws cognito-idp admin-set-user-password --user-pool-id <PtApi UserPoolId> \
  --username gov@plumetrace.demo --password '<pw>' --permanent   # repeat for fleet@ / admin@
# fill web/.env from PtApi + PtWeb outputs, then build + deploy the web (PtWeb/Amplify)
cd ../web && npm ci && npm run build
```

## 5. Turn on real data & verify (Checkpoints)
```bash
# CP1 — real data replaces mocks
aws stepfunctions start-execution --state-machine-arn <PtEngine StateMachineArn> --input '{}'
#   GET https://<api>/runs/latest should return a real run_id (not the mock)
```
- **CP2** — ask the Copilot *"Tomorrow morning looks severe. What should we do?"* → ≥1 gov + ≥1 fleet draft (AC5) → approve → phone receives text+audio <30 s (AC6).
- Engine runs ×3 <15 min (AC1/AC2); Skill page shows ≥24 h live (AC3/AC4); re-planner (AC7).

Full checkpoint runbook: `docs/INTEGRATION.md`. Infra details: `infra/README.md`.
