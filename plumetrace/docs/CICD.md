# CI/CD — auto-deploy to AWS from GitHub

This sets up **push-to-deploy** for the live "Claude over mocks" demo
(`PtData` + `PtApi` + `PtWeb`) using **GitHub Actions + AWS OIDC** (no long-lived
AWS keys stored in GitHub). The workflow is `.github/workflows/deploy.yml`.

## Where it runs
- On **your fork `codeforlifeee/Plum`** — you control its Actions, secrets and variables.
  (You can't run it on `Yasho321/Plum`: no admin there, and you shouldn't deploy someone
  else's `main` into your AWS account.)
- Triggered by **pushes to a `deploy` branch**, or manually from the **Actions tab → Run workflow**.
- CI (lint/tests/build/synth in `ci.yml`) already runs on PRs and `main`; this is the deploy half.

## Branch model (recommended)
| Branch | Purpose |
|---|---|
| `main` (fork) | clean mirror of upstream; sync + open PRs from here |
| feature branches (`tejas/ui-revamp`, `tejas/engine-handlers`, …) | work + PRs |
| **`deploy`** | the single "this is live" line — pushing here deploys |

Seed `deploy` from the most complete deployable commit (`tejas/ui-revamp`), then merge into
it whenever you want a release:
```bash
git checkout -b deploy tejas/ui-revamp
git push -u fork deploy        # first push triggers the pipeline (after one-time setup below)
# later:  git checkout deploy && git merge <feature> && git push fork deploy
```

## One-time setup

### 1. Store the Anthropic key in Secrets Manager (in the SAME region as config.ts REGION = ap-south-1)
```bash
aws secretsmanager create-secret --name plumetrace/anthropic_key \
  --secret-string 'sk-ant-REPLACE' --region ap-south-1
# re-run later with: aws secretsmanager put-secret-value --secret-id plumetrace/anthropic_key --secret-string 'sk-ant-…' --region ap-south-1
```

### 2. Create the GitHub OIDC provider + deploy role in AWS (once per account)
```bash
ACCT=$(aws sts get-caller-identity --query Account --output text)

# OIDC provider (skip if it already exists)
aws iam create-open-id-connect-provider \
  --url https://token.actions.githubusercontent.com \
  --client-id-list sts.amazonaws.com \
  --thumbprint-list 6938fd4d98bab03faadb97b34396831e3780aea1 || true

# Trust policy — only this repo's `deploy` branch (and manual runs on it) may assume the role
cat > trust.json <<JSON
{ "Version": "2012-10-17", "Statement": [{
  "Effect": "Allow",
  "Principal": { "Federated": "arn:aws:iam::${ACCT}:oidc-provider/token.actions.githubusercontent.com" },
  "Action": "sts:AssumeRoleWithWebIdentity",
  "Condition": {
    "StringEquals": { "token.actions.githubusercontent.com:aud": "sts.amazonaws.com" },
    "StringLike":   { "token.actions.githubusercontent.com:sub": "repo:codeforlifeee/Plum:ref:refs/heads/deploy" }
  }
}]}
JSON

aws iam create-role --role-name plumetrace-gha-deploy --assume-role-policy-document file://trust.json

# Permissions: CDK deploy touches many services. For a hackathon, PowerUserAccess + IAM is simplest.
aws iam attach-role-policy --role-name plumetrace-gha-deploy --policy-arn arn:aws:iam::aws:policy/PowerUserAccess
aws iam attach-role-policy --role-name plumetrace-gha-deploy --policy-arn arn:aws:iam::aws:policy/IAMFullAccess

echo "Role ARN: arn:aws:iam::${ACCT}:role/plumetrace-gha-deploy"
```
> Tighter alternative: scope to the CDK bootstrap roles only —
> `arn:aws:iam::<acct>:role/cdk-*` via `sts:AssumeRole` + `cloudformation:*`. PowerUser+IAM is fine to start.

### 3. Add GitHub repo secrets + variables (fork → Settings → Secrets and variables → Actions)
| Kind | Name | Value |
|---|---|---|
| **Variable** | `AWS_REGION` | `ap-south-1` (must equal `REGION` in `infra/lib/config.ts`) |
| **Secret** | `AWS_DEPLOY_ROLE_ARN` | the role ARN from step 2 |
| **Secret** (optional) | `DEMO_PASSWORD` | e.g. `Demo#2026` — sets gov/fleet/admin demo passwords automatically |

### 4. (optional) Protect the deploy with a review gate
The workflow uses a GitHub **Environment** named `aws-demo`. In the fork settings →
Environments → `aws-demo`, you can add yourself as a **required reviewer** so each deploy
waits for a click. Remove the `environment:` line in `deploy.yml` to deploy with no gate.

## What each run does
1. Assumes the AWS role via OIDC and resolves the account id.
2. `cdk bootstrap` (idempotent).
3. Deploys `PtWeb` → reads `SiteUrl` / `SiteBucketName` / `DistributionId`.
4. Deploys `PtData` + `PtApi` with `coreOnly=1 agentLive=1 webOrigin=<SiteUrl>` → reads
   `ApiUrl` / `UserPoolId` / `UserPoolClientId` / `CognitoDomain`.
5. Writes `web/.env.production`, `npm run build`, `s3 sync`, CloudFront invalidation.
6. Optionally sets the three demo passwords. Prints the live URL in the run summary.

## Notes
- **Region must match** `config.ts REGION` (ap-south-1) everywhere — the CLI commands and the
  Secrets Manager secret all live there.
- The API image builds with **Docker**, which is preinstalled on `ubuntu-latest` runners.
- First deploy of a brand-new account also needs the bootstrap (handled in step 2 of the run).
- To tear down: `cd infra && npx cdk destroy "PtApi-dev" "PtWeb-dev" "PtData-dev" -c stage=dev -c coreOnly=1 --force`.
- Going beyond the demo (full engine/gov/fleet, Telegram) — see `DEPLOYMENT.md` Appendix B.
