# PlumeTrace infrastructure (AWS CDK)

> OWNER    : Tejas
> DUE      : D1 18:00
> TASK     :
>   How to bootstrap and deploy: `npm ci`, `npx cdk bootstrap`, `npx cdk deploy --all -c stage=dev`, how to set secrets, how to redeploy just one stack.
> DONE WHEN: Any teammate can deploy from scratch by following it.
> GUIDE    : docs/team/TEJAS.md  |  brief: docs/PROJECT_BRIEF.md
> STATUS   : WIP  (deploy steps written; the end-to-end "deploy from scratch" check needs an AWS account — run it once creds exist)

All resources are in **us-east-1**, named `pt-<stage>-*` (stages `dev` shared, `demo` from `main`).
Config lives in [`lib/config.ts`](lib/config.ts) — nothing else hard-codes a name.

## Prerequisites
- Node 20, AWS CLI v2, Docker running (EngineStack and ApiStack build container images).
- AWS creds for the shared account (`aws configure sso` or access keys). Check with `aws sts get-caller-identity`.
- **Bedrock → Model access → enable the latest Claude** in us-east-1 (needed by AgentStack/ApiStack). Put the model id in `cdk.json` context `bedrockModelId` and tell Yasho2.

## 1. Install + bootstrap (once per account/region)
```bash
cd infra
npm ci
npx cdk bootstrap aws://<account-id>/us-east-1
```

## 2. Secrets (names only in git — set the values once, never commit them)
```bash
aws secretsmanager create-secret --name plumetrace/firms_map_key --secret-string '<FIRMS_MAP_KEY>'
aws secretsmanager create-secret --name plumetrace/openaq_key     --secret-string '<OPENAQ_KEY>'
aws secretsmanager create-secret --name plumetrace/telegram       --secret-string '{"bot_token":"...","chats":{"gov":"...","farmer_demo":"...","rider_demo":"..."}}'
# optional (Sentinel-5P stretch): plumetrace/cdse
```

## 3. Deploy
```bash
# everything, dev stage
npx cdk deploy --all -c stage=dev --require-approval never

# one stack (dependency order: Data → Engine → Gov → Fleet → Agent → Api → Web → Observability)
npx cdk deploy PtData-dev -c stage=dev
npx cdk synth  -c stage=dev            # inspect without deploying (DataStack needs no Docker)
npx cdk diff   PtEngine-dev -c stage=dev
```
Optional context: `-c alarmEmail=you@example.com` (ObservabilityStack SNS), `-c stage=demo` (prod-like, retains data).

## 4. Post-deploy
```bash
# Cognito demo passwords (users gov@/fleet@/admin@plumetrace.demo were created without one)
aws cognito-idp admin-set-user-password --user-pool-id <PtApi output UserPoolId> \
  --username gov@plumetrace.demo --password '<pick-one>' --permanent

# Kick a manual engine run (no need to wait for the 04/10/16/22 UTC schedule)
aws stepfunctions start-execution --state-machine-arn <PtEngine output StateMachineArn> --input '{}'
```

## 5. Local dev without AWS (so nobody is blocked — RULE 5)
- Python engine: `PT_LOCAL=1` reads/writes `./.local-s3/` instead of S3. Run a handler:
  `PYTHONPATH=engine PT_LOCAL=1 python -m plumetrace_engine.handlers resolve_run '{"run_id":"2026-10-09T00Z"}'`
- API: `cd api && MOCK_MODE=1 bun run dev`  ·  Web: `cd web && VITE_USE_MOCKS=1 npm run dev`
- Engine unit tests: `python -m pytest tests/engine`

## Stacks
| Stack | What |
|---|---|
| `PtData-<stage>` | S3 bucket (Block Public Access, raw/ 14-day lifecycle), §8.1 DynamoDB tables (on-demand) + Forecast `byRun` GSI + TTL, RiderHealth KMS CMK, Glue db + crawlers |
| `PtEngine-<stage>` | Custom bus, one container image for all states, Step Functions `EngineRun`, schedules (04/10/16/22 UTC) + hourly verify |
| `PtApi-<stage>` | Cognito pool + groups (gov/fleet/admin) + demo users, HTTP API + JWT authorizer, Bun API container, SSE Function URL |
| `PtObs-<stage>` | CloudWatch dashboard + EngineRun failure/slow alarms → SNS email |
| `PtGov` / `PtFleet` / `PtWeb` / `PtAgent` | Gov Lambdas; fleet dose/replanner + Location; Amplify hosting; Bedrock guardrail (Yasho2) |

## Teardown (dev only)
```bash
npx cdk destroy --all -c stage=dev
```
`dev` resources use `RemovalPolicy.DESTROY` (bucket auto-empties); `demo` retains data on purpose.
