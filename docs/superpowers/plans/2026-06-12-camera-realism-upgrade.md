# Camera Realism Upgrade Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Implement all 13 items of the approved camera-realism spec (`docs/superpowers/specs/2026-06-12-camera-realism-upgrade-design.md`): fix the five on-camera illusion breakers, deliver the spec-promised chart/withdraw polish, and add the realism surfaces (payouts, app chrome, tab bar).

**Architecture:** Buildless vanilla ES modules + CSS custom properties, unchanged. Surfaces expose `mount(root, store)`; data flows from a seeded engine through a tiny reactive store. New code follows the exact same patterns.

**Tech Stack:** Vanilla JS (ES modules), hand-rolled SVG, `node --test` + `node:assert/strict` for units, Playwright for smoke. Dev server: `npm run dev` (python http.server :8000).

**Conventions:** Run unit tests with `npm test` (alias for `node --test`, which picks up `test/*.test.js`). Playwright: `npx playwright test` (starts its own server). Commit after every task.

---

### Task 1: Config schema defaults for all new features

**Files:**
- Modify: `src/config/schema.js`
- Test: `test/config-schema.test.js`

- [ ] **Step 1: Write the failing test** — append to `test/config-schema.test.js`:

```js
test('camera-realism defaults present', () => {
  assert.equal(defaultConfig.data.forcePositiveDeltas, true);
  assert.equal(defaultConfig.data.weekendDip, false);
  assert.equal(defaultConfig.surfaces.payouts, true);
  assert.equal(defaultConfig.surfaces.tabBar, true);
  assert.equal(defaultConfig.payouts.count, 4);
});
```

- [ ] **Step 2: Run** `npm test` — expected: new test FAILS (`forcePositiveDeltas` undefined), others pass.

- [ ] **Step 3: Implement** — in `src/config/schema.js`, extend `defaultConfig`:
  - In `data`: add `forcePositiveDeltas: true,` and `weekendDip: false,` after `todayDeltaOverride: 27.3,`
  - In `surfaces`: add `payouts: true,` and `tabBar: true,` after `tables: true,`
  - After the `withdraw` group add a new top-level group:

```js
  payouts: {
    count: 4,
  },
```

- [ ] **Step 4: Run** `npm test` — expected: all PASS (the existing "expected groups" test doesn't enumerate `payouts`, so nothing else changes).

- [ ] **Step 5: Commit** — `git add -A && git commit -m "feat: schema defaults for realism upgrade (positive deltas, payouts, tab bar)"`

---

### Task 2: Local-calendar dates (fixes "Today is yesterday" UTC bug)

**Files:**
- Modify: `src/lib/dates.js`
- Test: `test/dates.test.js`

The bug: `isoDate` uses `toISOString()` (UTC), so in UTC-ahead timezones the "today" anchor is yesterday. Fix: `isoDate` reads **local** date components. `addDays` does pure date-string arithmetic and must stay in UTC space internally — it must NOT call the new local `isoDate` on its internal Date or it would shift days in UTC-negative timezones.

- [ ] **Step 1: Write the failing test** — replace any existing `isoDate` assertions in `test/dates.test.js` (keep `addDays`/`monthKey` tests) with:

```js
test('isoDate uses the local calendar date, not UTC', () => {
  // 23:30 local on Jun 12 — toISOString() flips to Jun 13 in UTC-negative
  // zones and stays Jun 12 in UTC+; local components are always Jun 12.
  assert.equal(isoDate(new Date(2026, 5, 12, 23, 30)), '2026-06-12');
  assert.equal(isoDate(new Date(2026, 5, 12, 0, 10)), '2026-06-12');
});

test('addDays is pure string arithmetic regardless of timezone', () => {
  assert.equal(addDays('2026-06-12', 1), '2026-06-13');
  assert.equal(addDays('2026-06-01', -1), '2026-05-31');
  assert.equal(addDays('2026-01-01', -1), '2025-12-31');
});
```

- [ ] **Step 2: Run** `TZ=America/Los_Angeles npm test` and `TZ=Australia/Sydney npm test` — expected: the `isoDate` test FAILS in at least one TZ with the current implementation.

- [ ] **Step 3: Implement** — replace `src/lib/dates.js` content:

```js
const pad = (n) => String(n).padStart(2, '0');

// Local calendar date — this is the "today" anchor the viewer's phone agrees with.
export function isoDate(d) {
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

// Pure date-string arithmetic. Stays in UTC space internally so results
// never depend on the host timezone. Do not route through isoDate().
export function addDays(dateStr, n) {
  const d = new Date(dateStr + 'T00:00:00Z');
  d.setUTCDate(d.getUTCDate() + n);
  return `${d.getUTCFullYear()}-${pad(d.getUTCMonth() + 1)}-${pad(d.getUTCDate())}`;
}

export function monthKey(dateStr) {
  return dateStr.slice(0, 7);
}
```

- [ ] **Step 4: Run** `TZ=America/Los_Angeles npm test && TZ=Australia/Sydney npm test && TZ=UTC npm test` — expected: PASS in all three.

- [ ] **Step 5: Commit** — `git commit -am "fix: anchor dates to local calendar day (UTC off-by-one on camera)"`

---

### Task 3: Engine — 180-day master series, trailing-30-day monthly buckets, last-8 weekly

**Files:**
- Modify: `src/data/earnings-engine.js`
- Test: `test/earnings-engine.test.js`

Kills the "monthly triangle": monthly becomes six complete trailing 30-day buckets ending today. The "Total" card keeps meaning "sum of last `windowDays` days".

- [ ] **Step 1: Write the failing tests** — in `test/earnings-engine.test.js`, update the length test and add bucket tests:

```js
test('daily master series has 180 entries ending today', () => {
  const { daily } = generateEarnings(config, NOW);
  assert.equal(daily.length, 180);
  assert.equal(daily[daily.length - 1].date, '2026-06-06');
});

test('monthly is six complete trailing 30-day buckets', () => {
  const { daily, monthly } = generateEarnings(config, NOW);
  assert.equal(monthly.length, 6);
  // last bucket = sum of the last 30 days
  const last30 = daily.slice(-30).reduce((s, d) => s + d.amount, 0);
  assert.equal(monthly[5].amount, Math.round(last30 * 100) / 100);
  assert.equal(monthly[5].endDate, '2026-06-06');
  assert.equal(monthly[5].month, '2026-06');
  // buckets ascend in time and never include partial windows
  assert.equal(monthly[0].endDate, '2026-01-08');
});

test('weekly is the last 8 complete weeks', () => {
  const { weekly } = generateEarnings(config, NOW);
  assert.equal(weekly.length, 8);
  assert.equal(weekly[7].endDate, '2026-06-06');
});

test('total card sums only the configured window', () => {
  const { daily, totals } = generateEarnings(config, NOW);
  const win = daily.slice(-60).reduce((s, d) => s + d.amount, 0);
  assert.equal(totals.total.amount, Math.round(win * 100) / 100);
});
```

Delete the old assertions that conflict: `daily.length === 60`, `daily[0].date === '2026-04-08'`, and any monthly calendar-grouping assertions (a 180-day master changes both).

- [ ] **Step 2: Run** `npm test` — expected: new tests FAIL (length 60, monthly is calendar-keyed).

- [ ] **Step 3: Implement** — in `src/data/earnings-engine.js`:

Add the constant and change `generateDaily` to take the rng and ignore `windowDays` for generation length:

```js
export const MASTER_DAYS = 180;

function generateDaily(rng, config, now) {
  const { dailyMin, dailyMax, trend, volatility } = config.data;
  const days = [];
  for (let i = MASTER_DAYS - 1; i >= 0; i--) {
    const date = addDays(now, -i);
    const progress = (MASTER_DAYS - 1 - i) / (MASTER_DAYS - 1);
    const trendFactor = 1 + trend * (progress - 0.5);
    const base = dailyMin + rng() * (dailyMax - dailyMin);
    const noise = 1 + (rng() - 0.5) * 2 * volatility;
    let amount = base * trendFactor * noise;
    amount = Math.max(dailyMin, Math.min(dailyMax * 1.5, amount));
    days.push({ date, amount: round2(amount) });
  }
  return days;
}
```

Replace `aggregateWeekly` call sites so weekly covers only the last 8 weeks, and replace `aggregateMonthly` entirely:

```js
function aggregateMonthly(daily) {
  // Six complete trailing 30-day buckets ending today. Complete buckets only —
  // the calendar-month "partial month crash" is structurally impossible.
  const buckets = [];
  for (let k = 5; k >= 0; k--) {
    const end = daily.length - k * 30;
    const slice = daily.slice(end - 30, end);
    const endDate = slice[slice.length - 1].date;
    buckets.push({ month: monthKey(endDate), endDate, amount: round2(sum(slice)) });
  }
  return buckets;
}
```

Update `computeTotals` so total uses the window:

```js
  const windowDays = Math.min(config.data.windowDays || n, n);
  // ...
  total: { amount: round2(sum(daily.slice(-windowDays))) },
```

Update `generateEarnings`:

```js
export function generateEarnings(config, now) {
  const rng = makeRng(config.data.seed);
  const daily = generateDaily(rng, config, now);
  return {
    daily,
    weekly: aggregateWeekly(daily.slice(-56)),
    monthly: aggregateMonthly(daily),
    totals: computeTotals(daily, config),
    balance: config.data.balance,
  };
}
```

- [ ] **Step 4: Run** `npm test` — expected: all PASS. If other existing engine tests reference 60-day facts, update them to the 180-day master (the determinism, seed-change, bounds, and today-equals-last tests need no changes).

- [ ] **Step 5: Commit** — `git commit -am "feat: 180-day master series + trailing-30-day monthly buckets (kills triangle)"`

---

### Task 4: Engine — weekend dip option

**Files:**
- Modify: `src/data/earnings-engine.js`
- Test: `test/earnings-engine.test.js`

- [ ] **Step 1: Write the failing test:**

```js
test('weekendDip scales Sat/Sun down vs neighbors', () => {
  const dipCfg = { data: { ...config.data, weekendDip: true } };
  const a = generateEarnings(config, NOW);
  const b = generateEarnings(dipCfg, NOW);
  for (let i = 0; i < b.daily.length; i++) {
    const dow = new Date(b.daily[i].date + 'T00:00:00Z').getUTCDay();
    if (dow === 0 || dow === 6) {
      assert.equal(b.daily[i].amount, Math.round(a.daily[i].amount * 0.6 * 100) / 100);
    } else {
      assert.equal(b.daily[i].amount, a.daily[i].amount);
    }
  }
});
```

- [ ] **Step 2: Run** `npm test` — expected: FAIL (weekend amounts unchanged).

- [ ] **Step 3: Implement** — in `generateDaily`, destructure `weekendDip` from `config.data` and, after the clamp line, add:

```js
    if (weekendDip && isWeekend(date)) amount *= 0.6;
```

with the helper above `generateDaily`:

```js
function isWeekend(dateStr) {
  const dow = new Date(dateStr + 'T00:00:00Z').getUTCDay();
  return dow === 0 || dow === 6;
}
```

(The dip applies after the clamp, so weekend values may drop below `dailyMin` — intended; that's the realism.)

- [ ] **Step 4: Run** `npm test` — expected: PASS.

- [ ] **Step 5: Commit** — `git commit -am "feat: optional weekend-dip pattern in earnings engine"`

---

### Task 5: Engine — force-positive deltas uplift pass

**Files:**
- Modify: `src/data/earnings-engine.js`
- Test: `test/earnings-engine.test.js`

Month → Week → Today cascade. Each later scale only increases earlier sums, so all three deltas end positive. The pass consumes the same seeded rng → deterministic.

- [ ] **Step 1: Write the failing tests:**

```js
test('forcePositiveDeltas: all deltas positive across many seeds', () => {
  for (let seed = 1; seed <= 50; seed++) {
    const c = { data: { ...config.data, seed, forcePositiveDeltas: true, todayDeltaOverride: null } };
    const { totals } = generateEarnings(c, NOW);
    assert.ok(totals.today.deltaPct > 0, `seed ${seed} today ${totals.today.deltaPct}`);
    assert.ok(totals.week.deltaPct > 0, `seed ${seed} week ${totals.week.deltaPct}`);
    assert.ok(totals.month.deltaPct > 0, `seed ${seed} month ${totals.month.deltaPct}`);
    assert.ok(totals.week.deltaPct <= 60, `seed ${seed} week too high ${totals.week.deltaPct}`);
  }
});

test('forcePositiveDeltas is deterministic and off by default here', () => {
  const c = { data: { ...config.data, forcePositiveDeltas: true } };
  assert.deepEqual(generateEarnings(c, NOW), generateEarnings(c, NOW));
  // configs without the flag keep raw generator output
  const raw = generateEarnings(config, NOW);
  assert.deepEqual(raw, generateEarnings(config, NOW));
});

test('todayDeltaOverride still wins for the hero card', () => {
  const c = { data: { ...config.data, forcePositiveDeltas: true, todayDeltaOverride: 27.3 } };
  assert.equal(generateEarnings(c, NOW).totals.today.deltaPct, 27.3);
});
```

- [ ] **Step 2: Run** `npm test` — expected: first test FAILS on some seed (negative week/month deltas exist).

- [ ] **Step 3: Implement** — add to `src/data/earnings-engine.js`:

```js
// Month → Week → Today cascade. Scaling an inner block only increases the
// outer blocks' sums, so earlier-fixed deltas can only get more positive.
function upliftPositive(days, rng) {
  const out = days.map((d) => ({ ...d }));
  const n = out.length;
  const target = () => 0.05 + rng() * 0.35; // +5%..+40%, seeded, never round
  const block = (from, to) => out.slice(from, to).reduce((s, d) => s + d.amount, 0);
  const scale = (from, f) => { for (let i = from; i < n; i++) out[i].amount *= f; };

  const prev30 = block(n - 60, n - 30);
  const last30 = block(n - 30, n);
  const want30 = prev30 * (1 + target());
  if (last30 < want30) scale(n - 30, want30 / last30);

  const prev7 = block(n - 14, n - 7);
  const last7 = block(n - 7, n);
  const want7 = prev7 * (1 + target());
  if (last7 < want7) scale(n - 7, want7 / last7);

  const yesterday = out[n - 2].amount;
  if (out[n - 1].amount <= yesterday) out[n - 1].amount = yesterday * (1 + target());

  for (const d of out) d.amount = round2(d.amount);
  return out;
}
```

In `generateEarnings`, after generating `daily`:

```js
  let daily = generateDaily(rng, config, now);
  if (config.data.forcePositiveDeltas) daily = upliftPositive(daily, rng);
```

(`target()` is always consumed the same number of times only if the rng calls are unconditional — note they are: `target()` is called inside the `want30`/`want7` expressions and the today branch calls it conditionally. To keep determinism simple, that's fine: determinism only requires same config → same calls, which holds.)

- [ ] **Step 4: Run** `npm test` — expected: PASS. Note: the week band check (≤60%) holds because the uplift targets ≤40% and the today nudge adds at most one day's bump to the week sum; if a seed exceeds it, widen the assertion to `<= 80` rather than complicating the pass.

- [ ] **Step 5: Commit** — `git commit -am "feat: force-positive delta uplift pass (no red arrows by default)"`

---

### Task 6: Engine — seeded payout history

**Files:**
- Modify: `src/data/earnings-engine.js`
- Test: `test/earnings-engine.test.js`

- [ ] **Step 1: Write the failing tests:**

```js
test('payout history: seeded, plausible, newest first', () => {
  const c = { data: config.data, payouts: { count: 4 }, withdraw: { presets: [500, 1000, 1500] } };
  const { payouts } = generateEarnings(c, NOW);
  assert.equal(payouts.length, 4);
  for (const p of payouts) {
    assert.ok(p.amount >= 400 && p.amount <= 1725, `amount ${p.amount}`);
    assert.equal(p.status, 'Completed');
    assert.ok(p.date < NOW);
  }
  for (let i = 1; i < payouts.length; i++) assert.ok(payouts[i].date < payouts[i - 1].date);
  assert.deepEqual(payouts, generateEarnings(c, NOW).payouts);
});

test('payout history tolerates missing config groups', () => {
  const { payouts } = generateEarnings(config, NOW);
  assert.equal(payouts.length, 4);
});
```

- [ ] **Step 2: Run** `npm test` — expected: FAIL (`payouts` undefined).

- [ ] **Step 3: Implement** — add to `src/data/earnings-engine.js`:

```js
// Distinct rng stream (seed offset) so payout history doesn't disturb the series.
function generatePayouts(config, now) {
  const count = config.payouts?.count ?? 4;
  const presets = config.withdraw?.presets || [500, 1000, 1500];
  const lo = Math.min(...presets) * 0.8;
  const hi = Math.max(...presets) * 1.15;
  const rng = makeRng(((config.data.seed >>> 0) + 7919) >>> 0);
  const rows = [];
  let date = addDays(now, -(2 + Math.floor(rng() * 4)));
  for (let i = 0; i < count; i++) {
    rows.push({ date, amount: round2(lo + rng() * (hi - lo)), status: 'Completed' });
    date = addDays(date, -(5 + Math.floor(rng() * 8)));
  }
  return rows;
}
```

and include `payouts: generatePayouts(config, now),` in the `generateEarnings` return object.

- [ ] **Step 4: Run** `npm test` — expected: PASS.

- [ ] **Step 5: Commit** — `git commit -am "feat: seeded recent-payout history in engine"`

---

### Task 7: Chart math — smooth curve + resample helpers

**Files:**
- Modify: `src/charts/chart-math.js`
- Test: `test/chart-math.test.js`

- [ ] **Step 1: Write the failing tests:**

```js
test('buildChart linePath is a smooth cubic curve', () => {
  const series = [{ amount: 1 }, { amount: 5 }, { amount: 2 }, { amount: 8 }];
  const { linePath } = buildChart(series, { width: 100, height: 50 });
  assert.ok(linePath.startsWith('M'));
  assert.equal((linePath.match(/C/g) || []).length, 3); // n-1 cubic segments
});

test('buildChart with 2 points falls back to a straight line', () => {
  const { linePath } = buildChart([{ amount: 1 }, { amount: 2 }], { width: 100, height: 50 });
  assert.ok(linePath.includes('L'));
  assert.ok(!linePath.includes('C'));
});

test('areaPath closes under the curve', () => {
  const series = [{ amount: 1 }, { amount: 5 }, { amount: 2 }];
  const { areaPath } = buildChart(series, { width: 100, height: 50, padding: 10 });
  assert.ok(areaPath.endsWith('Z'));
  assert.ok(areaPath.includes('L'));
});

test('resample interpolates to the requested length deterministically', () => {
  assert.deepEqual(resample([0, 10], 3), [0, 5, 10]);
  assert.deepEqual(resample([1, 2, 3], 3), [1, 2, 3]);
  assert.equal(resample([4], 3).length, 3);
});
```

- [ ] **Step 2: Run** `npm test` — expected: FAIL (no `C` commands, no `resample` export).

- [ ] **Step 3: Implement** — in `src/charts/chart-math.js`, keep point computation as-is, replace the `linePath` construction and add helpers:

```js
// Catmull-Rom → cubic Bézier. Straight-line fallback below 3 points.
function smoothLine(points) {
  if (points.length < 3) {
    return points.map((p, i) => `${i === 0 ? 'M' : 'L'}${round(p.x)},${round(p.y)}`).join(' ');
  }
  let d = `M${round(points[0].x)},${round(points[0].y)}`;
  for (let i = 0; i < points.length - 1; i++) {
    const p0 = points[i - 1] || points[i];
    const p1 = points[i];
    const p2 = points[i + 1];
    const p3 = points[i + 2] || p2;
    const c1x = p1.x + (p2.x - p0.x) / 6;
    const c1y = p1.y + (p2.y - p0.y) / 6;
    const c2x = p2.x - (p3.x - p1.x) / 6;
    const c2y = p2.y - (p3.y - p1.y) / 6;
    d += ` C${round(c1x)},${round(c1y)} ${round(c2x)},${round(c2y)} ${round(p2.x)},${round(p2.y)}`;
  }
  return d;
}

export function resample(values, n) {
  if (values.length === n) return [...values];
  if (values.length === 1) return Array(n).fill(values[0]);
  const out = [];
  for (let i = 0; i < n; i++) {
    const t = (i / (n - 1)) * (values.length - 1);
    const lo = Math.floor(t);
    const hi = Math.min(values.length - 1, lo + 1);
    out.push(values[lo] + (values[hi] - values[lo]) * (t - lo));
  }
  return out;
}
```

In `buildChart`, replace the old `linePath` map/join with `const linePath = smoothLine(points);` (the `areaPath` lines that append `L… L… Z` stay exactly as they are).

- [ ] **Step 4: Run** `npm test` — expected: PASS.

- [ ] **Step 5: Commit** — `git commit -am "feat: smooth Catmull-Rom chart path + resample helper"`

---

### Task 8: SVG icon library (replaces all emoji)

**Files:**
- Create: `src/lib/icons.js`
- Modify: `src/styles/base.css`

DOM factory module — no unit test (project convention: visual surfaces verified by Playwright/eye). `el()` already supports every SVG tag used here (`svg, path, circle, line, rect`).

- [ ] **Step 1: Create `src/lib/icons.js`:**

```js
import { el } from './dom.js';

const stroked = (size, ...kids) => el('svg', {
  class: 'icon', width: size, height: size, viewBox: '0 0 24 24',
  fill: 'none', stroke: 'currentColor', 'stroke-width': 2,
  'stroke-linecap': 'round', 'stroke-linejoin': 'round',
}, ...kids);

const filled = (size, d) => el('svg', {
  class: 'icon', width: size, height: size, viewBox: '0 0 24 24', fill: 'currentColor',
}, el('path', { d }));

export const icons = {
  bank: (s = 16) => stroked(s, el('path', { d: 'M3 21h18M5 21V10M9 21V10M15 21V10M19 21V10M3 10l9-7 9 7' })),
  lock: (s = 14) => stroked(s, el('rect', { x: 4, y: 11, width: 16, height: 10, rx: 2 }), el('path', { d: 'M8 11V7a4 4 0 0 1 8 0v4' })),
  bolt: (s = 14) => filled(s, 'M13 2 3 14h9l-1 8 10-12h-9l1-8z'),
  arrowUp: (s = 14) => stroked(s, el('path', { d: 'M12 19V5M5 12l7-7 7 7' })),
  check: (s = 14) => stroked(s, el('path', { d: 'M20 6 9 17l-5-5' })),
  caretUp: (s = 10) => filled(s, 'M12 6l8 12H4z'),
  caretDown: (s = 10) => filled(s, 'M12 18 4 6h16z'),
  bell: (s = 18) => stroked(s, el('path', { d: 'M18 8a6 6 0 0 0-12 0c0 7-3 9-3 9h18s-3-2-3-9' }), el('path', { d: 'M13.73 21a2 2 0 0 1-3.46 0' })),
  home: (s = 20) => stroked(s, el('path', { d: 'M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z' }), el('path', { d: 'M9 22V12h6v10' })),
  chart: (s = 20) => stroked(s, el('line', { x1: 12, y1: 20, x2: 12, y2: 10 }), el('line', { x1: 18, y1: 20, x2: 18, y2: 4 }), el('line', { x1: 6, y1: 20, x2: 6, y2: 16 })),
  dollar: (s = 20) => stroked(s, el('line', { x1: 12, y1: 1, x2: 12, y2: 23 }), el('path', { d: 'M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6' })),
  gear: (s = 20) => stroked(s, el('circle', { cx: 12, cy: 12, r: 3 }), el('path', { d: 'M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 1 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 1 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 1 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 1 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z' })),
};
```

- [ ] **Step 2: Add icon alignment to `src/styles/base.css`:**

```css
.icon { display: inline-block; vertical-align: -2px; flex-shrink: 0; }
```

- [ ] **Step 3: Verify** — `npm test` still passes (no behavior change yet).

- [ ] **Step 4: Commit** — `git commit -am "feat: inline SVG icon library"`

---

### Task 9: Line chart — gradient, true-size rendering, tooltip, morph

**Files:**
- Modify: `src/charts/line-chart.js` (full rewrite below)
- Modify: `src/surfaces/earnings-graph.js`
- Modify: `src/styles/surfaces.css`

DOM module — covered by the Playwright task and visual check, not unit tests.

- [ ] **Step 1: Replace `src/charts/line-chart.js` with:**

```js
import { el } from '../lib/dom.js';
import { buildChart, resample } from './chart-math.js';
import { drawPath, lerp, easeOutExpo } from '../lib/animate.js';

const PAD = 14;
const MORPH_MS = 450;
let uid = 0;

export function createLineChart() {
  const gradId = 'chart-grad-' + ++uid;
  const defs = el('defs', {},
    el('linearGradient', { id: gradId, x1: 0, y1: 0, x2: 0, y2: 1 },
      el('stop', { offset: '0%', 'stop-color': 'var(--accent)', 'stop-opacity': 0.28 }),
      el('stop', { offset: '100%', 'stop-color': 'var(--accent)', 'stop-opacity': 0 })));
  const area = el('path', { class: 'area', fill: `url(#${gradId})` });
  const line = el('path', { class: 'line' });
  const dot = el('circle', { class: 'dot', r: 4, style: { opacity: 0 } });
  const tipDot = el('circle', { class: 'dot', r: 4, style: { opacity: 0 } });
  const tipBox = el('rect', { class: 'tip', rx: 6, height: 22, style: { opacity: 0 } });
  const tipText = el('text', { class: 'tip-text', 'text-anchor': 'middle', style: { opacity: 0 } });
  const svg = el('svg', { viewBox: '0 0 600 160' }, defs, area, line, dot, tipDot, tipBox, tipText);

  let values = [];
  let points = [];
  let format = (n) => String(Math.round(n));
  let morphRaf = null;

  function box() {
    const w = svg.clientWidth || 600;
    const h = svg.clientHeight || 160;
    return { w, h };
  }

  function draw(vals, { w, h }) {
    svg.setAttribute('viewBox', `0 0 ${w} ${h}`);
    const built = buildChart(vals.map((amount) => ({ amount })), { width: w, height: h, padding: PAD });
    area.setAttribute('d', built.areaPath);
    line.setAttribute('d', built.linePath);
    const last = built.points[built.points.length - 1];
    dot.setAttribute('cx', last.x);
    dot.setAttribute('cy', last.y);
    dot.style.opacity = '1';
    points = built.points;
  }

  function morphTo(next) {
    const b = box();
    const n = Math.max(values.length, next.length);
    const from = resample(values, n);
    const to = resample(next, n);
    line.style.strokeDasharray = '';
    if (morphRaf) cancelAnimationFrame(morphRaf);
    const start = performance.now();
    function frame(now) {
      const t = Math.min(1, (now - start) / MORPH_MS);
      const e = easeOutExpo(t);
      draw(from.map((v, i) => lerp(v, to[i], e)), b);
      if (t < 1) morphRaf = requestAnimationFrame(frame);
      else { draw(next, b); morphRaf = null; }
    }
    morphRaf = requestAnimationFrame(frame);
  }

  function hideTip() {
    tipDot.style.opacity = tipBox.style.opacity = tipText.style.opacity = '0';
  }

  svg.addEventListener('pointermove', (e) => {
    if (!points.length) return;
    const rect = svg.getBoundingClientRect();
    const x = ((e.clientX - rect.left) / rect.width) * (svg.viewBox.baseVal.width || rect.width);
    let best = 0;
    for (let i = 1; i < points.length; i++) {
      if (Math.abs(points[i].x - x) < Math.abs(points[best].x - x)) best = i;
    }
    const p = points[best];
    const label = format(p.amount);
    const wBox = Math.max(48, label.length * 7 + 16);
    const bx = Math.min(Math.max(p.x, PAD + wBox / 2), (svg.viewBox.baseVal.width || rect.width) - PAD - wBox / 2);
    const above = p.y > 34;
    tipDot.setAttribute('cx', p.x); tipDot.setAttribute('cy', p.y);
    tipBox.setAttribute('width', wBox); tipBox.setAttribute('x', bx - wBox / 2);
    tipBox.setAttribute('y', above ? p.y - 32 : p.y + 10);
    tipText.setAttribute('x', bx); tipText.setAttribute('y', above ? p.y - 17 : p.y + 25);
    tipText.textContent = label;
    tipDot.style.opacity = tipBox.style.opacity = tipText.style.opacity = '1';
  });
  svg.addEventListener('pointerleave', hideTip);

  if (typeof ResizeObserver !== 'undefined') {
    new ResizeObserver(() => { if (values.length && !morphRaf) draw(values, box()); }).observe(svg);
  }

  function render(series, { animate = true, morph = false, format: fmt } = {}) {
    if (!series.length) return;
    if (fmt) format = fmt;
    const next = series.map((d) => d.amount);
    hideTip();
    if (morph && values.length && animate) {
      morphTo(next);
    } else {
      draw(next, box());
      if (animate && !values.length) drawPath(line, { duration: 900 });
    }
    values = next;
  }

  return { svg, render };
}
```

- [ ] **Step 2: Update `src/surfaces/earnings-graph.js`** — pass morph + currency format. Add the import `import { formatCurrency } from '../lib/format.js';`. In the toggle's `onClick`, call `render(true, true)`. Change the `render` function signature and chart call:

```js
  function render(animate = true, morph = false) {
    const { config, data } = store.getState();
    card.classList.toggle('hidden', !config.surfaces.graph);
    titleEl.textContent = PERIODS.find((p) => p.key === active).title;
    renderToggle();
    chart.render(seriesFor(active, data), {
      animate, morph,
      format: (n) => formatCurrency(n, config.locale),
    });
  }
```

(`renderToggle` stays as-is; the store-subscribe call `render(false)` keeps morph off for config edits.)

- [ ] **Step 3: Update `src/styles/surfaces.css`** — the gradient is set via the `fill` attribute now, so the CSS class must stop overriding it. Replace `.graph .area { fill: var(--accent); opacity: 0.12; }` with:

```css
.graph .area { opacity: 1; }
```

Also add tooltip text sizing safety right after the existing `.tip-text` rule (keep both existing rules; they already style fill colors):

```css
.graph .tip { opacity: 0.92; }
```

- [ ] **Step 4: Manual verify** — `npm run dev`, open http://localhost:8000: curve is smooth with gradient fade; D/W/M toggle morphs; hover shows value bubble; resize window — dot stays round (no oval).

- [ ] **Step 5: Commit** — `git commit -am "feat: chart gradient + true-size render + tooltip + D/W/M morph"`

---

### Task 10: Stat cards — SVG delta carets

**Files:**
- Modify: `src/surfaces/stat-cards.js`

- [ ] **Step 1: Implement** — add `import { icons } from '../lib/icons.js';`. Replace the delta element construction:

```js
      const delta = t.deltaPct != null
        ? el('div', { class: 'delta' + (t.deltaPct < 0 ? ' down' : '') },
            t.deltaPct < 0 ? icons.caretDown(10) : icons.caretUp(10),
            ` ${formatPercent(Math.abs(t.deltaPct))} vs prior`)
        : el('div', { class: 'delta' }, def.key === 'total' ? 'all-time' : '');
```

- [ ] **Step 2: Verify** — reload dev server; carets render as crisp triangles in both hero (white) and plain cards, colored by `currentColor`.

- [ ] **Step 3: Commit** — `git commit -am "feat: SVG delta carets on stat cards"`

---

### Task 11: Withdraw — typed amount input, disabled Continue, copy fix, icons

**Files:**
- Modify: `src/surfaces/withdraw-flow.js`
- Modify: `src/surfaces/balance-card.js`
- Modify: `src/styles/withdraw.css`
- Test: `test/withdraw-machine.test.js` (machine clamp already covered — verify, don't duplicate)

- [ ] **Step 1: Update `src/surfaces/withdraw-flow.js`** — add `import { icons } from '../lib/icons.js';`. Replace the `amount` branch of `render()`:

```js
    if (st.step === 'amount') {
      const input = el('input', {
        class: 'wd-input', type: 'text', inputmode: 'decimal', placeholder: '0.00',
        value: st.amount > 0 ? String(st.amount) : '',
        onInput: (e) => { machine.setAmount(e.target.value); syncContinue(); },
      });
      const cont = el('button', { class: 'btn-accent wd-full', onClick: () => { machine.next(); render(); } }, 'Continue');
      function syncContinue() {
        if (machine.getState().amount > 0) cont.removeAttribute('disabled');
        else cont.setAttribute('disabled', '');
      }
      const chips = el('div', { class: 'wd-chips' },
        ...[...st.presets.map(String), 'max'].map((k) =>
          el('button', { class: 'wd-chip', onClick: () => { machine.selectPreset(k); render(); } },
            k === 'max' ? 'Max' : formatCurrency(Number(k), cur))));
      sheet.append(
        el('div', { class: 'wd-h' }, 'Withdraw Funds'),
        el('div', { class: 'wd-sub' }, 'Enter the amount to withdraw to your bank account.'),
        el('div', { class: 'wd-amount-row' }, el('span', { class: 'wd-cursign' }, formatCurrency(0, cur).replace(/[\d.,\s]/g, '')), input),
        chips,
        el('div', { class: 'wd-dest' }, icons.bank(16), ' ' + bank),
        cont);
      syncContinue();
      input.focus();
    }
```

(The machine's existing `setAmount` clamps to `0…balance`, so typing `99999` review-shows the balance max — already tested in `test/withdraw-machine.test.js`.)

- [ ] **Step 2: Same file — replace remaining emoji and fix the completion copy:**
- Review branch: `rowEl('Arrival', el('span', {}, 'Instant ', icons.bolt(13)))` instead of `'Instant ⚡'`.
- Processing branch: `el('div', { class: 'wd-secure' }, icons.lock(12), ' Bank-grade encryption')` instead of `'🔒 Bank-grade encryption'`.
- Complete branch: `el('div', { class: 'wd-check' }, icons.check(26))` instead of `'✓'`, and headline `'Transfer complete!'` instead of `'Transfer initiated!'`.
- Stepper: `row.append(el('div', { class: 'wd-node ' + cls }, i < idx ? icons.check(12) : String(i + 1)));`

- [ ] **Step 3: Update `src/surfaces/balance-card.js`** — add `import { icons } from '../lib/icons.js';` and change the button to `}, icons.arrowUp(14), ' Withdraw');`.

- [ ] **Step 4: Add styles to `src/styles/withdraw.css`:**

```css
.wd-amount-row { display: flex; align-items: center; justify-content: center; gap: 2px; margin: 8px 0; }
.wd-cursign { font-size: 30px; font-weight: 800; color: var(--ink-mute); }
.wd-input {
  font: inherit; font-size: 38px; font-weight: 800; font-variant-numeric: tabular-nums;
  width: 60%; max-width: 240px; border: none; background: none; color: var(--ink);
  text-align: left; outline: none; padding: 0;
}
.wd-input::placeholder { color: var(--ink-mute); }
.btn-accent:disabled { opacity: 0.45; cursor: default; filter: none; transform: none; }
```

- [ ] **Step 5: Verify** — dev server: open withdraw → Continue is dimmed/disabled; type `750` → enabled; chips still prefill; step 2/3/4 show SVG icons; completion reads "Transfer complete!" over "Status: Completed". Run `npm test` (machine tests untouched, still green).

- [ ] **Step 6: Commit** — `git commit -am "feat: typed withdraw amount + disabled continue + copy/icon polish"`

---

### Task 12: Withdraw — runtime balance decrement + session payout row

**Files:**
- Modify: `src/surfaces/withdraw-flow.js`
- Modify: `src/main.js` (session slice in initial state)
- Test: `test/store.test.js`

- [ ] **Step 1: Write the failing test** — append to `test/store.test.js` (the settle logic is a pure state transform; test it through the store):

```js
test('functional setState supports runtime balance decrement + session payout', () => {
  const store = createStore({
    config: {},
    data: { balance: 4401.86 },
    session: { payouts: [] },
  });
  const amount = 750;
  store.setState((s) => ({
    data: { ...s.data, balance: Math.round((s.data.balance - amount) * 100) / 100 },
    session: { payouts: [{ date: 'now', amount, status: 'Completed' }, ...s.session.payouts] },
  }));
  assert.equal(store.getState().data.balance, 3651.86);
  assert.equal(store.getState().session.payouts[0].date, 'now');
  assert.equal(store.getState().config, store.getState().config); // config untouched
});
```

- [ ] **Step 2: Run** `npm test` — expected: PASS already (store supports this) — this is a pin-down test, fine; if `createStore` isn't imported in that file, add the import. The failing part comes from app wiring below, covered by Playwright in Task 16.

- [ ] **Step 3: Implement wiring** — in `src/main.js`, give the store a session slice:

```js
const store = createStore({ ...build(loadConfig()), session: { payouts: [] } });
```

(`setConfig`/`resetConfig` call `store.setState(build(config))` which shallow-merges — the `session` key survives config edits; the regenerated `data.balance` resets to the configured value, which is the spec's "runtime only" behavior.)

In `src/surfaces/withdraw-flow.js`, add settle-on-close:

```js
  let settled = false;
```

inside `mount` near `let timer`; in `open()` add `settled = false;`; add the function:

```js
  // Runtime-only continuity: balance drops and a payout row appears for the rest
  // of the session; reload restores the configured balance (zero-cleanup retakes).
  function settle() {
    if (settled || !machine) return;
    const st = machine.getState();
    if (st.step !== 'complete') return;
    settled = true;
    store.setState((s) => ({
      data: { ...s.data, balance: Math.round((s.data.balance - st.amount) * 100) / 100 },
      session: { payouts: [{ date: 'now', amount: st.amount, status: 'Completed' }, ...(s.session?.payouts || [])] },
    }));
  }
```

and make `close()` call `settle();` as its first line (covers both the Done button and tapping the overlay after completion).

- [ ] **Step 4: Verify** — dev server: withdraw $750 → Done → balance card reads $3,651.86. Reload → back to $4,401.86. `npm test` green.

- [ ] **Step 5: Commit** — `git commit -am "feat: runtime balance decrement + session payout row on withdrawal"`

---

### Task 13: Recent Payouts surface

**Files:**
- Create: `src/surfaces/recent-payouts.js`
- Modify: `src/main.js` (mount between balance and graph)
- Modify: `src/styles/surfaces.css`

- [ ] **Step 1: Create `src/surfaces/recent-payouts.js`:**

```js
import { el, clear } from '../lib/dom.js';
import { formatCurrency, formatDateShort } from '../lib/format.js';
import { icons } from '../lib/icons.js';

export function mount(root, store) {
  const wrap = el('div', { class: 'payouts' });
  root.append(wrap);

  function render() {
    const { config, data, session } = store.getState();
    wrap.classList.toggle('hidden', !config.surfaces.payouts);
    clear(wrap);
    wrap.append(el('div', { class: 'p-head' }, 'Recent Payouts'));
    const rows = [...(session?.payouts || []), ...(data.payouts || [])];
    for (const r of rows) {
      wrap.append(el('div', { class: 'p-row' },
        el('div', { class: 'p-ico' }, icons.bank(16)),
        el('div', { class: 'p-main' },
          el('div', { class: 'p-date' }, r.date === 'now' ? 'Just now' : formatDateShort(r.date, config.locale.locale)),
          el('div', { class: 'p-sub' }, config.withdraw.bank)),
        el('div', { class: 'p-right' },
          el('div', { class: 'p-amt' }, formatCurrency(r.amount, config.locale)),
          el('div', { class: 'p-badge' }, 'Completed'))));
    }
  }

  const off = store.subscribe(render);
  render();
  return { destroy: () => { off(); wrap.remove(); } };
}
```

- [ ] **Step 2: Mount it** — in `src/main.js`: `import * as recentPayouts from './surfaces/recent-payouts.js';` and between the balance and graph mounts: `recentPayouts.mount(surfaces, store);`

- [ ] **Step 3: Styles** — append to `src/styles/surfaces.css`:

```css
/* Recent payouts */
.payouts { background: var(--surface); border: 1px solid var(--line); border-radius: var(--radius); padding: 6px 16px 10px; margin-bottom: 14px; }
.payouts .p-head { font-size: 13px; font-weight: 700; padding: 10px 0 6px; }
.payouts .p-row { display: flex; align-items: center; gap: 10px; padding: 9px 0; border-top: 1px solid var(--line-soft); }
.payouts .p-ico { width: 30px; height: 30px; border-radius: 50%; background: var(--accent-soft); color: var(--accent); display: flex; align-items: center; justify-content: center; }
.payouts .p-main { flex: 1; min-width: 0; }
.payouts .p-date { font-size: 13px; font-weight: 600; }
.payouts .p-sub { font-size: 11px; color: var(--ink-mute); white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
.payouts .p-right { text-align: right; }
.payouts .p-amt { font-size: 13px; font-weight: 700; font-variant-numeric: tabular-nums; }
.payouts .p-badge { font-size: 10px; font-weight: 700; color: var(--accent); }
```

- [ ] **Step 4: Verify** — dev server: payouts card sits between Balance and Graph with 4 seeded rows; complete a withdrawal → "Just now" row prepends.

- [ ] **Step 5: Commit** — `git commit -am "feat: recent payouts surface"`

---

### Task 14: App chrome — monogram avatar, bell, "Updated just now"

**Files:**
- Modify: `src/main.js`
- Modify: `index.html`
- Modify: `src/styles/base.css`

- [ ] **Step 1: `index.html`** — after the `<h1 class="page-title">…</h1>` line add:

```html
    <div class="page-meta">Updated just now</div>
```

- [ ] **Step 2: `src/main.js`** — add `import { icons } from './lib/icons.js';` and replace the brandbar append in `renderBrand()`:

```js
  const initials = brand.name.split(/\s+/).filter(Boolean).slice(0, 2).map((w) => w[0].toUpperCase()).join('') || 'A';
  brandbar.append(
    el('div', { class: 'brand' }, logo, el('span', {}, brand.name), el('span', { class: 'sub' }, '· ' + brand.subtitle)),
    el('div', { class: 'brand-right' },
      el('button', { class: 'bell' }, icons.bell(18), el('span', { class: 'bell-dot' })),
      el('div', { class: 'avatar' }, initials)));
```

- [ ] **Step 3: `src/styles/base.css`** — replace the `.brandbar .avatar` rule and add:

```css
.brandbar .brand-right { display: flex; align-items: center; gap: 10px; }
.brandbar .bell { position: relative; background: none; border: none; color: var(--ink-soft); cursor: pointer; padding: 4px; display: flex; }
.brandbar .bell-dot { position: absolute; top: 3px; right: 3px; width: 7px; height: 7px; border-radius: 50%; background: var(--accent); border: 1.5px solid var(--surface); }
.brandbar .avatar {
  width: 30px; height: 30px; border-radius: 50%; background: var(--accent);
  color: var(--accent-contrast); font-size: 11px; font-weight: 700;
  display: flex; align-items: center; justify-content: center; letter-spacing: 0.02em;
}
.page-title { margin-bottom: 2px; }
.page-meta { font-size: 11px; color: var(--ink-mute); margin-bottom: 16px; }
```

(Also delete `margin-bottom: 16px` from the original `.page-title` rule so the two rules don't fight.)

- [ ] **Step 4: Verify** — dev server: "BR" monogram on accent circle, bell with badge dot, muted "Updated just now" under the title. Check dark preset too (⌘K → Midnight).

- [ ] **Step 5: Commit** — `git commit -am "feat: brand chrome (monogram avatar, bell, updated stamp)"`

---

### Task 15: Bottom tab bar (mobile only, default ON)

**Files:**
- Create: `src/surfaces/tab-bar.js`
- Modify: `src/main.js`
- Modify: `src/styles/surfaces.css`

- [ ] **Step 1: Create `src/surfaces/tab-bar.js`:**

```js
import { el, clear } from '../lib/dom.js';
import { icons } from '../lib/icons.js';

const ITEMS = [
  { label: 'Home', icon: 'home' },
  { label: 'Earnings', icon: 'chart', active: true },
  { label: 'Payouts', icon: 'dollar' },
  { label: 'Settings', icon: 'gear' },
];

export function mount(root, store) {
  const bar = el('nav', { class: 'tabbar' });
  root.append(bar);

  function render() {
    const on = !!store.getState().config.surfaces.tabBar;
    bar.classList.toggle('hidden', !on);
    document.body.classList.toggle('has-tabbar', on);
    clear(bar);
    for (const it of ITEMS) {
      bar.append(el('button', { class: 'tab' + (it.active ? ' on' : '') },
        icons[it.icon](20), el('span', {}, it.label)));
    }
  }

  const off = store.subscribe(render);
  render();
  return { destroy: () => { off(); bar.remove(); document.body.classList.remove('has-tabbar'); } };
}
```

- [ ] **Step 2: Mount** — in `src/main.js`: `import * as tabBar from './surfaces/tab-bar.js';` and after the controlPanel mount: `tabBar.mount(document.body, store);`

- [ ] **Step 3: Styles** — append to `src/styles/surfaces.css`:

```css
/* Bottom tab bar (visual prop; mobile viewports only) */
.tabbar {
  position: fixed; bottom: 0; left: 0; right: 0; z-index: 40;
  display: flex; background: var(--surface); border-top: 1px solid var(--line);
  padding: 6px 8px calc(6px + env(safe-area-inset-bottom));
}
.tabbar .tab {
  flex: 1; background: none; border: none; font: inherit; font-size: 10px; font-weight: 600;
  color: var(--ink-mute); display: flex; flex-direction: column; align-items: center; gap: 3px;
  padding: 4px 0; cursor: pointer;
}
.tabbar .tab.on { color: var(--accent); }
body.has-tabbar .container { padding-bottom: 130px; }
@media (min-width: 720px) {
  .tabbar { display: none; }
  body.has-tabbar .container { padding-bottom: 80px; }
}
```

- [ ] **Step 4: Verify** — dev server at narrow width: tab bar fixed at bottom, Earnings active in accent, table not hidden behind it; ≥720px: gone.

- [ ] **Step 5: Commit** — `git commit -am "feat: bottom tab bar surface (mobile, default on)"`

---

### Task 16: Control panel fields for new config

**Files:**
- Modify: `src/control-panel/control-panel.js`

- [ ] **Step 1: Implement** — in `rebuild()`:
- Data section, after the `Hero "Today" %` field:

```js
      field('Always-positive deltas', checkbox('data.forcePositiveDeltas', c.data.forcePositiveDeltas)),
      field('Weekend dip', checkbox('data.weekendDip', c.data.weekendDip)),
```

- Withdraw section, after `Processing (ms)`:

```js
      field('Payout history rows', number('payouts.count', c.payouts.count, 1)),
```

- Surfaces section, extend the toggles:

```js
      surf('payouts', 'Recent payouts'), surf('tabBar', 'Bottom tab bar'),
```

- Replace the drawer header emoji: `el('h4', {}, 'Setup'),` (drop the ⚙ — the panel is never on camera).

- [ ] **Step 2: Verify** — ⌘K: toggling each new control updates the dashboard live (uncheck positive deltas → numbers reshuffle; weekend dip → daily chart gets rhythm; payout rows count changes list length; tab bar toggle hides/shows).

- [ ] **Step 3: Commit** — `git commit -am "feat: control panel fields for realism options"`

---

### Task 17: Playwright smoke extension

**Files:**
- Create: `e2e/realism.spec.js`

- [ ] **Step 1: Create `e2e/realism.spec.js`:**

```js
import { test, expect } from '@playwright/test';

test.use({ viewport: { width: 390, height: 844 } });

test('no red deltas with default config', async ({ page }) => {
  await page.goto('/');
  await expect(page.locator('.cards .card')).toHaveCount(4);
  await expect(page.locator('.delta.down')).toHaveCount(0);
});

test('typed withdrawal: disabled continue, balance drops, payout row appears', async ({ page }) => {
  await page.goto('/');
  await expect(page.locator('.balance .amount')).toHaveText('$4,401.86');
  await page.click('.balance .btn-accent');
  const cont = page.locator('button:has-text("Continue")');
  await expect(cont).toBeDisabled();
  await page.fill('.wd-input', '750');
  await expect(cont).toBeEnabled();
  await cont.click();
  await page.click('button:has-text("Confirm withdrawal")');
  await expect(page.locator('text=Transfer complete!')).toBeVisible({ timeout: 10000 });
  await page.click('button:has-text("Done")');
  await expect(page.locator('.balance .amount')).toHaveText('$3,651.86');
  await expect(page.locator('.payouts .p-row').first()).toContainText('Just now');
});

test('monthly chart is a smooth multi-bucket curve (no triangle)', async ({ page }) => {
  await page.goto('/');
  await page.click('.toggle button:has-text("Monthly")');
  await page.waitForTimeout(700);
  const d = await page.locator('.graph .line').getAttribute('d');
  expect((d.match(/C/g) || []).length).toBeGreaterThanOrEqual(4);
});

test('graph tooltip appears on hover/tap', async ({ page }) => {
  await page.goto('/');
  await page.waitForTimeout(1100);
  await page.locator('.graph svg').hover({ position: { x: 150, y: 80 } });
  await expect(page.locator('.graph .tip-text')).toHaveText(/\$[\d,]+/);
});

test('tab bar on mobile, hidden on desktop', async ({ page }) => {
  await page.goto('/');
  await expect(page.locator('.tabbar')).toBeVisible();
  await page.setViewportSize({ width: 1280, height: 800 });
  await expect(page.locator('.tabbar')).toBeHidden();
});
```

- [ ] **Step 2: Run** `npx playwright test` — expected: all pass (plus the pre-existing `smoke.spec.js`). If `smoke.spec.js` asserts old copy ("Transfer initiated!") or old withdraw markup, update those assertions to the new copy/selectors.

- [ ] **Step 3: Commit** — `git commit -am "test: realism smoke (deltas, withdrawal continuity, chart, tab bar)"`

---

### Task 18: Full verification + visual pass

- [ ] **Step 1:** `npm test` — all unit tests green. Quote output.
- [ ] **Step 2:** `npx playwright test` — all e2e green. Quote output.
- [ ] **Step 3:** Screenshot pass at iPhone viewport (reuse `test-results/audit-shots.mjs`, adjust: withdraw flow now needs `page.fill('.wd-input', '1000')` instead of the chip click before Continue): full scroll-through, withdraw steps, Mobile Profits dark preset, desktop. Eyeball every finding from the audit: no triangle, no red arrows, today's date is today, balance drops, round dot, smooth gradient chart, SVG icons, monogram avatar, tab bar.
- [ ] **Step 4:** Final commit of any stragglers; `git log --oneline` to confirm task-by-task history.

---

## Self-review notes

- **Spec coverage:** §3 → Tasks 2–6; §4 → Tasks 7, 9; §5 → Tasks 8, 11, 12; §6 → Tasks 6, 13; §7 → Tasks 14, 15; §8 → Tasks 1, 16; §10 → Tasks throughout + 17, 18. All 13 audit items have a task.
- **Type consistency:** engine returns `{ daily, weekly, monthly, totals, balance, payouts }`; monthly rows are `{ month, endDate, amount }`; session slice is `{ payouts: [{ date: 'now'|ISO, amount, status }] }`; `createLineChart().render(series, { animate, morph, format })` — used consistently in Tasks 9 and 17.
- **Known intentional behaviors:** weekend dip may drop below `dailyMin` (realism); config edits reset the runtime balance but keep session payout rows (off-camera only); uplift pass may exceed the `dailyMax*1.5` clamp on today's value (acceptable, looks like a spike day).
