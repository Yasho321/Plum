# PlumeTrace — Live Demo Deployment Guide (AWS)

This guide deploys a **working, live, hosted demo** of PlumeTrace on AWS:

- **Web** (React SPA) on **S3 + CloudFront** → your public demo link.
- **API** (Bun/Express on Lambda) behind **API Gateway + Cognito login**.
- **Copilot** = the **real Anthropic Claude** agent (Option A), streaming tool‑use + action drafts.
- **All data served from built‑in mocks**, so the map, forecast, attribution, fleet, skill and
  actions pages are fully populated **without** running the heavy engine / gov / fleet pipelines.

> **This is the "live Claude over mock data" demo configuration** (`MOCK_MODE=1` + `AGENT_LIVE=1`,
> deployed with `coreOnly=1`). It deploys only 3 stacks — **PtData, PtApi, PtWeb** — so there's very
> little that can break. Turning on real forecasts/Telegram later is covered in the Appendix.

Everything below has been validated locally: `cdk synth` of these 3 stacks succeeds (API Docker image
builds), `bun test` passes 23/23, and the web builds. You run the `deploy` steps against your account.

---

## 0. Prerequisites (install once)

| Tool | Check | Notes |
|---|---|---|
| **AWS account + CLI** | `aws sts get-caller-identity` | Credentials for the target account. Region **us‑east‑1**. |
| **Docker Desktop** (running) | `docker info` | Needed to build the API container image at deploy time. |
| **Node 20+ & npm** | `node -v` | For CDK + the web build. |
| **Bun** | `bun --version` | API package manager/runtime (`npm i -g bun` if missing). |
| **Anthropic API key** | — | https://console.anthropic.com → API Keys → Create key (`sk-ant-…`). Ensure the account has credits and access to `claude-sonnet-4-6`. |

Clone the repo and note the **repo root** (the folder that contains `api/`, `infra/`, `web/`,
`contracts/`). All paths below are relative to it.

```bash
cd <repo-root>
```

Set your account id once (used throughout):

```bash
export ACCT=$(aws sts get-caller-identity --query Account --output text)
export AWS_REGION=us-east-1
echo "Account=$ACCT Region=$AWS_REGION"
```

---

## 1. Store the Anthropic key in Secrets Manager

The API Lambda reads the key at cold start from the secret `plumetrace/anthropic_key`
(it is **never** committed or baked into the image).

```bash
aws secretsmanager create-secret \
  --name plumetrace/anthropic_key \
  --secret-string 'sk-ant-REPLACE_WITH_YOUR_KEY' \
  --region "$AWS_REGION"
```
> Re‑running? If it already exists, update it instead:
> `aws secretsmanager put-secret-value --secret-id plumetrace/anthropic_key --secret-string 'sk-ant-…' --region "$AWS_REGION"`
>
> A plain `sk-ant-…` string works; `{"api_key":"sk-ant-…"}` also works.

---

## 2. Install deps & bootstrap CDK (once per account/region)

```bash
cd infra
npm ci
npx cdk bootstrap "aws://$ACCT/$AWS_REGION"
```

---

## 3. Deploy the web shell first (to learn your public URL)

The API's CORS rules and Cognito login callback need the **CloudFront URL**, which only exists after
the web stack is created. So deploy the web stack first (it's just an S3 bucket + CloudFront
distribution — no content yet).

```bash
# from infra/
npx cdk deploy PtWeb-dev -c stage=dev -c coreOnly=1 --require-approval never
```

Copy the output **`PtWeb-dev.SiteUrl`** (e.g. `https://d1234abcd.cloudfront.net`) and
**`PtWeb-dev.SiteBucketName`** and **`PtWeb-dev.DistributionId`**.

```bash
export SITE_URL="https://REPLACE.cloudfront.net"        # PtWeb-dev.SiteUrl
export SITE_BUCKET="REPLACE"                            # PtWeb-dev.SiteBucketName
export DIST_ID="REPLACE"                                # PtWeb-dev.DistributionId
```

---

## 4. Deploy Data + API with the live Copilot

Pass your CloudFront URL as `webOrigin` (fixes CORS **and** the Cognito login redirect), and
`agentLive=1` to run the real Claude agent.

```bash
# from infra/  (Docker must be running — it builds the API image here)
npx cdk deploy PtData-dev PtApi-dev \
  -c stage=dev -c coreOnly=1 -c agentLive=1 -c webOrigin="$SITE_URL" \
  --require-approval never
```

From the **`PtApi-dev`** outputs, copy:

```bash
export API_URL="REPLACE"            # PtApi-dev.ApiUrl   (https://xxxx.execute-api.us-east-1.amazonaws.com)
export POOL_ID="REPLACE"            # PtApi-dev.UserPoolId
export CLIENT_ID="REPLACE"          # PtApi-dev.UserPoolClientId
export COGNITO_DOMAIN="REPLACE"     # PtApi-dev.CognitoDomain  (pt-dev-<acct>.auth.us-east-1.amazoncognito.com)
```

---

## 5. Create the demo login passwords

The stack pre‑creates one user per group (`gov@`, `fleet@`, `admin@plumetrace.demo`) with no password.
Set permanent passwords (min 8 chars, upper+lower+digit):

```bash
for u in gov fleet admin; do
  aws cognito-idp admin-set-user-password \
    --user-pool-id "$POOL_ID" \
    --username "$u@plumetrace.demo" \
    --password 'Demo#2026' --permanent --region "$AWS_REGION"
done
```
> Use **`admin@plumetrace.demo` / `Demo#2026`** for the demo — the `admin` group can approve both
> gov and fleet action drafts.

---

## 6. Build the web with real config and publish it

```bash
cd ../web
npm ci   # first time only

cat > .env.production <<EOF
VITE_USE_MOCKS=0
VITE_API_URL=$API_URL
VITE_COGNITO_USER_POOL_ID=$POOL_ID
VITE_COGNITO_CLIENT_ID=$CLIENT_ID
VITE_COGNITO_DOMAIN=$COGNITO_DOMAIN
VITE_LOCATION_STYLE_URL=
EOF

npm run build          # outputs web/dist
```

Publish `dist/` to the site bucket and invalidate the CDN cache:

```bash
aws s3 sync dist/ "s3://$SITE_BUCKET/" --delete --region "$AWS_REGION"
aws cloudfront create-invalidation --distribution-id "$DIST_ID" --paths '/*'
```

> `VITE_LOCATION_STYLE_URL` is left blank — the app falls back to a keyless Esri basemap, which is
> fine for the demo. (For prod map tiles, create an Amazon Location map + API key and set it here.)

---

## 7. Open the live link and run the demo

1. Open **`$SITE_URL`** in a browser.
2. Click **Login** → you're redirected to the Cognito Hosted UI → sign in as
   **`admin@plumetrace.demo` / `Demo#2026`** → you're redirected back to the app.
3. The **Map / Forecast / Attribution / Fleet / Skill / Actions** pages are all populated (mock data).
4. Open the **Copilot** and ask the showcase prompt (AC5):

   > *"Tomorrow morning looks severe. What should we do?"*

   The **real Claude** calls `getForecastSummary`, `getAttribution`, `getFleetExposure`, then drafts a
   district report, a (supportive, non‑blaming) Punjabi farmer alert, a fleet shift plan and rider
   notifications — you'll see the tool steps and **"draft awaiting approval"** cards.
5. Go to **Actions**, **approve** a draft (as `admin`), and watch the status flip to *approved*.

That's the full end‑to‑end demo on a live AWS link. 🎉

---

## 8. Troubleshooting

| Symptom | Cause / Fix |
|---|---|
| Login redirect error (`redirect_mismatch`) | `webOrigin` didn't match the live URL. Re‑run step 4 with the exact `$SITE_URL`, then hard‑refresh. |
| API calls blocked by **CORS** | Same cause — redeploy `PtApi-dev` with the correct `-c webOrigin=$SITE_URL`. |
| Copilot replies *"The assistant hit an error"* | Usually a key problem: secret missing/typo, no Anthropic credits, or no access to `claude-sonnet-4-6`. Check the API Lambda logs: `aws logs tail /aws/lambda/pt-dev-api --since 10m --follow`. |
| Copilot request **times out (~30s)** | API Gateway HTTP API caps at 30s and buffers (no token streaming). The "what should we do" flow normally finishes in ~15s. If a prompt is too heavy, ask a simpler one, or switch the web to the streaming Function URL (`PtApi-dev.AgentStreamUrl`, set it `AuthType.NONE` in `api-stack.ts`) for true SSE. |
| `cdk deploy` fails pulling the SAM build image | Only affects the **full** app (gov/fleet Node Lambdas). The demo uses `-c coreOnly=1`, which doesn't build them. Make sure you pass `coreOnly=1`. |
| Web shows blank / old content | CloudFront cache — re‑run the `create-invalidation` from step 6. |
| Changed the key | `aws secretsmanager put-secret-value …` then the next cold start picks it up (or redeploy `PtApi-dev`). |

---

## 9. Tear down (stop all spend)

```bash
cd infra
npx cdk destroy PtApi-dev PtWeb-dev PtData-dev -c stage=dev -c coreOnly=1 --force
# optional: remove the key
aws secretsmanager delete-secret --secret-id plumetrace/anthropic_key --force-delete-without-recovery --region "$AWS_REGION"
```

---

## Appendix A — What runs where (demo config)

| Flag | Value | Effect |
|---|---|---|
| `coreOnly` | `1` | Deploy only PtData + PtApi + PtWeb (no engine/gov/fleet/obs). |
| `MOCK_MODE` (API) | `1` (dev stage) | REST + agent tools return rich **mock** data — no engine run needed. |
| `AGENT_LIVE` (API) | `1` (`-c agentLive=1`) | The Copilot runs the **real Anthropic** model (over the mock tool data). |
| `anthropicModel` | `claude-sonnet-4-6` | Override with `-c anthropicModel=<id>`. |

- The API Gateway enforces **Cognito JWT** on every route, so login is real; in `MOCK_MODE` the Lambda
  then treats the caller as `admin`. Approving/rejecting drafts works against the in‑memory mock store.
- The Anthropic key is read from Secrets Manager at runtime (IAM `grantRead`), never committed.

## Appendix B — Going beyond the demo (real data, Telegram) — optional, not required for the demo

These need the heavier stacks and are **not** needed for the live demo:

1. **Real forecasts:** deploy the full app (drop `coreOnly`): `npx cdk deploy --all -c stage=demo -c webOrigin=$SITE_URL`.
   `stage=demo` sets `MOCK_MODE=0`, so the API reads DynamoDB/S3 — you must first run the engine Step
   Function to populate a forecast run (see `docs/DEPLOY.md` §5 / `docs/INTEGRATION.md`).
   - The report Lambda (`reportGenerator`) uses `puppeteer-core` + Chromium, kept **external** in the
     bundle; attach a Chromium Lambda layer before invoking it for real (see `docs/HANDOFFS.md` row 20).
   - Wire the agent's tool Lambdas: pass `toolLambdaArns` (`FN_REPORT`, `FN_FARMER_ALERT`,
     `FN_FIRE_TREND`, `FN_REPLANNER`, `FN_RIDER_NOTIFY`) into `ApiStack` so the gov/fleet **draft** tools
     invoke the real Lambdas instead of returning mock drafts.
2. **Telegram delivery (AC6):** create the bot and store `plumetrace/telegram` (see `docs/DEPLOY.md` §2),
   deploy `PtGov-*`, and the `action.approved` event will deliver text + audio to a phone.

---

*Architecture decision for the Copilot transport: see `docs/DECISIONS.md` D‑17 (Option A — Anthropic API direct).*
