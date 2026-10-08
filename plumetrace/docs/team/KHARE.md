# KHARE: Government and Fleet Domain Modules, Delivery, Demo

> **For the AI agent:** you work for **Khare**. Follow `CLAUDE.md` rules. Work through the task list below in order of `DUE`.
> Edit only files whose header says `OWNER : Khare`. Mark the header `STATUS` as WIP/DONE as you go.

## 1. Mission
You turn the forecast into **real-world actions that arrive on a phone**:
- **Government:** a 1-page district evidence report (HTML → PDF), a Punjabi farmer alert with audio (Amazon Translate + Polly), automatic drafts when a bad day is forecast, the executor that delivers approved actions over **Telegram**, and the next-day fire-trend check.
- **Fleet:** the simulated fleet (50 riders, about 600 orders/day), the **exposure-dose engine**, rider notifications, the GPS replay and the next-day dose check.
- **Story:** static reference data (districts, machine-rental centres), the slides outline and the 3-minute demo script.

## 2. Read first
Brief **§2.4 (positioning: supportive, never blaming)**, §6.7 (static data), **§11.3 (report template)**, **§12 (government module)**, **§13 (fleet module, except the 13.3 solver)**, §8.1 (Actions, Riders, RiderHealth, Shifts tables), §15 (privacy), §19 (demo). Use the contracts in `contracts/src/agentTools.js` for every Lambda's input and output.

## 3. You own
```
gov/**                                 (Node 20 Lambdas: reportGenerator, farmerAlert, autoDraft, executor, delivery, verification, lib)
fleet/common/forecast_lookup.py, fleet/simulator/*, fleet/dose/*, fleet/notify/*, fleet/verify/*, fleet/__init__.py
static/**                              (districts.geojson, chc_centres.geojson, README with licences)
tests/fleet/test_dose.py, gov/tests/*
docs/slides/OUTLINE.md, demo/DEMO_SCRIPT.md
```
**Not yours:** `fleet/replanner/*` (Yasho2), which imports your `dose.py` and `forecast_lookup.py`, so keep their signatures stable.

## 4. Inputs you depend on
| Input | From | When | While waiting |
|---|---|---|---|
| Contracts (`agentTools`, `ActionItem`, `RunSummary`) + `actionsRepo` | Yasho2 | D1 12:00 / 18:00 | Write `actionsRepo` calls against the interface; stub it locally |
| `summary.json` (`hotspot_villages`), `fires_48h.geojson`, `trajectories.geojson`, Attribution table | Yasho1 | D2 17:00 | Use `contracts/mocks/*` |
| DataStack, GovStack, FleetStack deployed | Tejas | D1 14:00, D2 18:00 | Run handlers locally with mock JSON events |
| `action.approved` events | Yasho2 | D2 14:00 | Invoke the executor with `mocks/actions.json` items |

## 5. Outputs others depend on
| Output | Consumer | When |
|---|---|---|
| `static/districts.geojson` (property `district`, ADM2 for Punjab/Haryana/Delhi/UP) | Yasho1 | **D1 14:00** |
| `fleet/dose/dose.py` (exact signatures in the file header) + `tests/fleet/test_dose.py` | Yasho2 | **D1 14:00** |
| `fleet/common/forecast_lookup.py` | Yasho2 | D1 18:00 |
| Riders, RiderHealth, Shifts populated for tomorrow | Yasho2, Tanmay | D1 18:00 |
| Report Lambda (`draftDistrictReport`) | Yasho2 agent tool | D2 13:00 |
| Farmer alert Lambda (`draftFarmerAlert`), fireTrend (`checkFireTrend`) | Yasho2 | D2 16:00–18:00 |
| Executor + Telegram delivery (AC6) | demo | D2 24:00 |
| Rider notify Lambda (`draftRiderNotifications`) | Yasho2 | D3 11:00 |

## 6. Task list
- [ ] **D1 11:00** Create the Telegram bot (@BotFather). Put `{bot_token, chats:{gov, farmer_demo, rider_demo}}` in Secrets Manager `plumetrace/telegram` (ask Tejas). Run `aws polly describe-voices --language-code pa-IN` (**VERIFY a Punjabi voice**) and record the result in DECISIONS.
- [ ] **D1 14:00** `static/districts.geojson` + licence in `static/README.md` (geoBoundaries IND ADM2 is CC BY 4.0, VERIFY; filter it to Punjab, Haryana, Delhi and UP; simplify to < 3 MB). Synthetic `chc_centres.geojson` with about 30 points in the hotspot districts, labelled synthetic.
- [ ] **D1 14:00** `fleet/dose/dose.py` + `tests/fleet/test_dose.py` (mandatory)
- [ ] **D1 15:00** `fleet/simulator/generate_fleet.py`
- [ ] **D1 18:00** `fleet/simulator/generate_orders.py` (baseline plan into Shifts), `fleet/common/forecast_lookup.py`, `gov/src/lib/data.js`, `gov/src/lib/geo.js`
- [ ] **D1 20:00** `gov/src/delivery/telegram.js`: a test message reaches the phone
- [ ] **D1 24:00** `reportGenerator/template.html`, `svgMap.js`, `render.js`
- [ ] **D2 13:00** `reportGenerator/handler.js` (PDF via headless Chromium)
- [ ] **D2 14:00** `farmerAlert/compose.js`, `translate.js`, `gov/tests/compose.test.js`
- [ ] **D2 16:00** `farmerAlert/polly.js`, `farmerAlert/handler.js`; `fleet/dose/handler.py`
- [ ] **D2 18:00** `verification/fireTrend.js`, `autoDraft/handler.js`
- [ ] **D2 24:00** `executor/handler.js`: **approve → phone gets text + MP3 in < 30 s (AC6)**
- [ ] **D3 11:00** `fleet/notify/rider_messages.py`
- [ ] **D3 12:00** `fleet/simulator/gps_replay.py`. Get the Punjabi text reviewed by a native speaker.
- [ ] **D3 14:00** `verification/govVerify.js`
- [ ] **D3 15:00** `fleet/verify/fleet_verify.py`
- [ ] **D3 20:00** `docs/slides/OUTLINE.md`, `demo/DEMO_SCRIPT.md`; `delivery/ses.js` (optional backup)
- [ ] **D4 AM** Lead 3 rehearsals; record the backup video with Tanmay (AC10)

## 7. How to implement (key guidance)

**Every draft Lambda follows the same pattern**
```js
export const handler = async (event) => {
  const input = DraftFarmerAlertInput.parse(event);          // from @plumetrace/contracts
  // ...compute...
  const action = await createDraft('farmer_alert', payload, runId);  // contracts/src/actionsRepo.js
  return DraftFarmerAlertOutput.parse({ action_id: action.action_id, text, audio_url });
};
```
Test locally with `node -e "import('./src/farmerAlert/handler.js').then(m => m.handler(require('../contracts/mocks/...')))"` or a small `scripts/` runner.

**District report.** Fill `template.html` with the numbers, write it to `reports/<action_id>.html`, then print it to PDF:
```js
import chromium from '@sparticuz/chromium'; import puppeteer from 'puppeteer-core';
const browser = await puppeteer.launch({ args: chromium.args, executablePath: await chromium.executablePath(), headless: true });
const page = await browser.newPage(); await page.setContent(html, { waitUntil: 'load' });
const pdf = await page.pdf({ format: 'A4', printBackground: true });
```
The map is **inline SVG** (`svgMap.js`), so Chromium never fetches tiles. The headline format is: "Estimated contribution of crop fires in Sangrur to Delhi-NCR PM2.5 on 10 Oct 2026: 12 % (7–18 %)". Include the method (5 lines), the limitations (satellite overpass bias, the persistence assumption, model MAE) and the sources with timestamps. **Name no individuals.** The subsidy text must be checked by a teammate (§11.3.5).

**Farmer alert.** The English template is translated by Amazon Translate (`TargetLanguageCode: 'pa'`). Keep it under 300 characters after translation; if it's too long, shorten the English source. Example source: *"Smoke from field fires is expected over Delhi on Fri–Sat. Instead of burning, rent a Happy Seeder at {centre} ({km} km). Subsidy helpline: {helpline}. Mulching the straw also improves soil."* Polly: if there is no `pa-IN` voice, use `hi-IN` (Kajal neural, Aditi standard) for the audio of the Hindi version, and send Punjabi as text. Aim for 20–30 s of audio.

**Executor (EventBridge `action.approved`).** Dispatch on `detail.type`. Send through `telegram.js` (`sendMessage`, `sendAudio` with the MP3 buffer from S3, `sendDocument` for the PDF). Then `transition(id, 'approved' → 'executed')` and PutEvents `action.executed`. On error, use `failed` with an `error` field. It must be idempotent: skip anything that is not `approved`. Target: approval → phone in < 30 s.

**Simulator.** Use a fixed random seed. Place the 6 dark stores across Delhi (e.g. near Rohini, Dwarka, Saket, Laxmi Nagar, Karol Bagh, Noida Sec-18; synthetic coordinates). For order arrivals, use a non-homogeneous Poisson process with the peaks from §13.1. 30 % of orders are flexible (3 h window). The baseline plan assigns each order to the nearest free rider from the same store. Mark everything as synthetic.

**Dose (brief §13.2).** `segment_dose_ug = c × 1.3 × minutes/60 × 1.4`; `daily_budget_ug = 60 × 1.4 × shift_hours × multiplier`; multiplier 0.7 if the rider consented to sharing a health condition. Hand-check: 100 µg/m³ for 60 min = 100 × 1.3 × 1 × 1.4 = **182 µg**. Only `fleet/dose/handler.py` may read RiderHealth (KMS). Never return conditions anywhere, only `budget_multiplier`.

**Verification.** Gov: compare alerted with non-alerted districts that had similar fire counts the day before (match the 3 nearest by count). Report the % change in fire count and FRP over the next 1–3 days, labelled "early signal, not causal proof". Fleet: forecast vs actual dose per rider, and "dose avoided" = baseline plan dose − executed plan dose.

## 8. Done checks
- `pytest tests/fleet/test_dose.py` and `cd gov && npm test` pass.
- US2: a Sangrur report PDF is one A4 page, with ranges, map, method and sources.
- US3 / AC6: approving a farmer alert in the UI → the phone gets Punjabi text + MP3 in < 30 s.
- Riders/Shifts for "tomorrow" exist before every demo (`generate_orders.py --date tomorrow`).

## 9. Gotchas
- `@sparticuz/chromium` needs a large Lambda (2 GB) and x86_64. Tell Tejas the memory and the architecture.
- Telegram `sendAudio` needs multipart form data. Use `FormData` + `Blob` in Node 20.
- Amazon Translate may produce awkward Punjabi. A native speaker must review it, and you should keep a hand-fixed version of the demo message.
- Fleet budgets assume 8–10 h shifts. Riders' daily dose % should be about 60–140 % on a bad day, so the re-planner has something to fix.
