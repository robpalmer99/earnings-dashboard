# Earnings Dashboard — Camera Realism Upgrade

**Date:** 2026-06-12
**Status:** Approved design, pending implementation plan
**Builds on:** `2026-06-06-earnings-dashboard-redesign-design.md` (architecture unchanged)

## 1. Overview

A fresh-eyes on-camera audit of the implemented dashboard (capture: desktop browser at mobile viewport; shot list: withdraw flow end-to-end, earnings scroll-through, balance close-up) found five illusion-breaking defects, five gaps where the build under-delivers the approved spec, and three realism enhancers worth adding. This design covers all thirteen (scope option C, approved).

Architecture is unchanged: buildless native ES modules, CSS custom-property theming, store + surface modules (`mount`/`update`), config-driven via the live control panel.

## 2. Audit findings being addressed

### Illusion breakers
1. **Monthly graph renders as a triangle** — calendar-month aggregation over a 60-day window yields partial first/last months (low-high-low), reading as "earnings crashing."
2. **Default config shows a red ▼ on "This Week"** — nothing prevents negative deltas on any seed.
3. **"Today" is yesterday in UTC-ahead timezones** — dates derive from `Date.toISOString()` (UTC).
4. **Balance unchanged after a withdrawal** — continuity break in the money shot.
5. **Chart end-dot renders as an oval; stroke widths distort** — SVG stretched via `preserveAspectRatio: none`.

### Spec-promised, not delivered
6. Chart: straight segments + flat 12% fill instead of smooth curve + gradient; no touch/hover tooltip (`.tip` CSS exists, unwired); D/W/M switch is a hard cut, not the specced morph.
7. Withdraw step 1: preset chips only — no typed amount input; opens at $0.00 with a live-looking but dead Continue.
8. Completion copy contradiction: "Transfer initiated!" vs "Status: Completed".
9. Emoji iconography (🏦 ⚡ 🔒 ▲ ▼ ⚙) instead of crisp SVG icons.
10. Placeholder brand chrome: blank accent square logo, empty gray avatar circle.

### Realism enhancers (new scope)
11. Recent payouts surface (previously deferred).
12. App chrome: monogram avatar, notification bell, "Updated just now", optional bottom tab bar.
13. Weekend-dip data realism option.

## 3. Data engine changes (`src/data/earnings-engine.js`, `src/lib/dates.js`)

- **Master series**: generate ~180 days of seeded daily history (constant `MASTER_DAYS = 180`), independent of the configured `windowDays`. Daily graph view still shows the last 30 days; breakdown table the last 7. The "Total" card keeps its current meaning: the sum of the last `windowDays` days (so the configured window still controls the all-time figure shown on camera). Same seed → same series; determinism preserved.
- **Monthly series**: six trailing 30-day buckets ending today (`[today-179..today-150] … [today-29..today]`), each labeled with the month name of the bucket's end date. Complete buckets only → the partial-month dip is structurally impossible. `windowDays` remains for the daily window; values below 30 no longer starve the monthly view.
- **Local dates**: `isoDate()` builds `YYYY-MM-DD` from local `getFullYear()/getMonth()/getDate()` instead of `toISOString()`. Day arithmetic stays in UTC space internally (`addDays` unchanged) — only the "today" anchor and display formatting are local.
- **Force-positive deltas** (`data.forcePositiveDeltas`, default `true`): after generation, a deterministic uplift pass adjusts the series so all three deltas are positive — first scale the last 30 days as a block until Month (last-30 vs prior-30) lands in a positive band, then scale the last 7 within it for Week, then nudge today for Today. Target bands ~+5% to +40%, derived from the seeded RNG, never round numbers. Today-vs-yesterday is also kept positive unless `todayDeltaOverride` is set (override continues to win for the hero card). All surfaces derive from the adjusted series, so cards, graph, and table always agree.
- **Weekend dip** (`data.weekendDip`, default `false`): when enabled, Saturday/Sunday amounts scale by a fixed 0.6 factor before the uplift pass, giving the daily chart an organic weekly rhythm.

## 4. Chart upgrade (`src/charts/`)

- **Smooth curve**: Catmull-Rom-to-Bézier conversion in `chart-math.js` (pure function, unit-testable). Area path closes under the same curve.
- **Gradient fill**: SVG `<defs><linearGradient>` from `--accent` at ~28% alpha to 0%, replacing the flat fill.
- **No distortion**: chart renders at the container's true pixel size — `line-chart.js` reads the host element's box (ResizeObserver re-renders on resize) and sets the viewBox to match. Round dot, uniform strokes at any width.
- **Touch/hover tooltip**: pointermove/touch maps x → nearest point; shows marker dot + value bubble using the existing `.tip`/`.tip-text` styles. Hides on pointer leave. Tapping the graph during a recording now does something realistic.
- **Path morph**: on D/W/M switch, resample old and new series to a common point count and animate interpolation (~450ms, easeOutExpo from `lib/animate.js`). Initial load keeps the existing draw-in.

## 5. Withdraw flow polish (`src/surfaces/withdraw-flow.js`, `withdraw-machine.js`)

- **Step 1 — typed input**: large amount `<input inputmode="decimal">` styled like the current display; preset chips prefill it; machine's existing `setAmount` clamp (0…balance) applies on input. **Continue is disabled** (visually and functionally) until `0 < amount ≤ balance`.
- **Step 4 — copy**: headline "Transfer complete!"; sub-line unchanged; "Status: Completed" now consistent.
- **Balance continuity**: on Done (and on sheet close after completion), the store's runtime data applies `balance -= amount` and prepends a payout row (see §6) marked "Just now". **Runtime only** — config/localStorage untouched; reload restores the configured balance so retakes need zero cleanup.
- **Icons**: new `src/lib/icons.js` exporting small inline SVG factories (bank, lock, bolt, arrow-up, check, caret-up, caret-down, bell, gear). All emoji in surfaces and panel replaced. Delta carets in stat cards switch from ▲/▼ text to SVG carets.

## 6. New surface: Recent payouts (`src/surfaces/recent-payouts.js`)

- Card titled "Recent Payouts": rows of date · bank label · amount · green "Completed" badge.
- Seeded generation: `payouts.count` (default 4) rows spread over the past ~6 weeks at irregular seeded intervals, amounts drawn from the same RNG in a plausible band relative to `withdraw.presets` (non-round, e.g. $1,250.00 sometimes, $987.40 others). Same seed → same history.
- A completed on-camera withdrawal prepends a "Just now" row (runtime only, consistent with §5).
- Config: `surfaces.payouts` toggle (default `true`), `payouts.count` in the panel's Withdraw section.
- Mounted between Balance card and Graph (payout story sits next to the Withdraw CTA).

## 7. App chrome (`src/main.js`, `src/surfaces/`, styles)

- **Monogram avatar**: brand initials (first letters of up to two words of `brand.name`) on accent background replaces the empty gray circle. A future real-photo URL field is out of scope.
- **Notification bell**: SVG bell with small accent badge dot, left of the avatar. Non-functional.
- **"Updated just now"**: small muted stamp beside the page title.
- **Bottom tab bar** (`surfaces.tabBar`, default `true`; renders only below the 720px breakpoint): fixed bar with four items — Home, Earnings (active), Payouts, Settings — SVG icons + labels, accent on the active item, `env(safe-area-inset-bottom)` padding. Non-functional (visual prop). Container bottom padding increases when visible so the table never hides behind it.

## 8. Config schema & control panel

New defaults merged into `defaultConfig` (existing `mergeConfig` upgrades old saved configs automatically):

```js
data:     { …, forcePositiveDeltas: true, weekendDip: false }
surfaces: { …, payouts: true, tabBar: true }
payouts:  { count: 4 }
```

Control panel additions, slotted into existing sections: Data → "Always positive deltas" + "Weekend dip" checkboxes; Withdraw → "Payout history rows" number; Surfaces → "Recent payouts" + "Bottom tab bar" toggles. The ⚙/keyboard hint copy keeps working as today.

## 9. Out of scope

Login screen, realtime ticking numbers, toast notifications, activity feed beyond payouts, real photo avatars, functional navigation for the tab bar.

## 10. Testing

- **Unit (`node --test`)**: monthly trailing buckets (count, completeness, labels); uplift pass (deltas positive across many seeds, band respected, determinism); local-date anchor (mocked Date); weekend dip scaling; machine balance decrement + payout prepend; payout history determinism; Catmull-Rom path math (point count, endpoints).
- **Playwright smoke (extended)**: type an arbitrary amount in step 1 (not just chips); Continue disabled at $0; complete flow → balance visibly decreases and a "Just now" payout row appears; monthly toggle shows ≥5 points (no triangle); tooltip bubble appears on graph tap; tab bar visible at mobile viewport, absent at desktop.
- Visual verification by screenshot at iPhone viewport for each surface, light + dark presets.

## 11. Decisions log

| Decision | Choice |
|---|---|
| Scope | Option C — all 13 audit items |
| Monthly chart data | Trailing 30-day buckets, month-name labels |
| Balance after withdrawal | Runtime-only decrement; reload restores config balance |
| Bottom tab bar | Build it, default ON (mobile viewports only) |
| Force-positive deltas | Default ON |
| Weekend dip | Build it, default OFF |
| Today delta override | Still wins over derived/forced delta for the hero card |
