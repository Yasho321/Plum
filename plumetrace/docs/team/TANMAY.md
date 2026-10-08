# TANMAY: Frontend (React + Vite + deck.gl)

> **For the AI agent:** you work for **Tanmay**. Follow `CLAUDE.md` rules. Work through the task list below in order of `DUE`.
> Edit only files whose header says `OWNER : Tanmay` (everything in `web/`). Mark the header `STATUS` as WIP/DONE as you go.

## 1. Mission
Build everything the judges *see*. The centrepiece is a live map: fire dots in Punjab, **animated smoke trajectories
flowing into Delhi**, and a 72 h PM2.5 hexagon forecast with a time slider. Around it you build the Government, Fleet,
Forecast Skill and Approvals views, plus a Copilot chat panel that streams the agent's tool calls. You build against
**mocks from minute one**, so you are never blocked.

## 2. Read first
Brief **§4 (personas, user stories)**, **§7 (number formatting, IST in UI)**, **§8.4 (API)**, **§14 (frontend, all)**, §2.4 (positioning: always show ranges; SIMULATED badge), §19 (demo script: what has to look great). The `contracts/mocks/*` files are your data.
Copy the setup from `Yasho321/NotebookLM-Clone/frontend`: Vite config, Tailwind v4, the shadcn `components/ui`, Zustand store pattern, axios instance, TanStack Query.

## 3. You own
`web/**`: pages, components, stores, hooks, lib, config.

## 4. Inputs you depend on
| Input | From | When | While waiting |
|---|---|---|---|
| `contracts/mocks/*` | Yasho2 | D1 12:00 | Use `VITE_USE_MOCKS=1`, which imports the mock files directly |
| Deployed mock API + Cognito test users | Yasho2 / Tejas | D1 14:00 / 18:00 | Local mocks |
| Amazon Location map style URL + API key | Tejas | D2 18:00 | Use a free MapLibre demo style (`https://demotiles.maplibre.org/style.json`) |
| Real data | Yasho1 via the API | D2 18:00 (CP1) | Mocks |

## 5. Outputs others depend on
- A live URL (Amplify) with all views by **D2 18:00**, and polished by **D3 20:00**.
- The UI for the demo (§19) and the screen recording for the backup video (AC10, with Khare).

## 6. Task list
- [x] **D1 12:00** Scaffold: `index.html`, `vite.config.js`, `main.jsx`, `index.css`, shadcn init (Button, Card, Tabs, Table, Badge, Dialog, Slider, Tooltip, ScrollArea), `.env.example`
- [x] **D1 13:00** `App.jsx` routes, `authStore.js`, `lib/api.js` (mock switch)
- [x] **D1 14:00** `AppShell.jsx`, `lib/aqi.js`, `lib/format.js`
- [x] **D1 16:00** `RangeText`, `SimulatedBadge`, `AqiLegend`, `hooks/queries.js`
- [x] **D1 18:00** `PlumeMap.jsx` showing mock H3 + fires
- [x] **D1 20:00** `layers.js` (all 4 layers), `TimeSlider.jsx`, `timeStore.js`: **the TripsLayer animation works on mocks**
- [x] **D2 10:00** `lib/sse.js`, `copilotStore.js`
- [x] **D2 12:00** `GovernmentPage.jsx`, `DegradedBanner`, `DoseBar`, `ToolCallStep`
- [x] **D2 14:00** `CopilotPanel.jsx`, `CopilotPage.jsx` (replays `mocks/chat_stream.jsonl`)
- [x] **D2 16:00** `ApprovalsPage.jsx`, `ActionCard`, `ActionPreview` (iframe report, `<audio>`, plan diff)
- [x] **D2 18:00** `FleetPage.jsx`. **CHECKPOINT 1: switch to the real API**, deploy on Amplify.
- [x] **D3 11:00** `lib/auth.js` + `LoginPage.jsx` (Cognito Hosted UI), role gating
- [x] **D3 12:00** `SkillPage.jsx` (recharts)
- [x] **D3 15:00** `ConsentPage.jsx`
- [x] **D3 20:00** Polish: smoke animation, loading/empty/error states, responsive layout, colour-blind check
- [x] **D4 AM** Drive the UI in rehearsals; record the backup video with Khare

## 7. How to implement (key guidance)

**Map stack.** MapLibre GL plus deck.gl, interleaved through `MapboxOverlay` from `@deck.gl/mapbox`:
```js
const overlay = new MapboxOverlay({ interleaved: true, layers });
map.addControl(overlay);           // update with overlay.setProps({ layers }) on every tick
```
- `TripsLayer` (from `@deck.gl/geo-layers`): `getPath: f => f.geometry.coordinates`, `getTimestamps: f => f.properties.timestamps`, `trailLength: 6*3600`, `currentTime` animated with `requestAnimationFrame`. The trajectories are *back*-trajectories, so animate them **from the oldest timestamp to the station**. Smoke should look like it flows *into* Delhi. That is the demo moment, so make it beautiful (glow colour, fading trail, width 2–3 px).
- `H3HexagonLayer`: `getHexagon: d => d.h3`, `getFillColor` from `aqi.js` on p50. Make an uncertainty toggle that maps the p90−p10 width to opacity. Null cells are grey/hatched with a "no data" tooltip.
- `ScatterplotLayer` fires: radius ∝ √FRP, colour by age (fresh = bright orange, 48 h = dark red).
- `GeoJsonLayer` districts: fill by `share_p50`, tooltip "Sangrur: 12 % (7–18 %)".
- TimeSlider: 0–72 h, labels in IST ("Fri 07:00 IST"), play/pause at 1 h per 500 ms. Changing the hour refetches `/forecast?valid_hour=` (TanStack Query caches it, so prefetch the next hour).

**Copilot SSE.** `POST /agent/chat` with `fetch`, read `response.body.getReader()`, split on `\n\n`, and parse the `data:` JSON into a `ChatStreamEvent`. Render text with react-markdown. Render `tool_call`/`tool_result` as collapsible `ToolCallStep`s (name, args, short result). Render `action_drafted` as a card linking to Approvals. Keep the message history in `copilotStore` and send it with each request.

**Approvals.** One `ActionCard` per draft. The preview depends on the type: `district_report` → `<iframe src={preview_url}>` + PDF link; `farmer_alert` → text (Punjabi) + `<audio controls src={audio_url}>`; `shift_plan` → a before/after table (riders changed, worst-rider %, extra minutes); `rider_notify` → a message list. Approve and Reject are hidden unless the user is in the right Cognito group (gov for gov types, fleet for fleet types, admin for all). Show a toast via sonner. When `verification` exists, show it with the label "early signal, not causal proof".

**Formatting rules (brief §7).** PM2.5 is an integer. Shares are "31 % (22–40 %)" via `RangeText` everywhere. All times in the UI are IST. Fleet doses are shown as **% of budget**, never in µg. Every fleet screen has a `SimulatedBadge`. The AQI bands are: Good 0–30, Satisfactory 31–60, Moderate 61–90, Poor 91–120, Very Poor 121–250, Severe > 250. Check the palette with a colour-blind simulator.

**Skill page.** Station selector → recharts `ComposedChart`: an `Area` band (p10–p90), a `Line` for p50, and dots for obs. Below it, a table by lead bucket: MAE, RMSE, coverage, skill vs persistence, severe hit rate. Add Backtest/Live tabs and a caveat line: "Backtest uses reanalysis weather (optimistic); live uses GFS forecasts."

## 8. Done checks
- `npm run lint && npm run build` pass, and CI is green.
- With `VITE_USE_MOCKS=1` every page renders, with no console errors.
- US1, US4, US5 from brief §4 can be clicked through on the deployed Amplify URL.
- The map runs at ≥ 30 fps while animating on a normal laptop.

## 9. Gotchas
- deck.gl `H3HexagonLayer` needs `h3-js` v4. Pass cells as strings.
- GeoJSON coordinates are `[lon, lat]`; deck.gl expects the same. Don't swap them.
- The Cognito id token (not the access token) carries `cognito:groups`.
- Don't block the UI on `/agent/chat`. Stream it and show the tool steps while it works.
