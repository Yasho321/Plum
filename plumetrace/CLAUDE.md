# PlumeTrace: instructions for AI coding agents

You are helping one member of a 5-person hackathon team (Tejas, Tanmay, Khare, Yasho1, Yasho2) build **PlumeTrace**.
PlumeTrace is a source-attributed 72-hour PM2.5 forecast for Delhi-NCR, with a government module, a fleet module and a Bedrock Copilot, all on AWS.

## Start of every session
1. Find out which teammate you are working for. The user will say "I am <NAME>". If they don't, **ask before editing anything**.
2. Read `docs/team/<NAME>.md` (your playbook) and `PROJECT_PLAN.md` §3–§6.
3. Read the brief sections your playbook lists (`docs/PROJECT_BRIEF.md`). When the brief and your own assumptions conflict, **the brief wins**. Where the stack differs from the brief (React/Vite instead of Next.js; Express on Lambda instead of Bedrock Agents), `docs/DECISIONS.md` wins.
4. Pick the next file in your playbook whose header says `STATUS : TODO`, ordered by `DUE`. Set it to `WIP` when you start and `DONE` when its `DONE WHEN` check passes.

## Hard rules
- **Only edit files whose header `OWNER` is your teammate.** If you need a change elsewhere, append a request to `docs/HANDOFFS.md` and tell the user to ping the owner.
- **`contracts/` is frozen after D1 12:00.** Never change a schema, mock or event shape without Yasho2's approval and a `docs/DECISIONS.md` entry. Code against the contracts, never against another person's internals.
- **Never commit secrets.** Keys live in AWS Secrets Manager (`plumetrace/firms_map_key`, `plumetrace/openaq_key`, `plumetrace/telegram`, `plumetrace/cdse`). Use `.env.example` for names only.
- **All times are UTC ISO-8601 with `Z`** in storage and APIs. Convert to IST only in the UI and in generated text. Coordinates are `[lon, lat]` in GeoJSON and `(lat, lon)` in function arguments.
- **No magic numbers** in science code. Every ASSUMPTION parameter lives in `engine/plumetrace_engine/config.py`.
- **User-facing numbers** show the range: "31 % (22–40 %)". Toward farmers, the tone is supportive and never blaming. Fleet data is labelled SIMULATED.
- **The agent never executes actions.** Outbound actions are drafts that a human approves through `POST /actions/{id}/approve`.
- Keep the file header (OWNER/DUE/TASK/DONE WHEN/STATUS) at the top of each file. Update its STATUS.
- Match the code style of `Yasho321/NotebookLM-Clone`: ESM JavaScript, `asyncHandler`, zod validation middleware, pino logging, fail-fast env validation, small controllers and routes. Python is 3.12 with type hints and pure functions where possible.

## Local dev without waiting for others
- API: `cd api && MOCK_MODE=1 bun run dev` serves `contracts/mocks`.
- Python: `PT_LOCAL=1` makes `common/s3io.py` read and write `./.local-s3/` instead of S3. Tests: `pytest tests/<area>`.
- Web: `VITE_USE_MOCKS=1 npm run dev`.
- Lambdas take contract-shaped JSON. Invoke them locally with a sample from `contracts/mocks`.

## Repo map
`contracts/` shared schemas and mocks · `infra/` CDK · `engine/` Python pipeline · `training/` model training · `api/` Bun/Express API and agent · `gov/` Node Lambdas · `fleet/` Python simulator, dose and re-planner · `web/` React app · `tests/` · `docs/` brief, plan, decisions, handoffs, team playbooks.
