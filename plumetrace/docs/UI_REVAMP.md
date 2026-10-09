# PlumeTrace — UI revamp (branch `tejas/ui-revamp`)

A calm, precise, map-first redesign of the web app plus a new public landing page.
Stack unchanged (React 19 + Vite, Tailwind v4 `@theme`, TanStack Query, Zustand,
react-router, MapLibre + deck.gl, recharts, lucide, sonner). No contract, API, or
response-shape changes; all data wiring (`lib/sse.js`, `hooks/queries.js`) preserved.

## Design direction
- **Mood** — a calm night control room; scientific and trustworthy, never an alarm panel.
- **Metaphor** — air & plume; clarity emerging from haze; trajectories drifting into Delhi.
- **Type** — Inter, tabular figures on every number; hero numbers large, tabular, coloured by meaning.
- **Colour** — cool-slate neutrals (60% chrome), one sky-blue brand hue + indigo accent (10%
  interaction), saturated colour reserved for data (AQI = PM2.5 only; status always icon + label).
- **Motion** — purposeful 150–250 ms ease-out; staggered reveals, number tweens, streaming
  Copilot; honours `prefers-reduced-motion`.

## Final token sheet (`web/src/index.css` `@theme`)
Existing token *names* consumed by components were kept; new tokens added.

| Role | Token | Value |
|---|---|---|
| App background | `--color-background` | `#0e131c` |
| Map basemap | `--color-neutral-950` | `#0a0c11` |
| Card | `--color-card` | `#121826` |
| Elevated / secondary | `--color-elevated` / `--color-secondary` | `#161d2c` / `#1b2334` |
| Border | `--color-border` | `#273145` |
| Muted text | `--color-muted-foreground` | `#8b94a7` (5.8:1 on card) |
| Secondary text | `--color-neutral-300` | `#aeb6c8` (8.7:1) |
| Foreground | `--color-foreground` | `#dfe5f0` (14:1) |
| Brand | `--color-primary` / `-strong` | `#4aa8ff` (7.4:1) / `#7cc1ff` |
| Accent | `--color-accent` | `#818cf8` |
| Success / Warning / Danger | `--color-success` / `--color-warning` / `--color-destructive` | `#16c79a` / `#f5a623` / `#fb5a6a` |
| Radii | `--radius-sm/‑/‑lg/‑xl` | `0.4 / 0.625 / 0.9 / 1.1 rem` |

**AQI ordinal ramp (PM2.5 only)** — `#4cdd92` Good · `#b6e24a` Satisfactory · `#f7a015` Moderate
· `#ee6c26` Poor · `#e53b45` Very Poor · `#be3787` Severe. Kept green→…→maroon meaning; retuned
for perceptual evenness and dark-surface contrast. Mirrored in `web/src/lib/aqi.js`.

## dataviz validator output
- **AQI ramp** vs card `#121826` and map `#0a0c11`: **Contrast PASS** (all 6 ≥ 3:1). Adjacent-pair
  CVD **WARN** (worst deutan ΔE ≈ 7.4, in the legal 6–8 band). Lightness-band / normal-vision
  adjacency floors do not pass — see deviation below.
- **Status trio** (`#16c79a`,`#f5a623`,`#fb5a6a`) vs card: contrast PASS, normal-vision PASS, CVD
  WARN (deutan ΔE 7.0). Always shipped with icon + label.
- **Skill chart series** — brand-blue forecast (line + p10–p90 band) vs **achromatic near-white**
  observed dots with a surface ring: CVD-robust by achromatic contrast + shape, no hue clash.

## Deliberate deviations
1. **Skills `impeccable`, `ui.sh`, `hallmark` were not available** in this session, so the
   section-4 principles were applied instead (as the prompt allows). `dataviz` was available and
   used for every palette.
2. **AQI ramp cannot pass the categorical CVD / normal-vision adjacency floors.** A smooth
   green→maroon severity scale is physically indistinguishable on some adjacent pairs under
   deuteranopia — this is intrinsic to AQI colour scales. Per the brief it stays an *ordinal* ramp
   and relies on mandatory secondary encoding everywhere it appears: ordered legend, numeric
   µg/m³ values, text band labels, and hover tooltips — never colour alone.
3. The app is **dark-only** (map-first control surface on a dark basemap); no light theme was added.

## Before → after, by route
| Route | Before | After |
|---|---|---|
| `/` | redirect to `/gov` | **New public landing page** — hero live mini-map (real deck.gl trajectories on mock data), live-run strip, problem, Detect→Attribute→Act→Verify, two product previews built from real components + mock data, trust (skill numbers, licensed sources, "simulated"), serverless architecture strip, footer |
| AppShell | flat top bar | icon nav + active states, mobile drawer (≤768), live run badge, account menu (consent + sign out) |
| `/gov` | basic rail + map | stat tiles (peak PM2.5 coloured by AQI band + tweened, crop-fire share with range), ranked district list w/ inline share bars + trend, loading/empty/error states, refined legend (incl. "no data") + keyboard time slider with IST ticks |
| `/fleet` | table | over-budget filter + worst-first sort, rebuilt dose bars with a 100% budget line, SIMULATED label, states; only budget % (never health) |
| `/skill` | plain recharts | dataviz chart (p10–p90 band + median + achromatic observed, recessive grid, crosshair tooltip, legend) + chart/table toggle, trust stat tiles, backtest/live segmented control, caveat |
| `/approvals` | pill filters | status tabs with counts, session-optimistic approve/reject, redesigned action cards + per-type previews, human-in-the-loop messaging |
| `/copilot` | basic chat | streaming with `aria-live`, suggested prompts, collapsible tool steps, drafted-action cards linking to Approvals, auto-growing composer (Enter / Shift+Enter) |
| `/login` | centered card | two-panel brand + Cognito sign-in, loading state, back-to-home |
| `/consent` | standalone | inside the shell, DPDP sections, two-step confirm before irreversible erase |

## New building blocks
`web/src/components/ui/` — Button, Card, Badge, Stat (count-up), Skeleton, EmptyState/ErrorState,
SegmentedControl, Tooltip, Kbd, Table — plus `lib/cn.js`. Used in place of ad-hoc class strings.

## Verification
- `cd web && npm run build` — **clean** (exit 0).
- `npx eslint src` — 0 errors (2 `react-refresh/only-export-components` warnings remain for the
  primitive kit's helper exports; dev-HMR only, no runtime impact).
- Dev server (mock mode) boots; every rewritten module transforms without error.
- **Visual QA (screenshots at 1440 / 1280 / 1024 / 768, landing at 390, console check)** must be
  done by running `bash scripts/demo_local.sh` — this environment has no GPU browser to capture
  WebGL (deck.gl/MapLibre) screenshots headlessly.

## Responsive
First-class at 1440/1280/1024 (gov rail beside the map); at ≤1024 the gov rail becomes a
collapsible panel above the map; app nav collapses to a drawer at ≤768. Landing reflows to a
single column and works at 390 px.
