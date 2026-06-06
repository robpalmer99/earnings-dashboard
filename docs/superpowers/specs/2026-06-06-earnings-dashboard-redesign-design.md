# Earnings Dashboard — Redesign Design Spec

**Date:** 2026-06-06
**Status:** Approved design, pending implementation plan

## 1. Overview

Rebuild the existing single-file earnings-dashboard demo into a polished, **offer-agnostic, re-skinnable template** used as a **screen-recorded prop** in marketing funnels (VSLs / ads / advertorials). The same functional dashboard is re-skinned per product via a live control panel; only the look-and-feel and numbers change between products.

This is a full rewrite (approved). The current `index.html` is replaced by a structured, buildless static project.

## 2. Use context & priorities

- **Primary use:** screen-recorded prop. Optimize for flawless on-camera fidelity and convincing animation — not real-prospect robustness, real banking, or form-validation edge cases.
- **Audience / viewport:** ≥70% mobile traffic for these offers. **Mobile-first** is the priority, but desktop must be first-class too (authoring/recording happens on desktop). Not a stretched-phone afterthought.
- **Offer-agnostic:** one codebase, many products. Per-product identity comes from configuration, not code edits.
- **Domain:** one reusable, neutral domain (e.g. `member-portal.app`) reused across products; the URL stays generic while page content carries product identity. App is domain-agnostic — runs identically on localhost, `*.vercel.app`, or custom domain.
- **Hosting:** static deploy to Vercel. `vercel.json` sets `git.deploymentEnabled.main:false` (push = backup only; deploy is a deliberate, separate action).

### Non-goals
- No real backend, no real money movement, no collection of real bank details.
- No login/auth system (login screen out of core scope).
- No realtime ticking numbers or toast notifications in core scope (deferred; architecture leaves room to add later).
- No activity feed or withdrawal-history surfaces in core scope (deferred).

## 3. Architecture

**Approach:** small structured static project, buildless **native ES modules** + CSS custom-property theming. No bundler, no framework, no build step — deploy the folder as-is.

### File structure
```
earnings-dashboard/
├── index.html                # shell + root containers + <script type="module" src="src/main.js">
├── vercel.json               # static; git.deploymentEnabled.main:false
├── assets/                    # favicon, default logo placeholder
└── src/
    ├── main.js               # boot: load config → apply theme → generate data → mount surfaces → wire control panel
    ├── store.js              # tiny reactive store (state + subscribe); single source of truth
    ├── config/
    │   ├── schema.js         # config shape + defaults
    │   ├── presets.js        # named starting themes
    │   └── persistence.js    # localStorage load/save + JSON import/export
    ├── theme/apply-theme.js  # writes CSS custom properties from config
    ├── data/earnings-engine.js   # seeded generator → daily/weekly/monthly series, totals, % deltas, balance
    ├── charts/line-chart.js  # hand-rolled animated SVG area/line chart
    ├── surfaces/
    │   ├── stat-cards.js
    │   ├── balance-card.js
    │   ├── earnings-graph.js
    │   ├── breakdown-tables.js
    │   └── withdraw-flow.js  # 4-step state machine
    ├── control-panel/control-panel.js
    ├── lib/
    │   ├── animate.js        # count-up, easing, rAF helpers — single source for timing/feel
    │   ├── format.js         # currency/locale/number/date formatting
    │   └── dom.js            # tiny DOM helpers
    └── styles/
        ├── tokens.css        # :root custom properties (theme-driven)
        ├── base.css          # reset + typography
        ├── surfaces.css      # cards, balance, graph, tables
        ├── withdraw.css      # modal / bottom-sheet + stepper
        └── control-panel.css
```

### Module contract
- Each surface module exposes `mount(root)` and `update(state)`; understandable and testable in isolation.
- `store.js` holds the single source of truth (config + generated data). Changing config notifies subscribers → affected surfaces re-render. This is what makes the live control panel work.

## 4. Configuration model

A **live control panel**: a hidden drawer (slides in from the right on desktop) toggled by a keyboard shortcut so there is zero trace on camera. Every change updates the dashboard live. Config persists to localStorage; per-product configs export/import as JSON.

### Config schema groups
1. **Brand** — name, portal subtitle, logo (upload→dataURL or URL), favicon.
2. **Theme** — accent color(s), light/dark base, font pairing, corner radius, card style.
3. **Locale** — currency symbol/code + number/date locale (supports $, £, €, …).
4. **Data** — daily earnings range (min/max), trend direction/strength, volatility, window length, **seed**, available balance, and an optional **hero "Today" % override**.
5. **Surfaces** — show/hide each surface; which stat cards; which graph periods.

Plus **Presets** (named starting points, e.g. Violet / Crypto Green / Luxury Gold / Midnight) and **Export / Import / Reset** actions.

## 5. Data engine

Replaces today's `Math.random()` approach with a **seeded RNG**:
- A `seed` in config produces identical numbers every reload → recordings are reproducible and re-recordable. Change the seed to reshuffle into a fresh believable dataset.
- Generates a configurable window of daily earnings (weighted distribution + trend + volatility), then derives weekly and monthly aggregates and headline totals: **Today / This Week / This Month / Total**, each with **% change vs the prior period**, plus the **available balance**.
- **% deltas are derived from the generated series by default.** The hero "Today" card's % may be overridden via config (it's the most prominent number on camera); all other deltas remain derived.

## 6. Surfaces (core scope)

1. **Animated stat cards** — Today (accent hero card) / This Week / This Month / Total; count-up animation + % delta vs prior period.
2. **Available Balance + Withdraw** — balance card ("cleared & ready to withdraw") with the button that opens the withdraw flow.
3. **Earnings graph** — smooth area + gradient line chart with Daily / Weekly / Monthly toggle.
4. **Breakdown tables** — daily/weekly detail with per-row trend bars and totals (evolved from current implementation).

## 7. Layout

**Layout A (stacked), mobile-first, polished desktop.**

- **Mobile (primary):** single vertical column — brand bar → title → hero "Today" card → period cards (two-up) → Available Balance + Withdraw → graph → breakdown tables.
- **Desktop:** centered max-width container; period cards spread to a 4-up row; graph renders larger. Deliberate wide layout, not a stretched phone.

Layout B (two-column with right rail) was rejected: the rail can't survive phone width and buries the Withdraw CTA below the fold.

## 8. Earnings graph

- **Style:** smooth area chart with gradient fill under a smooth curve (premium fintech look; matches reference screenshots; most legible at phone size). Hand-rolled SVG.
- **Toggle:** Daily / Weekly / Monthly. Switching **morphs** the path (animated interpolation), not a hard cut.
- **Load animation:** line draws in left→right (stroke-dashoffset); gradient area fades up underneath.
- **Interaction:** hover (desktop) / touch (mobile) reveals a point marker + value label.

## 9. Withdraw flow

A 4-step flow. **Modal on desktop; bottom-sheet (slides up) on mobile.** A 1·2·3·4 stepper fills with checks as it advances.

1. **Amount** — large amount input; preset chips ($500 / $1,000 / $1,500 / Max, where Max = available balance); masked bank destination; Continue.
2. **Review & confirm** — Amount / To / Fee $0.00 / Arrival "Instant ⚡"; Confirm; Back.
3. **Processing** — animated spinning ring + stepper advancing; reassuring "bank-grade encryption" microcopy; **configurable duration**.
4. **Complete** — green check scale-in; "Transfer initiated!"; reference # + "Completed" status; Done.

Control-panel configurable: bank name, masked digits, fee label, arrival text, preset amounts, processing duration.

## 10. Animation & on-camera polish

- **Stat cards:** count-up 0→value (easeOutExpo), staggered ~80ms; % delta fades/slides in after.
- **Graph:** draw-in on load; path morph on D/W/M switch; hover/touch value point.
- **Withdraw:** spring-in modal/sheet; stepper check pops; Step 3 real spinner for configurable duration; Step 4 satisfying check scale-in.
- **`prefers-reduced-motion`:** degrade to instant states.
- All durations/easings centralized in `lib/animate.js` for a consistent, tweakable feel.

## 11. Testing

Scaled to a static visual prop; focused on logic that can break.

- **Unit tests** (Node built-in `node --test`, no framework/build):
  - `earnings-engine` — series generation, weekly/monthly aggregation, totals, % deltas, **seed determinism**.
  - `format` — currency/locale/number/date across $, £, €.
  - `config/persistence` — load/save + JSON export/import round-trips.
  - `withdraw-flow` state machine — valid transitions, Max = balance, back navigation.
- **One Playwright smoke test** — load → open control panel → change a value → open withdraw → step through to "Transfer initiated." Catches cross-module wiring breakage.
- Visual surfaces verified by eye / screenshot.

## 12. Deployment

- Static deploy to Vercel; `vercel.json` with `git.deploymentEnabled.main:false`.
- Domain-agnostic; point one reusable neutral domain (`.app` recommended for forced HTTPS / padlock realism) at Vercel when ready. Does not block development.

## 13. Decisions log

| Decision | Choice |
|---|---|
| Primary use | Screen-recorded prop |
| Config model | Live control panel (hidden drawer, keyboard toggle, live updates, JSON export/import) |
| Core scope | Stat cards, Balance + 4-step Withdraw, Graph w/ D/W/M toggle, Breakdown tables, Control panel |
| Architecture | Approach B — buildless vanilla ES modules + CSS tokens |
| Responsive | Layout A, mobile-first, polished desktop |
| Graph style | Smooth area + gradient |
| Withdraw | 4 steps (Amount → Review → Processing → Complete); bottom-sheet on mobile |
| Domain | One reusable neutral domain; app domain-agnostic |
| Data | Seeded RNG for reproducible recordings |

## 14. Deferred / future (out of current scope)

Realtime ticking numbers + toast notifications, recent activity feed, withdrawal history, login/intro screen. Architecture (store + surface modules + feature toggles) leaves room to add these without rework.
