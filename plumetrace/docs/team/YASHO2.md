# YASHO2: AI and Backend Lead (Bun/Express, Bedrock, OR-Tools) and Integration Lead

> **For the AI agent:** you work for **Yasho2**. Follow `CLAUDE.md` rules. Work through the task list below in order of `DUE`.
> Edit only files whose header says `OWNER : Yasho2`. Mark the header `STATUS` as WIP/DONE as you go.

## 1. Mission
You own every seam between people and the product's "brain" for decisions:
1. **Contracts and mocks (first 2 hours):** they unblock all four teammates. This is your most important deliverable of the hackathon.
2. **The REST API** (Bun + Express 5 on Lambda): every route in brief §8.4, mock mode first, then real.
3. **PlumeTrace Copilot:** a Bedrock (Claude) ConverseStream tool-use loop with a Guardrail, streaming tool steps over SSE, drafts only.
4. **Approvals:** the action state machine and `action.approved` events.
5. **Fleet re-planner:** OR-Tools CP-SAT plus a greedy fallback, and the Amazon Location route matrix.
6. **Integration lead:** run the checkpoints (docs/INTEGRATION.md), keep DECISIONS.md current, and write the README.

## 2. Read first
Brief **§8 (all)**, **§11 (all)**, §13.3, §15, §17 AC5/AC7/AC9, §2.4 positioning rules. docs/DECISIONS.md (you curate it). Look at `Yasho321/NotebookLM-Clone/backend` for code style (env.js fail-fast, asyncHandler, validate middleware, pino, SSE chat controller).

## 3. You own
```
contracts/**                       (zod, JSON Schema export, pydantic mirror, actionsRepo, mocks)
api/**                             (Express app, controllers, middlewares, agent/, tests, Dockerfile)
infra/lib/agent-stack.ts           (Guardrail + Bedrock IAM)
fleet/replanner/**, fleet/requirements.txt
tests/fleet/test_replanner.py, tests/contracts/test_mocks_validate.py
scripts/seed_mocks.py, scripts/demo_reset.sh
docs/DECISIONS.md, docs/INTEGRATION.md, README.md
```

## 4. Inputs you depend on
| Input | From | When | While waiting |
|---|---|---|---|
| DataStack tables/bucket, ApiStack (Cognito, HTTP API, image deploy) | Tejas | D1 14:00 / 18:00 | Run locally with `MOCK_MODE=1`; `bun run dev` |
| Bedrock model access in us-east-1 | Tejas (console request) | D1 11:00 | Test with your own account/profile |
| `fleet/dose/dose.py` + `fleet/common/forecast_lookup.py` | Khare | D1 14:00 / 18:00 | Stub them with the same signatures |
| Gov Lambdas: report, farmer alert, fireTrend, rider notify | Khare | D2 13:00–D3 11:00 | Tools return mock drafts in MOCK_MODE |
| Real engine outputs | Yasho1 | D2 17:00 | `scripts/seed_mocks.py` loads mocks into DynamoDB/S3 |

## 5. Outputs others depend on
| Output | Consumer | When |
|---|---|---|
| `contracts/` schemas + all mocks + pydantic mirror | everyone | **D1 12:00 FREEZE** |
| Deployed API in MOCK_MODE (URL in the team chat) | Tanmay | D1 14:00 |
| `actionsRepo` (JS + Python) | Khare | D1 18:00 |
| Chat SSE event stream (`ChatStreamEvent`) | Tanmay | D1 12:00 (mock), D2 10:00 (real) |
| `action.approved` events from approve | Khare executor | D2 14:00 |
| Re-planner Lambda (`draftShiftPlan` contract) | Khare dose handler, agent | D2 20:00 |

## 6. Task list
- [ ] **D1 10:30** Confirm the Bedrock Claude model is enabled in us-east-1 (with Tejas). Record the model/inference-profile ID in `infra/cdk.json`.
- [ ] **D1 12:00** Contracts: `dynamo.js`, `events.js`, `api.js`, `agentTools.js`, `index.js`, export + validate scripts, **11 realistic mocks**, README. Run the freeze meeting.
- [ ] **D1 13:00** Pydantic mirror + `tests/contracts/test_mocks_validate.py`
- [ ] **D1 14:00** API skeleton: `index.js`, `app.js`, `env.js`, `logger.js`, `asyncHandler`, all routes, `mockStore.js`, `.env.example`; Dockerfile (LWA). Deploy it with Tejas and post the URL.
- [ ] **D1 18:00** `auth.middlewares.js` (Cognito groups), `validate`, `error`; `actionsRepo` JS + Python; `agent-stack.ts` (Guardrail)
- [ ] **D1 20:00** `systemPrompt.js`
- [ ] **D1 23:00** `agent/loop.js`, `tools/index.js`, `shared.tools.js` on mocks; SSE controller
- [ ] **D2 12:00** Real `forecast.controllers.js` + `actions.controllers.js` (approve → EventBridge); `scripts/seed_mocks.py`
- [ ] **D2 14:00** `gov.tools.js` (invoke Khare's Lambdas); `fleet.controllers.js`
- [ ] **D2 16:00** `fleet/replanner/greedy.py` (**build first, it guarantees the demo**)
- [ ] **D2 18:00 CHECKPOINT 1** (you run it); `fleet.tools.js`
- [ ] **D2 20:00** `route_matrix.py`, `cpsat_model.py`, `handler.py`, `tests/fleet/test_replanner.py`, `api/tests/contract.test.js`
- [ ] **D3 12:00** AC5 demo question reliable (5/5 runs); `riders` routes (erase/consent)
- [ ] **D3 13:00 CHECKPOINT 2** (you run it)
- [ ] **D3 20:00** `demo_reset.sh`, bug bash, README draft
- [ ] **D4 10:00** README final (AC9)

## 7. How to implement (key guidance)

**Contracts (do these fast but carefully; everyone builds on them)**
- One zod schema per DynamoDB item, event detail, API response and agent tool I/O. Use snake_case field names everywhere (they are also the DynamoDB attribute names). Timestamps are `z.string().regex(/Z$/)`.
- The mocks must be **realistic and internally consistent** (same run_id `2026-10-09T00Z` everywhere, Sangrur/Patiala top, 31 % (22–40 %) Delhi fire share, about 8 riders over budget). Tanmay's whole UI and Khare's templates are built on them, and they become the backup demo data.
- `chat_stream.jsonl` records the ideal answer to "Tomorrow morning looks severe. What should we do?": 4 read tools → 4 draft tools → a final summary with ranges, expected impact and "awaiting your approval".

**API on Lambda**
- The Dockerfile copies the Lambda Web Adapter extension. Set `AWS_LWA_INVOKE_MODE=response_stream` so SSE streams through API Gateway → Lambda (function URL / HTTP API with streaming; VERIFY HTTP API streaming support). **If streaming through the HTTP API isn't supported**, expose `/agent/chat` via a **Lambda Function URL** with `InvokeMode: RESPONSE_STREAM` and verify the Cognito JWT in your auth middleware. Tell Tejas on D1.
- Read routes: S3 summary.json via the `outputs/latest.json` pointer; Forecast via GSI `byRun` (`run_id = :r AND begins_with(sk, :validHour)`); build H3 polygons with `h3-js` `cellToBoundary(cell, true)` (GeoJSON order).
- Approve: `transition(id, 'draft' → 'approved')` with a ConditionExpression (double clicks become a 409), set `approved_by = req.user.sub`, `PutEvents(source 'plumetrace.agent', 'action.approved', detail = item)`.

**Copilot loop (`agent/loop.js`)**
```
messages = [...history, {role:'user', content:[{text}]}]
for turn in 1..10:
  stream = ConverseStream({modelId, system:[{text: SYSTEM_PROMPT}], messages, toolConfig, guardrailConfig:{guardrailIdentifier, guardrailVersion, streamProcessingMode:'async'}})
  collect text deltas → emit {type:'text'}; collect toolUse blocks (input JSON is streamed as string chunks — concatenate then JSON.parse)
  if stopReason !== 'tool_use': emit done; break
  for each toolUse: emit tool_call → zod-validate → run → emit tool_result (+ action_drafted if result has action_id)
  messages.push(assistant msg, user msg with toolResult blocks)
```
- Tool specs: `z.toJSONSchema(schema)` → `{toolSpec:{name, description, inputSchema:{json}}}`. Write very clear tool descriptions; they matter more than the prompt.
- There are no execute tools at all. That is the prompt-injection defence (brief §15).
- Guardrail: deny topic "personal information about individual farmers"; contextual grounding check against tool results if available; word filters for blaming language.

**Re-planner**
- Precompute for each order o, rider r and slot s: the travel minutes (route matrix) and the dose coefficient (`dose.segment_dose_ug` × `ConcLookup` along the route cells at slot s). Keep it small: 30-min slots over 06:00–23:00 IST, and limit candidate riders per order to the 8 nearest home bases.
- CP-SAT: `x[o,r,s] ∈ {0,1}`, Σ_{r,s} x = 1 per order. For non-flexible orders, s is fixed to the original slot. For flexible orders, s is within the window. Rider capacity is 1 order per slot (approximation). Rider dose is `Σ coef·x`, and the dose % is integer-scaled ×100. `max_pct ≥ pct_r`. Objective: `1000·max_pct + total_dose + 2·extra_minutes`. Set `max_time_in_seconds=30, num_workers=8`. The 100 % budget is soft with a penalty of 10⁶.
- On timeout or infeasibility, use `greedy.py`. Always report `solver: "cpsat" | "greedy"` in the payload.
- Output `dose_reduction_pct` = {fleet total, worst rider} and `extra_minutes` (average and total). These feed the demo line "−34 % worst-rider exposure, +6 min average".

## 8. Done checks
- `cd contracts && npm run validate` passes; `pytest tests/contracts tests/fleet -q` passes; `cd api && MOCK_MODE=1 bun test` passes.
- AC5: 5 consecutive Copilot runs each produce ≥ 1 gov draft and ≥ 1 fleet draft, and quote p10–p90 ranges.
- AC7: `draftShiftPlan` for 50 riders returns in < 60 s, including the route matrix (warm cache).

## 9. Gotchas
- Do **not** use `compression()` on the SSE route. Flush headers immediately and send a heartbeat comment every 15 s.
- The Bedrock model ID is often an **inference profile** (`us.anthropic...`). Use exactly what the console shows.
- Bedrock throttles under load. Retry once with jitter and show a friendly error event.
- DynamoDB scans are fine at demo scale. Don't over-engineer GSIs beyond `byRun`.
- Never return RiderHealth conditions over the API. Return only the budget %.
