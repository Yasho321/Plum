# Prompt — PlumeTrace UI revamp + landing page

> Paste everything below the line into a fresh Claude Code session opened at the repo
> root, with the **impeccable**, **ui.sh** and **hallmark** skills attached.

---

I am Yasho2 on the PlumeTrace team. I have authority to edit every file under `web/`.
Revamp the PlumeTrace web app's UI/UX and add a public landing page. I want an
exceptional result: calm, precise, beautiful, and obviously built by people who care,
held to a design-portfolio bar. Work in phases, verify each one, and do not break any
data wiring.

## 0. Skills — load before touching code
1. Invoke **impeccable**, **ui.sh** and **hallmark** with the Skill tool and read each one
   fully. Use them as the governing design standards for this task. Where they overlap,
   apply the stricter rule. Where they conflict with section 3 below (domain rules), the
   domain rules win.
2. Also invoke **dataviz** for every chart, legend, colour ramp, stat tile and the map
   colour encoding. Run its palette validator (`scripts/validate_palette.js`) on every
   categorical/status palette you introduce, for dark mode against the real surface colour.
3. If any of those skills is not available, say so in one line and continue, applying the
   principles in section 4 instead. Do not invent what a missing skill says.

## 1. Read first (ground truth — do not guess)
- `CLAUDE.md` (hard rules), `docs/PROJECT_BRIEF.md` §2.4, §7, §14, §19 (positioning,
  conventions, frontend views, demo script).
- `contracts/src/api.js` — the **exact** response shapes. Every component must read these
  field names (e.g. `summary.hotspot_districts[].district/share/share_p10/share_p90/trend_7d`,
  `fleet.riders[].forecast_dose_pct/over_budget`, `actions[].action_id/type/status/payload`).
  The previous UI shipped with invented field names and rendered empty tables, so do not
  repeat that.
- The whole of `web/src/` — especially `index.css` (Tailwind v4 `@theme` tokens),
  `lib/api.js`, `lib/sse.js` (contract → UI event normalisation), `hooks/queries.js`,
  `stores/*`, `components/map/*` (MapLibre + deck.gl), `pages/*`.

**Stack (keep it):** React 19 + Vite, Tailwind v4 (`@theme` tokens in `index.css`),
TanStack Query, Zustand, react-router, MapLibre GL + deck.gl 9 (`MapboxOverlay`,
`interleaved:false`), recharts, lucide-react, sonner, react-markdown v9. You may add small,
well-maintained deps (e.g. `motion`, a variable font) if a skill calls for them. No new
UI framework.

**Routes today:** `/login`, `/consent`, `/gov`, `/fleet`, `/skill`, `/approvals`, `/copilot`
(`/` redirects to `/gov`). The app runs locally with `bash scripts/demo_local.sh` (API on
:8080 in MOCK_MODE, web on :5173 with `web/.env.local` → `VITE_DEV_NOAUTH=1`).

## 2. Deliverables
1. **Landing page at `/`** (public, no auth), with "Sign in" / "Open dashboard" CTAs to
   `/login` → `/gov`. Move the current `/` redirect accordingly and keep every existing
   route working. Content, in this order:
   - Hero: one-line value prop ("Know where Delhi's smoke comes from, 72 hours ahead") +
     a live, animated mini-map or a high-quality static render of trajectories flowing into
     Delhi, built from `contracts/mocks` data, with no stock imagery.
   - The problem (2 sentences, sourced or labelled as estimate).
   - How it works: Detect → Attribute → Act (human-approved) → Verify, as a 4-step flow.
   - Two products: Government (accountability) and Fleet (protection), each with a real
     screenshot-quality preview component (reuse the real components with mock data, not
     fake images).
   - Trust: "estimates with ranges, never verdicts", forecast-skill numbers from
     `skill.json`, data sources (FIRMS, GFS, OpenAQ) with licences, "Fleet data is simulated".
   - Architecture strip (serverless AWS) and a footer.
2. **Revamp every authenticated screen:** AppShell (header/nav/run badge/Copilot entry),
   Government (map + district ranking + headline stats + time slider), Fleet, Forecast
   Skill, Approvals (+ previews), Copilot panel/page, Login, Consent.
3. **States everywhere:** loading (skeletons shaped like the content), empty, error (with
   retry), degraded-run banner (`summary.degraded`), and optimistic approve/reject.
4. **Responsive:** first-class at 1440, 1280 and 1024. Usable at 768 (rail collapses into a
   drawer, map stays primary). The landing page must also work at 390 px.

## 3. Domain rules (non-negotiable — from the brief)
- **AQI colours are semantic.** Keep the India NAQI PM2.5 bands (Good 0–30, Satisfactory
  31–60, Moderate 61–90, Poor 91–120, Very Poor 121–250, Severe >250) as an ordinal ramp
  used **only** for PM2.5. You may retune the hexes for perceptual evenness and dark-surface
  contrast, but keep the green→yellow→orange→red→maroon meaning and validate it.
- **The brand colour must not collide with AQI hues.** No brand red/orange/yellow/green.
  Use a cool hue (sky/indigo/teal family) for brand and interaction. Status colours
  (success/warning/danger) must also be visually distinct from AQI steps and always ship
  with an icon + label.
- Numbers show their range: **"31 % (22–40 %)"**. PM2.5 is an integer µg/m³ (write `µg/m³`,
  never `MG/M³`). Shares are whole-number %.
- Times are UTC in data; **display IST** and label it once (not "IST IST").
- Attribution is "an estimate, not a verdict". The tone toward farmers is supportive and
  never blames. Never name individuals.
- Fleet screens always carry a visible **SIMULATED FLEET** label.
- The agent never executes actions. Approvals UI must make "draft → human approves" obvious.
- Never surface rider health conditions, only budget %.

## 4. Design principles to apply (and to fall back on if a skill is missing)
- **Concept first.** Write a 5-line design direction before coding: mood, metaphor (air,
  plume, clarity), type pairing, colour strategy, motion personality. Keep to it everywhere.
- **Colour theory:** a near-black, slightly cool neutral ramp (≥ 9 steps) for surfaces,
  borders and text. One brand hue with a tint/shade ramp. Use the 60/30/10 split
  (neutral/surface/accent). Spend saturated colour on data and meaning, not chrome. Every
  text/background pair meets **WCAG AA** (4.5:1 body, 3:1 large/UI). Check the AQI ramp and
  any categorical palette for colour-vision deficiency with the dataviz validator.
- **Typography:** one excellent variable sans (e.g. Inter / Geist / Manrope) plus a
  tabular-figure setting for all numbers. A modular type scale (~1.2) with 6–7 sizes max,
  tight tracking on display sizes, comfortable 1.5 line-height on body. Hero numbers are
  large, tabular, and coloured by meaning.
- **Layout & spacing:** 4-px base / 8-px rhythm, a clear grid, generous whitespace, aligned
  edges, consistent radii (pick 2–3), and elevation expressed through subtle surface steps
  and hairline borders rather than heavy shadows.
- **Hierarchy:** each screen answers one question in 3 seconds (Gov: "which districts, how
  sure?"; Fleet: "who's over budget, what's the fix?"; Skill: "can I trust it?"). Make that
  answer the largest thing on the screen.
- **Map as the hero:** keyless dark basemap locally (`PlumeMap.jsx` uses Esri Dark Gray;
  prod uses `VITE_LOCATION_STYLE_URL`). H3 PM2.5 fill coloured by AQI with a legible "no
  data" treatment, glowing fire points by FRP/age, animated trajectory trails, hover
  tooltips showing value + range, and a refined legend and time slider (IST ticks, play/pause,
  keyboard control). The map container must have real height. It previously collapsed to 0
  px in a flex chain, so keep `absolute inset-0` + `min-h-0`.
- **Motion:** purposeful and quick (150–250 ms, ease-out). Use staggered reveals on load,
  smooth number tweens on stat tiles, and the streaming Copilot. Respect
  `prefers-reduced-motion`.
- **Charts (dataviz):** the right form, one axis, thin marks, a recessive grid, a p10–p90
  band + median + observed points, a crosshair tooltip, a legend for ≥ 2 series, and a table
  view available.
- **Accessibility:** semantic landmarks, visible focus rings, full keyboard navigation (nav,
  slider, approve/reject, Copilot), aria-live for streaming text, hit targets ≥ 40 px, and
  never colour alone.
- **Polish:** consistent iconography (lucide, one stroke width), no layout shift, no
  orphaned states, no placeholder text, no console errors or warnings.

## 5. Process
1. **Audit:** screenshot every route (use the run / browser skill if available) and list the
   issues against the skills and section 4. Share the 5-line design direction + token plan
   (neutral ramp, brand ramp, AQI ramp, status, type scale, spacing, radii, motion) and the
   validator output **before** building.
2. **Tokens:** rebuild `web/src/index.css` `@theme` from that plan. Keep the existing token
   *names* that components use (`background, foreground, card, primary, muted, border,
   destructive, success, aqi-*` …), or migrate every usage in the same change.
3. **Primitives:** create `web/src/components/ui/` (Button, Card, Badge/Pill, Stat, Table,
   Tabs, Skeleton, EmptyState, ErrorState, Tooltip, Kbd) and use them everywhere instead of
   ad-hoc class strings.
4. **Screens:** Landing → AppShell → Government (incl. map) → Fleet → Skill → Approvals →
   Copilot → Login/Consent.
5. **Verify after each screen:** `cd web && npm run build` (zero errors), run the local
   demo, screenshot at 1440 and 1024, confirm the data actually renders (district rows, 50
   riders / 8 over, approvals cards, chart points, map layers), and check the console is
   clean. Fix before moving on.

## 6. Constraints
- Do **not** change `contracts/`, the API, or the response shapes. If the UI needs data
  that doesn't exist, derive it client-side or write a HANDOFFS entry. Never fake it.
- Keep `lib/sse.js` normalisation and `hooks/queries.js` behaviour (runId seeding,
  `run_id`/`valid_hour` params, `useActions` array unwrap, `useFires`) intact.
- Keep each file's header (OWNER/DUE/TASK/DONE WHEN/STATUS).
- Commit in small, focused commits on a branch named `yasho2/ui-revamp`. Never commit
  secrets or `.env*` files.

## 7. Definition of done
- The landing page plus all 8 app screens are revamped, consistent, and responsive as
  specified.
- The dataviz validator passes for every palette you added. All text meets AA.
- `npm run build` is clean, there are no console errors on any route, and every data view
  renders real mock data.
- A short before/after summary with screenshots of each route, the final token sheet, and
  any skill rule you deliberately deviated from (with the reason).
