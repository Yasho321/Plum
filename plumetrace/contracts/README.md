# contracts/ — the frozen shared contracts for PlumeTrace

> OWNER    : Yasho2
> DUE      : D1 12:00
> TASK     :
>   Explain: zod = source of truth -> JSON Schema export -> pydantic mirror. Change process after freeze: PR touching contracts/ needs Yasho2 + every affected owner (see CODEOWNERS) and a DECISIONS.md entry.
> DONE WHEN: Team has read it at the D1 12:00 freeze.
> GUIDE    : docs/team/YASHO2.md  |  brief: docs/PROJECT_BRIEF.md
> STATUS   : DONE

This package is the **single source of truth** for brief §8 (DynamoDB items, EventBridge
events, the REST API and the agent tools). Everyone codes against it and against the mocks,
never against another person's internals.

## FROZEN after D1 12:00
Do **not** change a schema, an event shape or a mock without:
1. **Yasho2's approval** and the sign-off of every affected owner (CODEOWNERS), and
2. a one-line entry in [`docs/DECISIONS.md`](../docs/DECISIONS.md).

## The flow: one schema, three consumers
```
         src/*.js  (zod v4)  ◄── SOURCE OF TRUTH
            │
   npm run export │  z.toJSONSchema()
            ▼
     schemas/*.json  (JSON Schema draft 2020-12)  +  schemas/agentToolSpecs.json
            │                                           │
     (read by any tool / docs)              Bedrock ConverseStream toolConfig (api/)
            │
   python/plumetrace_contracts/models.py  (pydantic v2, hand-mirrored 1:1)
            │
   tests/contracts/test_mocks_validate.py  proves JS ⇄ Python agree on every mock
```
- **JS** (`api/`, `gov/`) imports `@plumetrace/contracts` (`file:../contracts`).
- **Python** (`engine/`, `fleet/`) imports `plumetrace_contracts` with `PYTHONPATH=contracts/python`.

## Layout
| Path | What |
|---|---|
| `src/dynamo.js` | DynamoDB item schemas (§8.1) + **key builders** (`forecastPk`, `actionPk`, …) + `ACTION_STATUS_TRANSITIONS` / `canTransition` |
| `src/events.js` | EventBridge details & envelopes (§8.3) incl. `hotspot_villages[]` / `degraded[]` (D-10) |
| `src/api.js` | REST request + response schemas (§8.4) incl. `ChatStreamEvent` (SSE) |
| `src/agentTools.js` | Input/output schemas for the 10 agent tools (§11.2) + the `AGENT_TOOLS` registry |
| `src/index.js` | Barrel re-export |
| `python/plumetrace_contracts/models.py` | Pydantic v2 mirror |
| `mocks/` | One realistic, internally-consistent mock per response/event (the backup demo data) |
| `schemas/` | Generated JSON Schema (run `npm run export`; do not hand-edit) |

## Conventions (brief §7)
- Field names are **snake_case** everywhere (they are the DynamoDB attribute names too).
- Timestamps are **UTC ISO-8601 ending in `Z`**. `run_id` = GFS cycle (`2026-10-09T00Z`);
  `valid_hour` = `2026-10-09T08:00Z`.
- GeoJSON coordinates are `[lon, lat]`; function arguments are `(lat, lon)`.
- User-facing numbers show the range: "31 % (22–40 %)".
- **Never** return `RiderHealth` conditions over the API — only the budget % (§15).

## The mocks tell one story (run `2026-10-09T00Z`)
Peak ~310 µg/m³ (248–372) around 10 Oct 00:30–04:30 UTC. Crop fires ≈ **31 % (22–40 %)** of
Delhi PM2.5, led by **Sangrur 12 %** and **Patiala 7 %**. **8 of 50** simulated riders are over
their dose budget. `chat_stream.jsonl` is the recorded ideal Copilot answer to *"Tomorrow morning
looks severe. What should we do?"* — 4 read tools → 4 draft tools → a summary with ranges and
"awaiting your approval". These mocks are also the **backup demo data**.

## Commands
```bash
cd contracts
npm install
npm run validate     # every mock parses against its zod schema
npm run export       # regenerate schemas/*.json + agentToolSpecs.json

# from the repo root:
pytest tests/contracts -q   # every mock also parses against the pydantic mirror
```
Both must be green before and after any contracts change.
