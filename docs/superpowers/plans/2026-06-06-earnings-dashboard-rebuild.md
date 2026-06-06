# Earnings Dashboard Rebuild — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Rebuild the single-file earnings-dashboard demo into an offer-agnostic, re-skinnable, mobile-first screen-recording prop with animated stat cards, an area+gradient earnings graph (D/W/M toggle), a 4-step withdraw flow, breakdown tables, and a live control panel — deployed static to Vercel.

**Architecture:** Buildless native ES modules + CSS custom-property theming. A tiny reactive `store` is the single source of truth (`{config, data}`); changing config regenerates data and re-renders affected surfaces, which is what makes the live control panel work. Pure logic (seeded data engine, config/persistence, state machines, chart math) is separated from DOM rendering so it can be unit-tested with Node's built-in test runner. No bundler, no framework, no build step.

**Tech Stack:** Vanilla JS (ES modules), CSS custom properties, hand-rolled SVG charts, `node --test` for unit tests, Playwright for one end-to-end smoke test, Vercel CLI for deploy.

**Reference spec:** `docs/superpowers/specs/2026-06-06-earnings-dashboard-redesign-design.md`

---

## File Structure

```
earnings-dashboard/
├── index.html                    # shell: root containers + <script type="module" src="src/main.js">
├── package.json                  # type:module, test script (node --test)
├── vercel.json                   # EXISTS — static config, auto-deploy off
├── .vercelignore                 # EXISTS
├── assets/                       # favicon, default logo placeholder
├── src/
│   ├── main.js                   # boot: load config → apply theme → generate data → mount surfaces → wire control panel
│   ├── store.js                  # reactive store (state + subscribe)
│   ├── lib/
│   │   ├── rng.js                # seeded RNG (mulberry32)
│   │   ├── dates.js              # UTC date helpers (isoDate, addDays, monthKey)
│   │   ├── format.js             # currency/percent/date formatting (Intl)
│   │   ├── dom.js                # el() + mount() helpers
│   │   └── animate.js            # easing fns + countUp + draw helpers
│   ├── config/
│   │   ├── schema.js             # defaultConfig + mergeConfig (deep merge)
│   │   ├── presets.js            # named theme presets
│   │   └── persistence.js        # load/save (localStorage) + export/import JSON
│   ├── data/
│   │   └── earnings-engine.js    # generateEarnings(config, now) → series + totals + balance
│   ├── theme/
│   │   └── apply-theme.js        # writes CSS custom properties from config
│   ├── charts/
│   │   ├── chart-math.js         # PURE: data → SVG path strings + scaled points
│   │   └── line-chart.js         # DOM: renders SVG, draw-in + morph animation, hover point
│   ├── surfaces/
│   │   ├── stat-cards.js         # animated count-up cards
│   │   ├── balance-card.js       # available balance + withdraw trigger
│   │   ├── earnings-graph.js     # chart + D/W/M toggle
│   │   ├── breakdown-tables.js   # daily/weekly detail tables
│   │   ├── withdraw-machine.js   # PURE: 4-step state machine
│   │   └── withdraw-flow.js      # DOM: modal/bottom-sheet rendering the machine
│   ├── control-panel/
│   │   └── control-panel.js      # hidden settings drawer
│   └── styles/
│       ├── tokens.css            # :root custom properties (theme-driven defaults)
│       ├── base.css              # reset + typography + layout container
│       ├── surfaces.css          # cards, balance, graph, tables
│       ├── withdraw.css          # modal / bottom-sheet + stepper
│       └── control-panel.css     # drawer
└── test/
    ├── rng.test.js · dates.test.js · format.test.js
    ├── earnings-engine.test.js
    ├── config-schema.test.js · persistence.test.js
    ├── store.test.js
    ├── chart-math.test.js
    ├── withdraw-machine.test.js
    └── apply-theme.test.js · animate.test.js · presets.test.js
└── e2e/
    └── smoke.spec.js            # Playwright (run separately; kept out of test/)
```

**Note on the existing `index.html`:** the current file is the old demo. Task 1 replaces it wholesale. The old earnings logic is superseded by `data/earnings-engine.js`.

---

## Phase 1 — Scaffold

### Task 1: Project scaffold + test runner

**Files:**
- Create: `package.json`
- Create: `test/scaffold.test.js`

- [ ] **Step 1: Write a failing smoke test for the test runner**

`test/scaffold.test.js`:
```js
import { test } from 'node:test';
import assert from 'node:assert/strict';

test('test runner works', () => {
  assert.equal(1 + 1, 2);
});
```

- [ ] **Step 2: Run it — expect failure (no package.json / not module)**

Run: `node --test`
Expected: fails or errors because there is no `package.json` with `"type": "module"` (import syntax error).

- [ ] **Step 3: Create package.json**

`package.json`:
```json
{
  "name": "earnings-dashboard",
  "version": "1.0.0",
  "private": true,
  "type": "module",
  "scripts": {
    "test": "node --test",
    "dev": "python3 -m http.server 8000"
  }
}
```

- [ ] **Step 4: Run tests — expect pass**

Run: `npm test`
Expected: `tests 1 ... pass 1`

- [ ] **Step 5: Commit**

```bash
git add package.json test/scaffold.test.js
git commit -m "chore: scaffold node --test runner"
```

---

## Phase 2 — Headless logic core (TDD)

### Task 2: Seeded RNG (`lib/rng.js`)

**Files:**
- Create: `src/lib/rng.js`
- Test: `test/rng.test.js`

- [ ] **Step 1: Write the failing test**

`test/rng.test.js`:
```js
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { makeRng } from '../src/lib/rng.js';

test('same seed produces identical sequence', () => {
  const a = makeRng(42), b = makeRng(42);
  const seqA = [a(), a(), a(), a()];
  const seqB = [b(), b(), b(), b()];
  assert.deepEqual(seqA, seqB);
});

test('different seeds diverge', () => {
  const a = makeRng(1), b = makeRng(2);
  assert.notEqual(a(), b());
});

test('values are in [0,1)', () => {
  const r = makeRng(7);
  for (let i = 0; i < 100; i++) {
    const v = r();
    assert.ok(v >= 0 && v < 1, `out of range: ${v}`);
  }
});
```

- [ ] **Step 2: Run — expect FAIL** (`makeRng` not found)

Run: `node --test test/rng.test.js`

- [ ] **Step 3: Implement**

`src/lib/rng.js`:
```js
// mulberry32 — small, fast, deterministic PRNG
export function makeRng(seed) {
  let a = (seed >>> 0) || 1;
  return function next() {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
```

- [ ] **Step 4: Run — expect PASS**

Run: `node --test test/rng.test.js`

- [ ] **Step 5: Commit**

```bash
git add src/lib/rng.js test/rng.test.js
git commit -m "feat: seeded RNG (mulberry32)"
```

---

### Task 3: Date helpers (`lib/dates.js`)

**Files:**
- Create: `src/lib/dates.js`
- Test: `test/dates.test.js`

- [ ] **Step 1: Write the failing test**

`test/dates.test.js`:
```js
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { isoDate, addDays, monthKey } from '../src/lib/dates.js';

test('isoDate formats a Date as YYYY-MM-DD (UTC)', () => {
  assert.equal(isoDate(new Date('2026-06-06T15:30:00Z')), '2026-06-06');
});

test('addDays subtracts/adds in UTC without TZ drift', () => {
  assert.equal(addDays('2026-06-06', -1), '2026-06-05');
  assert.equal(addDays('2026-03-01', -1), '2026-02-28');
  assert.equal(addDays('2026-06-06', 7), '2026-06-13');
});

test('monthKey returns YYYY-MM', () => {
  assert.equal(monthKey('2026-06-06'), '2026-06');
});
```

- [ ] **Step 2: Run — expect FAIL**

Run: `node --test test/dates.test.js`

- [ ] **Step 3: Implement**

`src/lib/dates.js`:
```js
export function isoDate(d) {
  return d.toISOString().slice(0, 10);
}

export function addDays(dateStr, n) {
  const d = new Date(dateStr + 'T00:00:00Z');
  d.setUTCDate(d.getUTCDate() + n);
  return isoDate(d);
}

export function monthKey(dateStr) {
  return dateStr.slice(0, 7);
}
```

- [ ] **Step 4: Run — expect PASS**

- [ ] **Step 5: Commit**

```bash
git add src/lib/dates.js test/dates.test.js
git commit -m "feat: UTC date helpers"
```

---

### Task 4: Formatting (`lib/format.js`)

**Files:**
- Create: `src/lib/format.js`
- Test: `test/format.test.js`

- [ ] **Step 1: Write the failing test**

`test/format.test.js`:
```js
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { formatCurrency, formatPercent, formatDateShort } from '../src/lib/format.js';

test('formatCurrency USD', () => {
  assert.equal(formatCurrency(1467, { currency: 'USD', locale: 'en-US' }), '$1,467.00');
});

test('formatCurrency GBP', () => {
  assert.equal(formatCurrency(4401.86, { currency: 'GBP', locale: 'en-GB' }), '£4,401.86');
});

test('formatPercent keeps one decimal and sign', () => {
  assert.equal(formatPercent(27.34), '27.3%');
  assert.equal(formatPercent(-3.1), '-3.1%');
});

test('formatDateShort renders weekday + month + day', () => {
  // 2026-06-04 is a Thursday
  assert.equal(formatDateShort('2026-06-04', 'en-US'), 'Thu, Jun 4');
});
```

- [ ] **Step 2: Run — expect FAIL**

- [ ] **Step 3: Implement**

`src/lib/format.js`:
```js
export function formatCurrency(amount, { currency = 'USD', locale = 'en-US' } = {}) {
  return new Intl.NumberFormat(locale, {
    style: 'currency',
    currency,
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(amount);
}

export function formatPercent(pct) {
  return `${(Math.round(pct * 10) / 10).toFixed(1)}%`;
}

export function formatDateShort(dateStr, locale = 'en-US') {
  const d = new Date(dateStr + 'T12:00:00Z');
  return new Intl.DateTimeFormat(locale, {
    weekday: 'short',
    month: 'short',
    day: 'numeric',
    timeZone: 'UTC',
  }).format(d);
}
```

- [ ] **Step 4: Run — expect PASS**

> Note: `Intl` currency output uses a non-breaking space for some locales/currencies; the chosen cases (USD/GBP symbol-prefixed) render as asserted in Node 22. If a future locale assertion fails on whitespace, normalize with `.replace(/ /g, ' ')` inside the test, not the impl.

- [ ] **Step 5: Commit**

```bash
git add src/lib/format.js test/format.test.js
git commit -m "feat: Intl-based formatting helpers"
```

---

### Task 5: Earnings engine (`data/earnings-engine.js`)

**Files:**
- Create: `src/data/earnings-engine.js`
- Test: `test/earnings-engine.test.js`

The engine is deterministic given `(config, now)`. `now` is an ISO date string injected for testability (the app passes today's date).

- [ ] **Step 1: Write the failing test**

`test/earnings-engine.test.js`:
```js
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { generateEarnings } from '../src/data/earnings-engine.js';

const config = {
  data: { dailyMin: 300, dailyMax: 1100, trend: 0.5, volatility: 0.2, windowDays: 60, seed: 42, balance: 4401.86 },
};
const NOW = '2026-06-06';

test('is deterministic for a given seed + now', () => {
  const a = generateEarnings(config, NOW);
  const b = generateEarnings(config, NOW);
  assert.deepEqual(a, b);
});

test('changing the seed changes the series', () => {
  const a = generateEarnings(config, NOW);
  const b = generateEarnings({ data: { ...config.data, seed: 99 } }, NOW);
  assert.notDeepEqual(a.daily, b.daily);
});

test('daily series has windowDays entries ending today', () => {
  const { daily } = generateEarnings(config, NOW);
  assert.equal(daily.length, 60);
  assert.equal(daily[daily.length - 1].date, '2026-06-06');
  assert.equal(daily[0].date, '2026-04-08'); // 59 days earlier
});

test('amounts stay within sane bounds', () => {
  const { daily } = generateEarnings(config, NOW);
  for (const d of daily) {
    assert.ok(d.amount >= 300 && d.amount <= 1100 * 1.5, `amount ${d.amount}`);
  }
});

test('totals: today equals last daily amount', () => {
  const { daily, totals } = generateEarnings(config, NOW);
  assert.equal(totals.today.amount, daily[daily.length - 1].amount);
});

test('totals: week equals sum of last 7 days', () => {
  const { daily, totals } = generateEarnings(config, NOW);
  const last7 = daily.slice(-7).reduce((s, d) => s + d.amount, 0);
  assert.equal(totals.week.amount, Math.round(last7 * 100) / 100);
});

test('hero today delta override is honored', () => {
  const cfg = { data: { ...config.data, todayDeltaOverride: 27.3 } };
  const { totals } = generateEarnings(cfg, NOW);
  assert.equal(totals.today.deltaPct, 27.3);
});

test('balance passes through from config', () => {
  const { balance } = generateEarnings(config, NOW);
  assert.equal(balance, 4401.86);
});

test('weekly and monthly aggregates exist', () => {
  const { weekly, monthly } = generateEarnings(config, NOW);
  assert.ok(weekly.length >= 4);
  assert.ok(monthly.length >= 2);
  assert.ok(weekly[0].startDate && weekly[0].endDate);
  assert.match(monthly[0].month, /^\d{4}-\d{2}$/);
});
```

- [ ] **Step 2: Run — expect FAIL**

- [ ] **Step 3: Implement**

`src/data/earnings-engine.js`:
```js
import { makeRng } from '../lib/rng.js';
import { addDays, monthKey } from '../lib/dates.js';

const round2 = (n) => Math.round(n * 100) / 100;
const sum = (arr) => arr.reduce((s, d) => s + d.amount, 0);

function generateDaily(config, now) {
  const { dailyMin, dailyMax, trend, volatility, windowDays, seed } = config.data;
  const rng = makeRng(seed);
  const days = [];
  for (let i = windowDays - 1; i >= 0; i--) {
    const date = addDays(now, -i);
    const progress = windowDays > 1 ? (windowDays - 1 - i) / (windowDays - 1) : 1; // 0 oldest → 1 newest
    const trendFactor = 1 + trend * (progress - 0.5);
    const base = dailyMin + rng() * (dailyMax - dailyMin);
    const noise = 1 + (rng() - 0.5) * 2 * volatility;
    let amount = base * trendFactor * noise;
    amount = Math.max(dailyMin, Math.min(dailyMax * 1.5, amount));
    days.push({ date, amount: round2(amount) });
  }
  return days;
}

function aggregateWeekly(daily) {
  const weeks = [];
  for (let end = daily.length; end - 7 >= 0; end -= 7) {
    const slice = daily.slice(end - 7, end);
    weeks.unshift({
      startDate: slice[0].date,
      endDate: slice[slice.length - 1].date,
      amount: round2(sum(slice)),
    });
  }
  return weeks;
}

function aggregateMonthly(daily) {
  const byMonth = new Map();
  for (const d of daily) {
    const k = monthKey(d.date);
    byMonth.set(k, (byMonth.get(k) || 0) + d.amount);
  }
  return [...byMonth.entries()].map(([month, amount]) => ({ month, amount: round2(amount) }));
}

function pctDelta(current, previous) {
  if (!previous) return null;
  return round2(((current - previous) / previous) * 100);
}

function computeTotals(daily, config) {
  const n = daily.length;
  const today = daily[n - 1].amount;
  const yesterday = n >= 2 ? daily[n - 2].amount : null;

  const last7 = sum(daily.slice(-7));
  const prev7 = n >= 14 ? sum(daily.slice(-14, -7)) : null;

  const last30 = sum(daily.slice(-30));
  const prev30 = n >= 60 ? sum(daily.slice(-60, -30)) : null;

  const override = config.data.todayDeltaOverride;
  return {
    today: { amount: round2(today), deltaPct: override != null ? override : pctDelta(today, yesterday) },
    week: { amount: round2(last7), deltaPct: pctDelta(last7, prev7) },
    month: { amount: round2(last30), deltaPct: pctDelta(last30, prev30) },
    total: { amount: round2(sum(daily)) },
  };
}

export function generateEarnings(config, now) {
  const daily = generateDaily(config, now);
  return {
    daily,
    weekly: aggregateWeekly(daily),
    monthly: aggregateMonthly(daily),
    totals: computeTotals(daily, config),
    balance: config.data.balance,
  };
}
```

- [ ] **Step 4: Run — expect PASS**

- [ ] **Step 5: Commit**

```bash
git add src/data/earnings-engine.js test/earnings-engine.test.js
git commit -m "feat: seeded earnings engine with totals/aggregates"
```

---

### Task 6: Config schema + deep merge (`config/schema.js`)

**Files:**
- Create: `src/config/schema.js`
- Test: `test/config-schema.test.js`

- [ ] **Step 1: Write the failing test**

`test/config-schema.test.js`:
```js
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { defaultConfig, mergeConfig } from '../src/config/schema.js';

test('defaultConfig has the expected groups', () => {
  for (const k of ['brand', 'theme', 'locale', 'data', 'surfaces', 'withdraw']) {
    assert.ok(defaultConfig[k], `missing ${k}`);
  }
});

test('mergeConfig deep-merges without mutating defaults', () => {
  const merged = mergeConfig(defaultConfig, { brand: { name: 'Acme' }, data: { seed: 7 } });
  assert.equal(merged.brand.name, 'Acme');
  assert.equal(merged.data.seed, 7);
  // other defaults preserved
  assert.equal(merged.theme.accent, defaultConfig.theme.accent);
  assert.equal(merged.data.dailyMin, defaultConfig.data.dailyMin);
  // original untouched
  assert.notEqual(defaultConfig.brand.name, 'Acme');
});

test('surfaces default all visible', () => {
  assert.equal(defaultConfig.surfaces.statCards, true);
  assert.equal(defaultConfig.surfaces.graph, true);
  assert.equal(defaultConfig.surfaces.balance, true);
  assert.equal(defaultConfig.surfaces.tables, true);
});
```

- [ ] **Step 2: Run — expect FAIL**

- [ ] **Step 3: Implement**

`src/config/schema.js`:
```js
export const defaultConfig = {
  brand: {
    name: 'Brandname',
    subtitle: 'Member Portal',
    logo: '', // data URL or http URL; empty → monogram dot
  },
  theme: {
    accent: '#16a34a',
    base: 'light', // 'light' | 'dark'
    font: "'Inter', system-ui, sans-serif",
    radius: 14, // px
  },
  locale: {
    currency: 'USD',
    locale: 'en-US',
  },
  data: {
    dailyMin: 300,
    dailyMax: 1100,
    trend: 0.5, // -1..1
    volatility: 0.2, // 0..1
    windowDays: 60,
    seed: 42,
    balance: 4401.86,
    todayDeltaOverride: 27.3, // null → derived
  },
  surfaces: {
    statCards: true,
    graph: true,
    balance: true,
    tables: true,
  },
  withdraw: {
    bank: 'Bank of America ••4471',
    presets: [500, 1000, 1500],
    processingMs: 2600,
  },
};

function isObject(v) {
  return v && typeof v === 'object' && !Array.isArray(v);
}

export function mergeConfig(base, patch) {
  const out = Array.isArray(base) ? [...base] : { ...base };
  for (const key of Object.keys(patch || {})) {
    if (isObject(base[key]) && isObject(patch[key])) {
      out[key] = mergeConfig(base[key], patch[key]);
    } else {
      out[key] = patch[key];
    }
  }
  return out;
}
```

- [ ] **Step 4: Run — expect PASS**

- [ ] **Step 5: Commit**

```bash
git add src/config/schema.js test/config-schema.test.js
git commit -m "feat: config schema + deep merge"
```

---

### Task 7: Presets (`config/presets.js`)

**Files:**
- Create: `src/config/presets.js`
- Test: `test/config-schema.test.js` (extend) — or new `test/presets.test.js`

- [ ] **Step 1: Write the failing test**

`test/presets.test.js`:
```js
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { presets, applyPreset } from '../src/config/presets.js';
import { defaultConfig } from '../src/config/schema.js';

test('presets are named partial configs', () => {
  assert.ok(presets.length >= 3);
  for (const p of presets) {
    assert.ok(p.id && p.label && p.patch);
  }
});

test('applyPreset merges a preset patch onto a config', () => {
  const green = presets.find((p) => p.id === 'crypto-green');
  const merged = applyPreset(defaultConfig, 'crypto-green');
  assert.equal(merged.theme.accent, green.patch.theme.accent);
});

test('applyPreset with unknown id returns config unchanged', () => {
  const merged = applyPreset(defaultConfig, 'nope');
  assert.deepEqual(merged, defaultConfig);
});
```

- [ ] **Step 2: Run — expect FAIL**

- [ ] **Step 3: Implement**

`src/config/presets.js`:
```js
import { mergeConfig } from './schema.js';

export const presets = [
  { id: 'violet', label: 'Violet', patch: { theme: { accent: '#7c3aed', base: 'light' } } },
  { id: 'crypto-green', label: 'Crypto Green', patch: { theme: { accent: '#16a34a', base: 'light' } } },
  { id: 'luxury-gold', label: 'Luxury Gold', patch: { theme: { accent: '#d4a017', base: 'light' } } },
  { id: 'midnight', label: 'Midnight', patch: { theme: { accent: '#3b82f6', base: 'dark' } } },
];

export function applyPreset(config, id) {
  const preset = presets.find((p) => p.id === id);
  if (!preset) return config;
  return mergeConfig(config, preset.patch);
}
```

- [ ] **Step 4: Run — expect PASS**

- [ ] **Step 5: Commit**

```bash
git add src/config/presets.js test/presets.test.js
git commit -m "feat: named theme presets"
```

---

### Task 8: Persistence + import/export (`config/persistence.js`)

**Files:**
- Create: `src/config/persistence.js`
- Test: `test/persistence.test.js`

Persistence accepts a `storage` object (defaults to `localStorage` in the browser) so it is testable in Node with a fake.

- [ ] **Step 1: Write the failing test**

`test/persistence.test.js`:
```js
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { loadConfig, saveConfig, exportConfig, importConfig } from '../src/config/persistence.js';
import { defaultConfig } from '../src/config/schema.js';

function fakeStorage() {
  const m = new Map();
  return {
    getItem: (k) => (m.has(k) ? m.get(k) : null),
    setItem: (k, v) => m.set(k, String(v)),
    removeItem: (k) => m.delete(k),
  };
}

test('loadConfig returns merged defaults when storage empty', () => {
  const cfg = loadConfig(fakeStorage());
  assert.equal(cfg.data.seed, defaultConfig.data.seed);
});

test('saveConfig then loadConfig round-trips', () => {
  const s = fakeStorage();
  saveConfig({ ...defaultConfig, brand: { ...defaultConfig.brand, name: 'Acme' } }, s);
  assert.equal(loadConfig(s).brand.name, 'Acme');
});

test('loadConfig merges a partial stored config onto defaults', () => {
  const s = fakeStorage();
  s.setItem('earnings_dashboard_config_v1', JSON.stringify({ data: { seed: 5 } }));
  const cfg = loadConfig(s);
  assert.equal(cfg.data.seed, 5);
  assert.equal(cfg.data.dailyMin, defaultConfig.data.dailyMin); // filled from defaults
});

test('exportConfig produces pretty JSON; importConfig parses + merges', () => {
  const json = exportConfig({ ...defaultConfig, data: { ...defaultConfig.data, seed: 9 } });
  assert.match(json, /\n/); // pretty-printed
  const cfg = importConfig(json);
  assert.equal(cfg.data.seed, 9);
});

test('importConfig on bad JSON throws a friendly error', () => {
  assert.throws(() => importConfig('{not json'), /Invalid config JSON/);
});
```

- [ ] **Step 2: Run — expect FAIL**

- [ ] **Step 3: Implement**

`src/config/persistence.js`:
```js
import { defaultConfig, mergeConfig } from './schema.js';

const KEY = 'earnings_dashboard_config_v1';

function resolveStorage(storage) {
  if (storage) return storage;
  if (typeof localStorage !== 'undefined') return localStorage;
  // no-op storage (SSR/tests without a fake)
  return { getItem: () => null, setItem: () => {}, removeItem: () => {} };
}

export function loadConfig(storage) {
  const s = resolveStorage(storage);
  const raw = s.getItem(KEY);
  if (!raw) return mergeConfig(defaultConfig, {});
  try {
    return mergeConfig(defaultConfig, JSON.parse(raw));
  } catch {
    return mergeConfig(defaultConfig, {});
  }
}

export function saveConfig(config, storage) {
  resolveStorage(storage).setItem(KEY, JSON.stringify(config));
}

export function exportConfig(config) {
  return JSON.stringify(config, null, 2);
}

export function importConfig(json) {
  let parsed;
  try {
    parsed = JSON.parse(json);
  } catch {
    throw new Error('Invalid config JSON');
  }
  return mergeConfig(defaultConfig, parsed);
}
```

- [ ] **Step 4: Run — expect PASS**

- [ ] **Step 5: Commit**

```bash
git add src/config/persistence.js test/persistence.test.js
git commit -m "feat: config persistence + JSON import/export"
```

---

### Task 9: Reactive store (`store.js`)

**Files:**
- Create: `src/store.js`
- Test: `test/store.test.js`

- [ ] **Step 1: Write the failing test**

`test/store.test.js`:
```js
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createStore } from '../src/store.js';

test('getState returns initial state', () => {
  const s = createStore({ count: 1 });
  assert.deepEqual(s.getState(), { count: 1 });
});

test('setState shallow-merges and notifies subscribers', () => {
  const s = createStore({ count: 1, name: 'a' });
  let seen = null;
  s.subscribe((state) => { seen = state; });
  s.setState({ count: 2 });
  assert.deepEqual(s.getState(), { count: 2, name: 'a' });
  assert.deepEqual(seen, { count: 2, name: 'a' });
});

test('setState accepts an updater function', () => {
  const s = createStore({ count: 1 });
  s.setState((prev) => ({ count: prev.count + 1 }));
  assert.equal(s.getState().count, 2);
});

test('unsubscribe stops notifications', () => {
  const s = createStore({ count: 0 });
  let calls = 0;
  const off = s.subscribe(() => { calls++; });
  s.setState({ count: 1 });
  off();
  s.setState({ count: 2 });
  assert.equal(calls, 1);
});
```

- [ ] **Step 2: Run — expect FAIL**

- [ ] **Step 3: Implement**

`src/store.js`:
```js
export function createStore(initial) {
  let state = initial;
  const listeners = new Set();
  return {
    getState() {
      return state;
    },
    setState(patch) {
      const next = typeof patch === 'function' ? patch(state) : patch;
      state = { ...state, ...next };
      for (const l of listeners) l(state);
    },
    subscribe(listener) {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
  };
}
```

- [ ] **Step 4: Run — expect PASS**

- [ ] **Step 5: Commit**

```bash
git add src/store.js test/store.test.js
git commit -m "feat: tiny reactive store"
```

---

### Task 10: Withdraw state machine (`surfaces/withdraw-machine.js`)

**Files:**
- Create: `src/surfaces/withdraw-machine.js`
- Test: `test/withdraw-machine.test.js`

Pure logic only — no DOM. The DOM surface (Task 19) renders from this.

- [ ] **Step 1: Write the failing test**

`test/withdraw-machine.test.js`:
```js
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createWithdrawMachine, STEPS } from '../src/surfaces/withdraw-machine.js';

const opts = { balance: 4401.86, presets: [500, 1000, 1500] };

test('starts on amount step with zero amount', () => {
  const m = createWithdrawMachine(opts);
  assert.equal(m.getState().step, 'amount');
  assert.equal(m.getState().amount, 0);
});

test('STEPS order is amount → review → processing → complete', () => {
  assert.deepEqual(STEPS, ['amount', 'review', 'processing', 'complete']);
});

test('setAmount clamps to [0, balance]', () => {
  const m = createWithdrawMachine(opts);
  m.setAmount(99999);
  assert.equal(m.getState().amount, 4401.86);
  m.setAmount(-5);
  assert.equal(m.getState().amount, 0);
});

test('selectPreset(max) sets amount to balance', () => {
  const m = createWithdrawMachine(opts);
  m.selectPreset('max');
  assert.equal(m.getState().amount, 4401.86);
});

test('next() is blocked from amount when amount is 0', () => {
  const m = createWithdrawMachine(opts);
  m.next();
  assert.equal(m.getState().step, 'amount');
});

test('happy path advances amount → review → processing → complete', () => {
  const m = createWithdrawMachine(opts);
  m.setAmount(1500);
  m.next();
  assert.equal(m.getState().step, 'review');
  m.next();
  assert.equal(m.getState().step, 'processing');
  m.next();
  assert.equal(m.getState().step, 'complete');
});

test('back() from review returns to amount, preserving amount', () => {
  const m = createWithdrawMachine(opts);
  m.setAmount(1000); m.next();
  m.back();
  assert.equal(m.getState().step, 'amount');
  assert.equal(m.getState().amount, 1000);
});

test('reset() returns to the initial state', () => {
  const m = createWithdrawMachine(opts);
  m.setAmount(1000); m.next(); m.next();
  m.reset();
  assert.equal(m.getState().step, 'amount');
  assert.equal(m.getState().amount, 0);
});

test('complete state exposes a reference id', () => {
  const m = createWithdrawMachine(opts);
  m.setAmount(1500); m.next(); m.next(); m.next();
  assert.match(m.getState().reference, /^[A-Z0-9-]{4,}$/);
});
```

- [ ] **Step 2: Run — expect FAIL**

- [ ] **Step 3: Implement**

`src/surfaces/withdraw-machine.js`:
```js
export const STEPS = ['amount', 'review', 'processing', 'complete'];

function makeReference(amount, balance) {
  // Deterministic-ish, no Math.random: derive from inputs so tests are stable.
  const n = Math.round((amount + balance) * 100) % 1000000;
  return 'PP-' + n.toString(36).toUpperCase().padStart(5, '0');
}

export function createWithdrawMachine({ balance, presets = [500, 1000, 1500] }) {
  let state = { step: 'amount', amount: 0, balance, presets, reference: null };

  function setStep(step) {
    state = { ...state, step };
    if (step === 'complete') state.reference = makeReference(state.amount, balance);
  }

  return {
    getState() {
      return state;
    },
    setAmount(n) {
      const amount = Math.max(0, Math.min(balance, Math.round(Number(n) * 100) / 100 || 0));
      state = { ...state, amount };
    },
    selectPreset(key) {
      if (key === 'max') this.setAmount(balance);
      else this.setAmount(Number(key));
    },
    next() {
      const i = STEPS.indexOf(state.step);
      if (state.step === 'amount' && state.amount <= 0) return; // guard
      if (i < STEPS.length - 1) setStep(STEPS[i + 1]);
    },
    back() {
      const i = STEPS.indexOf(state.step);
      if (i > 0) setStep(STEPS[i - 1]);
    },
    reset() {
      state = { step: 'amount', amount: 0, balance, presets, reference: null };
    },
  };
}
```

- [ ] **Step 4: Run — expect PASS**

- [ ] **Step 5: Commit**

```bash
git add src/surfaces/withdraw-machine.js test/withdraw-machine.test.js
git commit -m "feat: withdraw 4-step state machine"
```

---

### Task 11: Chart math (`charts/chart-math.js`)

**Files:**
- Create: `src/charts/chart-math.js`
- Test: `test/chart-math.test.js`

Pure: turns `[{amount}]` into SVG geometry. The DOM chart (Task 17) renders + animates from this.

- [ ] **Step 1: Write the failing test**

`test/chart-math.test.js`:
```js
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { buildChart } from '../src/charts/chart-math.js';

const box = { width: 300, height: 100, padding: 10 };

test('maps the max value to the top padding and min to the bottom', () => {
  const { points } = buildChart([{ amount: 10 }, { amount: 20 }, { amount: 30 }], box);
  assert.equal(points.length, 3);
  // highest amount → smallest y (top); within padding
  const ys = points.map((p) => p.y);
  assert.ok(Math.min(...ys) >= box.padding - 0.001);
  assert.ok(Math.max(...ys) <= box.height - box.padding + 0.001);
  // max value point is at the top
  const maxPoint = points[2];
  assert.ok(maxPoint.y <= points[0].y);
});

test('x spans from left padding to width - padding', () => {
  const { points } = buildChart([{ amount: 1 }, { amount: 2 }], box);
  assert.equal(points[0].x, box.padding);
  assert.equal(points[points.length - 1].x, box.width - box.padding);
});

test('produces line and area path strings', () => {
  const { linePath, areaPath } = buildChart([{ amount: 1 }, { amount: 2 }, { amount: 3 }], box);
  assert.match(linePath, /^M/);
  assert.match(areaPath, /Z$/); // area closes
});

test('flat series does not divide by zero', () => {
  const { points } = buildChart([{ amount: 5 }, { amount: 5 }], box);
  assert.ok(points.every((p) => Number.isFinite(p.y)));
});
```

- [ ] **Step 2: Run — expect FAIL**

- [ ] **Step 3: Implement**

`src/charts/chart-math.js`:
```js
// Builds SVG geometry for an area/line chart from a series of {amount}.
export function buildChart(series, { width, height, padding = 8 }) {
  const values = series.map((d) => d.amount);
  const min = Math.min(...values);
  const max = Math.max(...values);
  const span = max - min || 1;
  const innerW = width - padding * 2;
  const innerH = height - padding * 2;
  const step = series.length > 1 ? innerW / (series.length - 1) : 0;

  const points = series.map((d, i) => ({
    x: padding + step * i,
    y: padding + innerH * (1 - (d.amount - min) / span),
    amount: d.amount,
    index: i,
  }));

  const linePath = points
    .map((p, i) => `${i === 0 ? 'M' : 'L'}${round(p.x)},${round(p.y)}`)
    .join(' ');

  const areaPath =
    `${linePath} L${round(points[points.length - 1].x)},${round(height - padding)} ` +
    `L${round(points[0].x)},${round(height - padding)} Z`;

  return { points, linePath, areaPath, min, max };
}

function round(n) {
  return Math.round(n * 100) / 100;
}
```

- [ ] **Step 4: Run — expect PASS**

- [ ] **Step 5: Commit**

```bash
git add src/charts/chart-math.js test/chart-math.test.js
git commit -m "feat: pure chart geometry"
```

---

## Phase 3 — Theming, DOM & animation helpers

### Task 12: Apply theme (`theme/apply-theme.js`)

**Files:**
- Create: `src/theme/apply-theme.js`
- Test: `test/apply-theme.test.js`

`applyTheme` writes CSS custom properties onto a target (default `document.documentElement`). Tested with a fake target that records `setProperty`/`setAttribute`.

- [ ] **Step 1: Write the failing test**

`test/apply-theme.test.js`:
```js
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { applyTheme } from '../src/theme/apply-theme.js';
import { defaultConfig } from '../src/config/schema.js';

function fakeTarget() {
  const props = {}, attrs = {};
  return {
    props, attrs,
    style: { setProperty: (k, v) => { props[k] = v; } },
    setAttribute: (k, v) => { attrs[k] = v; },
  };
}

test('writes accent, font and radius custom properties', () => {
  const t = fakeTarget();
  applyTheme(defaultConfig, t);
  assert.equal(t.props['--accent'], defaultConfig.theme.accent);
  assert.equal(t.props['--font'], defaultConfig.theme.font);
  assert.equal(t.props['--radius'], defaultConfig.theme.radius + 'px');
});

test('sets data-base attribute for light/dark', () => {
  const t = fakeTarget();
  applyTheme({ ...defaultConfig, theme: { ...defaultConfig.theme, base: 'dark' } }, t);
  assert.equal(t.attrs['data-base'], 'dark');
});

test('derives a soft accent tint custom property', () => {
  const t = fakeTarget();
  applyTheme(defaultConfig, t);
  assert.ok(t.props['--accent-soft']);
});
```

- [ ] **Step 2: Run — expect FAIL**

- [ ] **Step 3: Implement**

`src/theme/apply-theme.js`:
```js
// Expands #rrggbb into an rgba() string at a given alpha.
function tint(hex, alpha) {
  const h = hex.replace('#', '');
  const n = parseInt(h.length === 3 ? h.split('').map((c) => c + c).join('') : h, 16);
  const r = (n >> 16) & 255, g = (n >> 8) & 255, b = n & 255;
  return `rgba(${r}, ${g}, ${b}, ${alpha})`;
}

export function applyTheme(config, target = document.documentElement) {
  const { accent, font, radius, base } = config.theme;
  target.style.setProperty('--accent', accent);
  target.style.setProperty('--accent-soft', tint(accent, 0.12));
  target.style.setProperty('--accent-contrast', '#ffffff');
  target.style.setProperty('--font', font);
  target.style.setProperty('--radius', radius + 'px');
  target.setAttribute('data-base', base);
}
```

- [ ] **Step 4: Run — expect PASS**

- [ ] **Step 5: Commit**

```bash
git add src/theme/apply-theme.js test/apply-theme.test.js
git commit -m "feat: apply-theme writes CSS custom properties"
```

---

### Task 13: Animation helpers (`lib/animate.js`)

**Files:**
- Create: `src/lib/animate.js`
- Test: `test/animate.test.js`

Easing math is pure and tested. `countUp`/`draw` are thin DOM wrappers (covered by the Playwright smoke test) and honor `prefers-reduced-motion`.

- [ ] **Step 1: Write the failing test**

`test/animate.test.js`:
```js
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { lerp, easeOutExpo } from '../src/lib/animate.js';

test('lerp interpolates endpoints', () => {
  assert.equal(lerp(0, 10, 0), 0);
  assert.equal(lerp(0, 10, 1), 10);
  assert.equal(lerp(0, 10, 0.5), 5);
});

test('easeOutExpo is 0 at 0 and 1 at 1 and monotonic', () => {
  assert.equal(easeOutExpo(0), 0);
  assert.equal(easeOutExpo(1), 1);
  assert.ok(easeOutExpo(0.4) < easeOutExpo(0.6));
});
```

- [ ] **Step 2: Run — expect FAIL**

- [ ] **Step 3: Implement**

`src/lib/animate.js`:
```js
export const lerp = (a, b, t) => a + (b - a) * t;

export function easeOutExpo(t) {
  return t === 1 ? 1 : 1 - Math.pow(2, -10 * t);
}

function prefersReduced() {
  return typeof matchMedia !== 'undefined' && matchMedia('(prefers-reduced-motion: reduce)').matches;
}

// Animate an element's text from 0 → value, formatting each frame.
export function countUp(el, to, { duration = 900, format = (n) => String(Math.round(n)) } = {}) {
  if (prefersReduced()) { el.textContent = format(to); return; }
  const start = performance.now();
  function frame(now) {
    const t = Math.min(1, (now - start) / duration);
    el.textContent = format(lerp(0, to, easeOutExpo(t)));
    if (t < 1) requestAnimationFrame(frame);
  }
  requestAnimationFrame(frame);
}

// Draw an SVG path in left→right via stroke-dashoffset.
export function drawPath(pathEl, { duration = 1000 } = {}) {
  const len = pathEl.getTotalLength();
  pathEl.style.strokeDasharray = String(len);
  if (prefersReduced()) { pathEl.style.strokeDashoffset = '0'; return; }
  pathEl.style.strokeDashoffset = String(len);
  const start = performance.now();
  function frame(now) {
    const t = Math.min(1, (now - start) / duration);
    pathEl.style.strokeDashoffset = String(len * (1 - easeOutExpo(t)));
    if (t < 1) requestAnimationFrame(frame);
  }
  requestAnimationFrame(frame);
}
```

- [ ] **Step 4: Run — expect PASS**

- [ ] **Step 5: Commit**

```bash
git add src/lib/animate.js test/animate.test.js
git commit -m "feat: easing + count-up + path-draw helpers"
```

---

### Task 14: DOM helper (`lib/dom.js`)

**Files:**
- Create: `src/lib/dom.js`

DOM-dependent; no unit test (no DOM in Node). Exercised by every surface and the Playwright smoke test.

- [ ] **Step 1: Implement**

`src/lib/dom.js`:
```js
const SVG_NS = 'http://www.w3.org/2000/svg';
const SVG_TAGS = new Set(['svg', 'path', 'g', 'circle', 'line', 'rect', 'defs', 'linearGradient', 'stop', 'text']);

export function el(tag, props = {}, ...children) {
  const node = SVG_TAGS.has(tag)
    ? document.createElementNS(SVG_NS, tag)
    : document.createElement(tag);
  for (const [k, v] of Object.entries(props)) {
    if (v == null) continue;
    if (k === 'class') node.setAttribute('class', v);
    else if (k === 'html') node.innerHTML = v;
    else if (k === 'style' && typeof v === 'object') Object.assign(node.style, v);
    else if (k.startsWith('on') && typeof v === 'function') node.addEventListener(k.slice(2).toLowerCase(), v);
    else node.setAttribute(k, v);
  }
  for (const c of children.flat()) {
    if (c == null || c === false) continue;
    node.append(c.nodeType ? c : document.createTextNode(String(c)));
  }
  return node;
}

export const clear = (node) => node.replaceChildren();
```

- [ ] **Step 2: Commit**

```bash
git add src/lib/dom.js
git commit -m "feat: el() DOM/SVG helper"
```

---

## Phase 4 — Styles

> CSS is verified visually (Phase 8 + manual). Each task creates one focused stylesheet. All colors/spacing derive from custom properties set by `apply-theme.js`, so re-skinning never touches CSS.

### Task 15: Token + base styles

**Files:**
- Create: `src/styles/tokens.css`
- Create: `src/styles/base.css`

- [ ] **Step 1: Create `src/styles/tokens.css`**

```css
:root {
  --accent: #16a34a;
  --accent-soft: rgba(22, 163, 74, 0.12);
  --accent-contrast: #ffffff;
  --font: 'Inter', system-ui, sans-serif;
  --radius: 14px;

  --bg: #f6f7f5;
  --surface: #ffffff;
  --ink: #16201a;
  --ink-soft: #52605a;
  --ink-mute: #9aa39b;
  --line: #e4e8e3;
  --line-soft: #f0f3f0;
}

:root[data-base='dark'] {
  --bg: #0f1311;
  --surface: #171c19;
  --ink: #f3f6f4;
  --ink-soft: #b3beb8;
  --ink-mute: #76837b;
  --line: #283029;
  --line-soft: #1d231f;
}
```

- [ ] **Step 2: Create `src/styles/base.css`**

```css
* { margin: 0; padding: 0; box-sizing: border-box; }

body {
  font-family: var(--font);
  background: var(--bg);
  color: var(--ink);
  -webkit-font-smoothing: antialiased;
  min-height: 100vh;
}

.container {
  max-width: 520px;
  margin: 0 auto;
  padding: 20px 16px 64px;
}

/* Desktop: wider canvas, cards spread out */
@media (min-width: 720px) {
  .container { max-width: 880px; padding: 40px 24px 80px; }
}

.brandbar {
  display: flex; align-items: center; justify-content: space-between;
  padding-bottom: 14px; margin-bottom: 18px; border-bottom: 1px solid var(--line);
}
.brandbar .brand { display: flex; align-items: center; gap: 9px; font-weight: 700; font-size: 15px; }
.brandbar .brand .logo { width: 26px; height: 26px; border-radius: 8px; background: var(--accent); object-fit: cover; }
.brandbar .brand .sub { font-weight: 500; font-size: 12px; color: var(--ink-mute); }
.brandbar .avatar { width: 30px; height: 30px; border-radius: 50%; background: var(--line); }

.page-title { font-size: 22px; font-weight: 800; letter-spacing: -0.01em; margin-bottom: 16px; }
@media (min-width: 720px) { .page-title { font-size: 28px; } }

.hidden { display: none !important; }
```

- [ ] **Step 3: Commit**

```bash
git add src/styles/tokens.css src/styles/base.css
git commit -m "style: tokens + base layout"
```

---

### Task 16: Surface styles

**Files:**
- Create: `src/styles/surfaces.css`

- [ ] **Step 1: Create `src/styles/surfaces.css`**

```css
/* Stat cards */
.cards { display: grid; grid-template-columns: 1fr 1fr; gap: 10px; margin-bottom: 14px; }
@media (min-width: 720px) { .cards { grid-template-columns: repeat(4, 1fr); } }
.cards .hero { grid-column: 1 / -1; }
@media (min-width: 720px) { .cards .hero { grid-column: auto; } }

.card {
  background: var(--surface); border: 1px solid var(--line);
  border-radius: var(--radius); padding: 16px;
}
.card.hero { background: var(--accent); border-color: var(--accent); color: var(--accent-contrast); }
.card .label { font-size: 10px; text-transform: uppercase; letter-spacing: 0.06em; opacity: 0.72; font-weight: 600; }
.card .amount { font-size: 26px; font-weight: 800; margin-top: 4px; font-variant-numeric: tabular-nums; }
.card.hero .amount { font-size: 32px; }
.card .delta { font-size: 11px; opacity: 0.8; margin-top: 4px; }
.card .delta.down { color: #dc2626; }

/* Balance + withdraw */
.balance {
  display: flex; align-items: center; justify-content: space-between;
  background: var(--surface); border: 1px solid var(--line);
  border-radius: var(--radius); padding: 16px 18px; margin-bottom: 14px;
}
.balance .label { font-size: 10px; text-transform: uppercase; letter-spacing: 0.06em; color: var(--ink-mute); font-weight: 600; }
.balance .amount { font-size: 22px; font-weight: 800; margin-top: 2px; font-variant-numeric: tabular-nums; }
.balance .sub { font-size: 11px; color: var(--ink-mute); margin-top: 2px; }
.btn-accent {
  background: var(--accent); color: var(--accent-contrast); border: none;
  font: inherit; font-weight: 700; font-size: 14px; padding: 11px 18px;
  border-radius: 10px; cursor: pointer; transition: transform 0.05s, filter 0.15s;
}
.btn-accent:hover { filter: brightness(1.05); }
.btn-accent:active { transform: translateY(1px); }

/* Graph */
.graph { background: var(--surface); border: 1px solid var(--line); border-radius: var(--radius); padding: 16px; margin-bottom: 14px; }
.graph .top { display: flex; align-items: center; justify-content: space-between; margin-bottom: 12px; }
.graph .title { font-size: 13px; font-weight: 700; }
.toggle { display: flex; gap: 4px; }
.toggle button {
  font: inherit; font-size: 11px; font-weight: 600; padding: 5px 11px; border-radius: 999px;
  border: none; background: var(--line-soft); color: var(--ink-soft); cursor: pointer;
}
.toggle button.on { background: var(--accent); color: var(--accent-contrast); }
.graph svg { width: 100%; height: 160px; display: block; }
.graph .area { fill: var(--accent); opacity: 0.12; }
.graph .line { fill: none; stroke: var(--accent); stroke-width: 2.5; stroke-linecap: round; stroke-linejoin: round; }
.graph .dot { fill: var(--accent); stroke: var(--surface); stroke-width: 2; }
.graph .tip { fill: var(--ink); }
.graph .tip-text { fill: var(--surface); font-size: 10px; font-weight: 600; }

/* Breakdown tables */
.tables { background: var(--surface); border: 1px solid var(--line); border-radius: var(--radius); overflow: hidden; }
.tables .thead, .tables .row { display: grid; grid-template-columns: 1.4fr 1fr 1fr; gap: 8px; padding: 11px 16px; align-items: center; }
.tables .thead { background: var(--line-soft); font-size: 10px; text-transform: uppercase; letter-spacing: 0.05em; color: var(--ink-soft); font-weight: 700; }
.tables .row { border-top: 1px solid var(--line-soft); font-size: 13px; }
.tables .row .amt { text-align: right; font-weight: 700; font-variant-numeric: tabular-nums; }
.tables .bar-wrap { display: flex; justify-content: flex-end; }
.tables .bar { height: 7px; border-radius: 999px; background: var(--accent); }
.tables .row.total { font-weight: 800; background: var(--line-soft); }
```

- [ ] **Step 2: Commit**

```bash
git add src/styles/surfaces.css
git commit -m "style: surface styles (cards, balance, graph, tables)"
```

---

## Phase 5 — Surfaces (DOM)

> **Surface contract:** each surface exports `mount(root, store)` which builds its DOM, appends to `root`, subscribes to the store, renders from `store.getState()` (shape `{ config, data }`), and returns `{ destroy }`. Visibility is controlled by `config.surfaces.*`.

### Task 17: Line chart DOM (`charts/line-chart.js`)

**Files:**
- Create: `src/charts/line-chart.js`

- [ ] **Step 1: Implement**

`src/charts/line-chart.js`:
```js
import { el } from '../lib/dom.js';
import { buildChart } from './chart-math.js';
import { drawPath } from '../lib/animate.js';

const W = 600, H = 160, PAD = 12;

export function createLineChart() {
  const area = el('path', { class: 'area' });
  const line = el('path', { class: 'line' });
  const dot = el('circle', { class: 'dot', r: 4, style: { opacity: 0 } });
  const svg = el('svg', { viewBox: `0 0 ${W} ${H}`, preserveAspectRatio: 'none' }, area, line, dot);

  function render(series, { animate = true } = {}) {
    if (!series.length) return;
    const { linePath, areaPath, points } = buildChart(series, { width: W, height: H, padding: PAD });
    area.setAttribute('d', areaPath);
    line.setAttribute('d', linePath);
    const last = points[points.length - 1];
    dot.setAttribute('cx', last.x);
    dot.setAttribute('cy', last.y);
    dot.style.opacity = '1';
    if (animate) drawPath(line, { duration: 900 });
  }

  return { svg, render };
}
```

- [ ] **Step 2: Commit**

```bash
git add src/charts/line-chart.js
git commit -m "feat: SVG line chart with draw-in"
```

---

### Task 18: Stat cards (`surfaces/stat-cards.js`)

**Files:**
- Create: `src/surfaces/stat-cards.js`

- [ ] **Step 1: Implement**

`src/surfaces/stat-cards.js`:
```js
import { el, clear } from '../lib/dom.js';
import { formatCurrency, formatPercent } from '../lib/format.js';
import { countUp } from '../lib/animate.js';

const CARDS = [
  { key: 'today', label: "Today's Earnings", hero: true },
  { key: 'week', label: 'This Week' },
  { key: 'month', label: 'This Month' },
  { key: 'total', label: 'Total' },
];

export function mount(root, store) {
  const wrap = el('div', { class: 'cards' });
  root.append(wrap);

  function render() {
    const { config, data } = store.getState();
    wrap.classList.toggle('hidden', !config.surfaces.statCards);
    clear(wrap);
    for (const def of CARDS) {
      const t = data.totals[def.key];
      const amountEl = el('div', { class: 'amount' }, formatCurrency(t.amount, config.locale));
      const delta = t.deltaPct != null
        ? el('div', { class: 'delta' + (t.deltaPct < 0 ? ' down' : '') },
            `${t.deltaPct < 0 ? '▼' : '▲'} ${formatPercent(Math.abs(t.deltaPct))} vs prior`)
        : el('div', { class: 'delta' }, def.key === 'total' ? 'all-time' : '');
      wrap.append(el('div', { class: 'card' + (def.hero ? ' hero' : '') },
        el('div', { class: 'label' }, def.label), amountEl, delta));
      countUp(amountEl, t.amount, { duration: 900, format: (n) => formatCurrency(n, config.locale) });
    }
  }

  const off = store.subscribe(render);
  render();
  return { destroy: () => { off(); wrap.remove(); } };
}
```

- [ ] **Step 2: Commit**

```bash
git add src/surfaces/stat-cards.js
git commit -m "feat: animated stat cards"
```

---

### Task 19: Balance card (`surfaces/balance-card.js`)

**Files:**
- Create: `src/surfaces/balance-card.js`

Emits a `withdraw:open` custom event on the document; the withdraw flow (Task 21) listens.

- [ ] **Step 1: Implement**

`src/surfaces/balance-card.js`:
```js
import { el } from '../lib/dom.js';
import { formatCurrency } from '../lib/format.js';

export function mount(root, store) {
  const amountEl = el('div', { class: 'amount' });
  const btn = el('button', {
    class: 'btn-accent',
    onClick: () => document.dispatchEvent(new CustomEvent('withdraw:open')),
  }, '↑ Withdraw');

  const card = el('div', { class: 'balance' },
    el('div', {},
      el('div', { class: 'label' }, 'Available Balance'),
      amountEl,
      el('div', { class: 'sub' }, 'Cleared & ready to withdraw')),
    btn);
  root.append(card);

  function render() {
    const { config, data } = store.getState();
    card.classList.toggle('hidden', !config.surfaces.balance);
    amountEl.textContent = formatCurrency(data.balance, config.locale);
  }

  const off = store.subscribe(render);
  render();
  return { destroy: () => { off(); card.remove(); } };
}
```

- [ ] **Step 2: Commit**

```bash
git add src/surfaces/balance-card.js
git commit -m "feat: available balance card + withdraw trigger"
```

---

### Task 20: Earnings graph (`surfaces/earnings-graph.js`)

**Files:**
- Create: `src/surfaces/earnings-graph.js`

- [ ] **Step 1: Implement**

`src/surfaces/earnings-graph.js`:
```js
import { el, clear } from '../lib/dom.js';
import { createLineChart } from '../charts/line-chart.js';

const PERIODS = [
  { key: 'daily', label: 'Daily', title: 'Daily Earnings — Last 30 Days' },
  { key: 'weekly', label: 'Weekly', title: 'Weekly Earnings' },
  { key: 'monthly', label: 'Monthly', title: 'Monthly Earnings' },
];

function seriesFor(period, data) {
  if (period === 'weekly') return data.weekly.map((w) => ({ amount: w.amount }));
  if (period === 'monthly') return data.monthly.map((m) => ({ amount: m.amount }));
  return data.daily.slice(-30).map((d) => ({ amount: d.amount }));
}

export function mount(root, store) {
  let active = 'daily';
  const chart = createLineChart();
  const titleEl = el('div', { class: 'title' });
  const toggle = el('div', { class: 'toggle' });
  const card = el('div', { class: 'graph' },
    el('div', { class: 'top' }, titleEl, toggle), chart.svg);
  root.append(card);

  function renderToggle() {
    clear(toggle);
    for (const p of PERIODS) {
      toggle.append(el('button', {
        class: p.key === active ? 'on' : '',
        onClick: () => { active = p.key; render(true); },
      }, p.label));
    }
  }

  function render(animate = true) {
    const { config, data } = store.getState();
    card.classList.toggle('hidden', !config.surfaces.graph);
    titleEl.textContent = PERIODS.find((p) => p.key === active).title;
    renderToggle();
    chart.render(seriesFor(active, data), { animate });
  }

  const off = store.subscribe(() => render(false));
  render(true);
  return { destroy: () => { off(); card.remove(); } };
}
```

- [ ] **Step 2: Commit**

```bash
git add src/surfaces/earnings-graph.js
git commit -m "feat: earnings graph with D/W/M toggle"
```

---

### Task 21: Breakdown tables (`surfaces/breakdown-tables.js`)

**Files:**
- Create: `src/surfaces/breakdown-tables.js`

- [ ] **Step 1: Implement**

`src/surfaces/breakdown-tables.js`:
```js
import { el, clear } from '../lib/dom.js';
import { formatCurrency, formatDateShort } from '../lib/format.js';

export function mount(root, store) {
  const wrap = el('div', { class: 'tables' });
  root.append(wrap);

  function render() {
    const { config, data } = store.getState();
    wrap.classList.toggle('hidden', !config.surfaces.tables);
    clear(wrap);
    wrap.append(el('div', { class: 'thead' },
      el('div', {}, 'Date'), el('div', { class: 'amt' }, 'Gross'), el('div', {}, 'Trend')));

    const rows = data.daily.slice(-7).reverse();
    const max = Math.max(...rows.map((r) => r.amount));
    let total = 0;
    for (const r of rows) {
      total += r.amount;
      const pct = Math.round((r.amount / max) * 100);
      wrap.append(el('div', { class: 'row' },
        el('div', {}, formatDateShort(r.date, config.locale.locale)),
        el('div', { class: 'amt' }, formatCurrency(r.amount, config.locale)),
        el('div', { class: 'bar-wrap' }, el('div', { class: 'bar', style: { width: pct + '%' } }))));
    }
    wrap.append(el('div', { class: 'row total' },
      el('div', {}, '7-Day Total'),
      el('div', { class: 'amt' }, formatCurrency(Math.round(total * 100) / 100, config.locale)),
      el('div', {})));
  }

  const off = store.subscribe(render);
  render();
  return { destroy: () => { off(); wrap.remove(); } };
}
```

- [ ] **Step 2: Commit**

```bash
git add src/surfaces/breakdown-tables.js
git commit -m "feat: daily breakdown table"
```

---

### Task 22: Withdraw flow DOM (`surfaces/withdraw-flow.js` + `styles/withdraw.css`)

**Files:**
- Create: `src/surfaces/withdraw-flow.js`
- Create: `src/styles/withdraw.css`

Listens for the `withdraw:open` event (dispatched by the balance card), drives `withdraw-machine`, renders a modal (desktop) / bottom-sheet (mobile). Reads `config.withdraw` (bank label, presets, processing duration — added to the schema in Task 6).

- [ ] **Step 1: Implement `src/surfaces/withdraw-flow.js`**

```js
import { el, clear } from '../lib/dom.js';
import { formatCurrency } from '../lib/format.js';
import { createWithdrawMachine, STEPS } from './withdraw-machine.js';

export function mount(root, store) {
  const sheet = el('div', { class: 'wd-sheet' });
  const overlay = el('div', { class: 'wd-overlay hidden' }, sheet);
  root.append(overlay);
  let machine = null;
  let timer = null;

  function close() {
    overlay.classList.add('hidden');
    if (timer) { clearTimeout(timer); timer = null; }
  }
  function open() {
    const { config, data } = store.getState();
    machine = createWithdrawMachine({ balance: data.balance, presets: config.withdraw.presets });
    overlay.classList.remove('hidden');
    render();
  }

  overlay.addEventListener('click', (e) => { if (e.target === overlay) close(); });
  document.addEventListener('withdraw:open', open);

  function stepper(current) {
    const idx = STEPS.indexOf(current);
    const row = el('div', { class: 'wd-stepper' });
    STEPS.forEach((s, i) => {
      const cls = i < idx ? 'done' : i === idx ? 'active' : 'todo';
      row.append(el('div', { class: 'wd-node ' + cls }, i < idx ? '✓' : String(i + 1)));
      if (i < STEPS.length - 1) row.append(el('div', { class: 'wd-seg' + (i < idx ? ' done' : '') }));
    });
    return row;
  }

  const rowEl = (k, v) => el('div', { class: 'wd-row' }, el('span', { class: 'k' }, k), el('span', { class: 'v' }, v));

  function render() {
    const { config } = store.getState();
    const cur = config.locale;
    const { bank, processingMs } = config.withdraw;
    const st = machine.getState();
    clear(sheet);
    sheet.append(stepper(st.step));

    if (st.step === 'amount') {
      const chips = el('div', { class: 'wd-chips' },
        ...[...st.presets.map(String), 'max'].map((k) =>
          el('button', { class: 'wd-chip', onClick: () => { machine.selectPreset(k); render(); } },
            k === 'max' ? 'Max' : formatCurrency(Number(k), cur))));
      sheet.append(
        el('div', { class: 'wd-h' }, 'Withdraw Funds'),
        el('div', { class: 'wd-sub' }, 'Enter the amount to withdraw to your bank account.'),
        el('div', { class: 'wd-amount' }, formatCurrency(st.amount, cur)),
        chips,
        el('div', { class: 'wd-dest' }, '🏦 ' + bank),
        el('button', { class: 'btn-accent wd-full', onClick: () => { machine.next(); render(); } }, 'Continue'));
    } else if (st.step === 'review') {
      sheet.append(
        el('div', { class: 'wd-h' }, 'Review & confirm'),
        rowEl('Amount', formatCurrency(st.amount, cur)),
        rowEl('To', bank),
        rowEl('Fee', formatCurrency(0, cur)),
        rowEl('Arrival', 'Instant ⚡'),
        el('button', { class: 'btn-accent wd-full', onClick: () => { machine.next(); render(); timer = setTimeout(() => { machine.next(); render(); }, processingMs); } }, 'Confirm withdrawal'),
        el('button', { class: 'wd-back', onClick: () => { machine.back(); render(); } }, '← Back'));
    } else if (st.step === 'processing') {
      sheet.append(
        el('div', { class: 'wd-ring' }),
        el('div', { class: 'wd-h center' }, 'Processing your withdrawal…'),
        el('div', { class: 'wd-sub center' }, 'Securely contacting your bank. This only takes a moment.'),
        el('div', { class: 'wd-secure' }, '🔒 Bank-grade encryption'));
    } else {
      sheet.append(
        el('div', { class: 'wd-check' }, '✓'),
        el('div', { class: 'wd-h center' }, 'Transfer initiated!'),
        el('div', { class: 'wd-sub center' }, `${formatCurrency(st.amount, cur)} is on its way to ${bank}.`),
        rowEl('Reference', '#' + st.reference),
        rowEl('Status', el('span', { class: 'wd-ok' }, 'Completed')),
        el('button', { class: 'btn-accent wd-full', onClick: close }, 'Done'));
    }
  }

  return { destroy: () => { document.removeEventListener('withdraw:open', open); overlay.remove(); } };
}
```

- [ ] **Step 2: Implement `src/styles/withdraw.css`**

```css
.wd-overlay {
  position: fixed; inset: 0; z-index: 50;
  background: rgba(8, 12, 10, 0.55);
  display: flex; align-items: flex-end; justify-content: center;
  animation: wd-fade 0.2s ease;
}
@media (min-width: 720px) { .wd-overlay { align-items: center; } }
@keyframes wd-fade { from { opacity: 0; } }

.wd-sheet {
  background: var(--surface); color: var(--ink);
  width: 100%; max-width: 440px;
  border-radius: 20px 20px 0 0; padding: 22px 20px calc(22px + env(safe-area-inset-bottom));
  animation: wd-up 0.28s cubic-bezier(0.22, 1, 0.36, 1);
}
@media (min-width: 720px) { .wd-sheet { border-radius: 18px; padding: 24px; animation: wd-pop 0.2s ease; } }
@keyframes wd-up { from { transform: translateY(100%); } }
@keyframes wd-pop { from { transform: scale(0.96); opacity: 0; } }

.wd-stepper { display: flex; align-items: center; justify-content: center; margin-bottom: 18px; }
.wd-node { width: 26px; height: 26px; border-radius: 50%; display: flex; align-items: center; justify-content: center; font-size: 12px; font-weight: 700; }
.wd-node.done, .wd-node.active { background: var(--accent); color: var(--accent-contrast); }
.wd-node.active { box-shadow: 0 0 0 4px var(--accent-soft); }
.wd-node.todo { background: var(--line); color: var(--ink-mute); }
.wd-seg { width: 28px; height: 2px; background: var(--line); }
.wd-seg.done { background: var(--accent); }

.wd-h { font-size: 18px; font-weight: 800; margin-bottom: 4px; }
.wd-h.center { text-align: center; }
.wd-sub { font-size: 13px; color: var(--ink-soft); margin-bottom: 14px; }
.wd-sub.center { text-align: center; }
.wd-amount { font-size: 38px; font-weight: 800; text-align: center; margin: 8px 0; font-variant-numeric: tabular-nums; }
.wd-chips { display: flex; gap: 8px; justify-content: center; margin-bottom: 14px; flex-wrap: wrap; }
.wd-chip { font: inherit; font-size: 13px; font-weight: 600; padding: 9px 14px; border: 1px solid var(--line); border-radius: 10px; background: var(--surface); color: var(--ink); cursor: pointer; }
.wd-chip:hover { border-color: var(--accent); }
.wd-dest { display: flex; align-items: center; gap: 8px; background: var(--line-soft); border-radius: 10px; padding: 11px 12px; font-size: 13px; margin-bottom: 16px; }
.wd-full { width: 100%; }
.wd-back { display: block; width: 100%; margin-top: 10px; background: none; border: none; font: inherit; font-size: 13px; color: var(--ink-mute); cursor: pointer; }
.wd-row { display: flex; justify-content: space-between; padding: 11px 0; border-bottom: 1px solid var(--line-soft); font-size: 14px; }
.wd-row .k { color: var(--ink-soft); }
.wd-row .v { font-weight: 700; }
.wd-ok { color: var(--accent); }
.wd-ring { width: 56px; height: 56px; border-radius: 50%; border: 5px solid var(--accent-soft); border-top-color: var(--accent); margin: 12px auto 16px; animation: wd-spin 0.9s linear infinite; }
@keyframes wd-spin { to { transform: rotate(360deg); } }
.wd-secure { text-align: center; font-size: 11px; color: var(--ink-mute); margin-top: 8px; }
.wd-check { width: 58px; height: 58px; border-radius: 50%; background: var(--accent); color: var(--accent-contrast); display: flex; align-items: center; justify-content: center; font-size: 30px; margin: 8px auto 14px; animation: wd-pop 0.35s cubic-bezier(0.22, 1, 0.36, 1); }
```

- [ ] **Step 3: Commit**

```bash
git add src/surfaces/withdraw-flow.js src/styles/withdraw.css
git commit -m "feat: 4-step withdraw flow (modal/bottom-sheet)"
```

---

## Phase 6 — Control panel

### Task 23: Control panel (`control-panel/control-panel.js` + `styles/control-panel.css`)

**Files:**
- Create: `src/control-panel/control-panel.js`
- Create: `src/styles/control-panel.css`

`mount(root, controller)` where `controller = { store, getConfig(), setConfig(patch) }` (provided by `main.js`, Task 24). Hidden by default; toggled with **Cmd/Ctrl+K**, closed with **Escape**. Edits call `controller.setConfig(patch)`. Preset/import/reset rebuild the panel fields so displayed values stay in sync (direct field edits don't rebuild, preserving focus).

- [ ] **Step 1: Implement `src/control-panel/control-panel.js`**

```js
import { el, clear } from '../lib/dom.js';
import { presets } from '../config/presets.js';
import { defaultConfig } from '../config/schema.js';
import { exportConfig, importConfig } from '../config/persistence.js';

export function mount(root, controller) {
  const body = el('div', { class: 'cp-body' });
  const drawer = el('aside', { class: 'cp-drawer' },
    el('div', { class: 'cp-head' },
      el('h4', {}, '⚙ Setup'),
      el('span', { class: 'cp-kbd' }, '⌘K to hide')),
    body);
  root.append(drawer);

  const open = () => { drawer.classList.add('open'); rebuild(); };
  const close = () => drawer.classList.remove('open');
  document.addEventListener('keydown', (e) => {
    if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') { e.preventDefault(); drawer.classList.toggle('open'); if (drawer.classList.contains('open')) rebuild(); }
    if (e.key === 'Escape') close();
  });

  // --- field builders ---
  function field(label, input) {
    return el('label', { class: 'cp-field' }, el('span', { class: 'cp-lab' }, label), input);
  }
  function text(path, value) {
    return el('input', { class: 'cp-inp', value, onInput: (e) => controller.setConfig(patch(path, e.target.value)) });
  }
  function number(path, value, step = 1) {
    return el('input', { class: 'cp-inp', type: 'number', step, value, onInput: (e) => controller.setConfig(patch(path, Number(e.target.value))) });
  }
  function range(path, value, min, max, step) {
    return el('input', { class: 'cp-inp', type: 'range', min, max, step, value, onInput: (e) => controller.setConfig(patch(path, Number(e.target.value))) });
  }
  function color(path, value) {
    return el('input', { class: 'cp-color', type: 'color', value, onInput: (e) => controller.setConfig(patch(path, e.target.value)) });
  }
  function select(path, value, options) {
    const sel = el('select', { class: 'cp-inp', onChange: (e) => controller.setConfig(patch(path, e.target.value)) },
      ...options.map(([v, l]) => el('option', { value: v, ...(v === value ? { selected: '' } : {}) }, l)));
    return sel;
  }
  function checkbox(path, value) {
    return el('input', { type: 'checkbox', ...(value ? { checked: '' } : {}), onChange: (e) => controller.setConfig(patch(path, e.target.checked)) });
  }
  // path 'data.seed' → { data: { seed: v } }
  function patch(path, v) {
    return path.split('.').reverse().reduce((acc, k) => ({ [k]: acc }), v);
  }
  function section(title) { return el('div', { class: 'cp-sec' }, title); }

  function rebuild() {
    const c = controller.getConfig();
    clear(body);

    body.append(section('Preset'),
      el('select', { class: 'cp-inp', onChange: (e) => { const p = presets.find((x) => x.id === e.target.value); if (p) { controller.setConfig(p.patch); rebuild(); } } },
        el('option', { value: '' }, 'Choose preset…'),
        ...presets.map((p) => el('option', { value: p.id }, p.label))));

    body.append(section('Brand'),
      field('Name', text('brand.name', c.brand.name)),
      field('Portal subtitle', text('brand.subtitle', c.brand.subtitle)),
      field('Logo URL', text('brand.logo', c.brand.logo)));

    body.append(section('Theme'),
      field('Accent', color('theme.accent', c.theme.accent)),
      field('Base', select('theme.base', c.theme.base, [['light', 'Light'], ['dark', 'Dark']])),
      field('Corner radius', range('theme.radius', c.theme.radius, 0, 24, 1)));

    body.append(section('Currency'),
      field('Currency', select('locale.currency', c.locale.currency, [['USD', 'USD $'], ['GBP', 'GBP £'], ['EUR', 'EUR €']])),
      field('Locale', select('locale.locale', c.locale.locale, [['en-US', 'en-US'], ['en-GB', 'en-GB'], ['de-DE', 'de-DE']])));

    body.append(section('Data'),
      field('Daily min', number('data.dailyMin', c.data.dailyMin, 10)),
      field('Daily max', number('data.dailyMax', c.data.dailyMax, 10)),
      field('Trend (-1…1)', range('data.trend', c.data.trend, -1, 1, 0.05)),
      field('Volatility (0…1)', range('data.volatility', c.data.volatility, 0, 1, 0.05)),
      field('Window (days)', number('data.windowDays', c.data.windowDays, 1)),
      field('Seed', number('data.seed', c.data.seed, 1)),
      field('Available balance', number('data.balance', c.data.balance, 1)),
      field('Hero "Today" %', number('data.todayDeltaOverride', c.data.todayDeltaOverride, 0.1)));

    body.append(section('Withdraw'),
      field('Bank label', text('withdraw.bank', c.withdraw.bank)),
      field('Processing (ms)', number('withdraw.processingMs', c.withdraw.processingMs, 100)));

    const surf = (k, l) => el('label', { class: 'cp-tog' }, l, checkbox('surfaces.' + k, c.surfaces[k]));
    body.append(section('Surfaces'),
      surf('statCards', 'Stat cards'), surf('graph', 'Graph'),
      surf('balance', 'Balance + Withdraw'), surf('tables', 'Breakdown tables'));

    body.append(el('div', { class: 'cp-actions' },
      el('button', { class: 'cp-btn', onClick: doExport }, 'Export'),
      el('button', { class: 'cp-btn', onClick: doImport }, 'Import'),
      el('button', { class: 'cp-btn', onClick: () => { controller.setConfig(defaultConfig); rebuild(); } }, 'Reset')));
  }

  function doExport() {
    const blob = new Blob([exportConfig(controller.getConfig())], { type: 'application/json' });
    const a = el('a', { href: URL.createObjectURL(blob), download: 'dashboard-config.json' });
    document.body.append(a); a.click(); a.remove();
  }
  function doImport() {
    const input = el('input', { type: 'file', accept: 'application/json' });
    input.addEventListener('change', async () => {
      const file = input.files[0]; if (!file) return;
      try { controller.setConfig(importConfig(await file.text())); rebuild(); }
      catch (err) { alert(err.message); }
    });
    input.click();
  }

  return { open, close };
}
```

- [ ] **Step 2: Implement `src/styles/control-panel.css`**

```css
.cp-drawer {
  position: fixed; top: 0; right: 0; z-index: 60;
  width: 300px; max-width: 86vw; height: 100vh;
  background: var(--surface); border-left: 1px solid var(--line);
  box-shadow: -16px 0 40px -24px rgba(0, 0, 0, 0.4);
  transform: translateX(100%); transition: transform 0.25s cubic-bezier(0.22, 1, 0.36, 1);
  overflow-y: auto; padding: 16px;
}
.cp-drawer.open { transform: translateX(0); }
.cp-head { display: flex; align-items: center; justify-content: space-between; margin-bottom: 8px; }
.cp-head h4 { font-size: 14px; }
.cp-kbd { font-size: 10px; background: var(--line-soft); border: 1px solid var(--line); border-radius: 5px; padding: 2px 6px; color: var(--ink-mute); }
.cp-sec { font-size: 10px; text-transform: uppercase; letter-spacing: 0.06em; color: var(--ink-mute); font-weight: 700; margin: 14px 0 6px; }
.cp-field { display: block; margin-bottom: 8px; }
.cp-lab { display: block; font-size: 11px; color: var(--ink-soft); margin-bottom: 3px; }
.cp-inp { width: 100%; box-sizing: border-box; font: inherit; font-size: 13px; padding: 7px 9px; border: 1px solid var(--line); border-radius: 8px; background: var(--bg); color: var(--ink); }
.cp-color { width: 100%; height: 32px; border: 1px solid var(--line); border-radius: 8px; background: var(--bg); }
.cp-tog { display: flex; align-items: center; justify-content: space-between; font-size: 13px; padding: 4px 0; }
.cp-actions { display: flex; gap: 6px; margin-top: 16px; }
.cp-btn { flex: 1; font: inherit; font-size: 12px; font-weight: 700; padding: 8px; border: 1px solid var(--line); border-radius: 8px; background: var(--bg); color: var(--ink); cursor: pointer; }
.cp-btn:hover { border-color: var(--accent); }
```

- [ ] **Step 3: Commit**

```bash
git add src/control-panel/control-panel.js src/styles/control-panel.css
git commit -m "feat: live control panel drawer"
```

---

## Phase 7 — Shell + boot wiring

### Task 24: `index.html`, `src/main.js`, favicon

**Files:**
- Replace: `index.html` (delete old demo content entirely)
- Create: `src/main.js`
- Create: `assets/favicon.svg`

- [ ] **Step 1: Create `assets/favicon.svg`**

```svg
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 32 32"><rect width="32" height="32" rx="8" fill="#16a34a"/><path d="M8 20 L14 13 L19 17 L24 10" fill="none" stroke="#fff" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"/></svg>
```

- [ ] **Step 2: Replace `index.html` wholesale**

```html
<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover" />
  <title>Member Portal</title>
  <link rel="icon" href="assets/favicon.svg" />
  <link rel="preconnect" href="https://fonts.googleapis.com" />
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin />
  <link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800&display=swap" rel="stylesheet" />
  <link rel="stylesheet" href="src/styles/tokens.css" />
  <link rel="stylesheet" href="src/styles/base.css" />
  <link rel="stylesheet" href="src/styles/surfaces.css" />
  <link rel="stylesheet" href="src/styles/withdraw.css" />
  <link rel="stylesheet" href="src/styles/control-panel.css" />
</head>
<body>
  <main class="container">
    <div class="brandbar" id="brandbar"></div>
    <h1 class="page-title">Earnings Dashboard</h1>
    <div id="surfaces"></div>
  </main>
  <div id="overlays"></div>
  <div id="panel-root"></div>
  <script type="module" src="src/main.js"></script>
</body>
</html>
```

- [ ] **Step 3: Create `src/main.js`**

```js
import { createStore } from './store.js';
import { loadConfig, saveConfig } from './config/persistence.js';
import { mergeConfig } from './config/schema.js';
import { generateEarnings } from './data/earnings-engine.js';
import { applyTheme } from './theme/apply-theme.js';
import { el, clear } from './lib/dom.js';
import { isoDate } from './lib/dates.js';
import * as statCards from './surfaces/stat-cards.js';
import * as balanceCard from './surfaces/balance-card.js';
import * as earningsGraph from './surfaces/earnings-graph.js';
import * as breakdownTables from './surfaces/breakdown-tables.js';
import * as withdrawFlow from './surfaces/withdraw-flow.js';
import * as controlPanel from './control-panel/control-panel.js';

const today = isoDate(new Date());
const build = (config) => ({ config, data: generateEarnings(config, today) });

const store = createStore(build(loadConfig()));
applyTheme(store.getState().config);

const controller = {
  store,
  getConfig: () => store.getState().config,
  setConfig(patch) {
    const config = mergeConfig(store.getState().config, patch);
    applyTheme(config);
    saveConfig(config);
    store.setState(build(config));
  },
};

// Brand bar (re-renders on every config change)
const brandbar = document.getElementById('brandbar');
function renderBrand() {
  const { brand } = store.getState().config;
  clear(brandbar);
  const logo = brand.logo ? el('img', { class: 'logo', src: brand.logo, alt: '' }) : el('div', { class: 'logo' });
  brandbar.append(
    el('div', { class: 'brand' }, logo, el('span', {}, brand.name), el('span', { class: 'sub' }, '· ' + brand.subtitle)),
    el('div', { class: 'avatar' }));
  document.title = brand.name + ' — ' + brand.subtitle;
}
store.subscribe(renderBrand);
renderBrand();

// Surfaces (order = Layout A: cards → balance → graph → tables)
const surfaces = document.getElementById('surfaces');
statCards.mount(surfaces, store);
balanceCard.mount(surfaces, store);
earningsGraph.mount(surfaces, store);
breakdownTables.mount(surfaces, store);
withdrawFlow.mount(document.getElementById('overlays'), store);
controlPanel.mount(document.getElementById('panel-root'), controller);
```

- [ ] **Step 4: Manual smoke check**

Run: `npm run dev` then open `http://localhost:8000`.
Expected: branded dashboard renders; cards count up; graph draws in and the D/W/M toggle switches series; **Cmd/Ctrl+K** opens the control panel; editing accent/brand/seed updates live; clicking **Withdraw** runs the 4-step flow to "Transfer initiated!". Press **Cmd/Ctrl+K** again to hide the panel (no trace on screen).

- [ ] **Step 5: Commit**

```bash
git add index.html src/main.js assets/favicon.svg
git commit -m "feat: shell + boot wiring; replace old demo"
```

---

## Phase 8 — End-to-end smoke test + deploy

### Task 25: Playwright smoke test (`e2e/smoke.spec.js`)

**Files:**
- Create: `e2e/smoke.spec.js`
- Create: `playwright.config.js`

> Kept in `e2e/` (not `test/`) so Node's `--test` runner ignores it; Playwright runs it separately.

- [ ] **Step 1: Create `playwright.config.js`**

```js
import { defineConfig } from '@playwright/test';

export default defineConfig({
  testDir: './e2e',
  use: { baseURL: 'http://localhost:8000' },
  webServer: {
    command: 'python3 -m http.server 8000',
    port: 8000,
    reuseExistingServer: true,
  },
});
```

- [ ] **Step 2: Create `e2e/smoke.spec.js`**

```js
import { test, expect } from '@playwright/test';

test('dashboard renders core surfaces', async ({ page }) => {
  await page.goto('/');
  await expect(page.locator('.card.hero .amount')).toBeVisible();
  await expect(page.locator('.graph svg .line')).toBeVisible();
  await expect(page.locator('.balance .btn-accent')).toBeVisible();
});

test('graph toggle switches period', async ({ page }) => {
  await page.goto('/');
  await page.locator('.toggle button', { hasText: 'Weekly' }).click();
  await expect(page.locator('.graph .title')).toHaveText(/Weekly/);
});

test('control panel opens and re-skins live', async ({ page }) => {
  await page.goto('/');
  await page.keyboard.press('Control+k');
  const nameInput = page.locator('.cp-field', { hasText: 'Name' }).locator('input');
  await nameInput.fill('Acme Capital');
  await expect(page.locator('.brandbar .brand')).toContainText('Acme Capital');
});

test('withdraw flow reaches completion', async ({ page }) => {
  await page.goto('/');
  await page.locator('.balance .btn-accent').click();
  await page.locator('.wd-chip', { hasText: 'Max' }).click();
  await page.locator('.btn-accent', { hasText: 'Continue' }).click();
  await page.locator('.btn-accent', { hasText: 'Confirm withdrawal' }).click();
  await expect(page.locator('.wd-h', { hasText: 'Transfer initiated!' })).toBeVisible({ timeout: 8000 });
});
```

- [ ] **Step 3: Install Playwright test runner + run**

Run:
```bash
npm install -D @playwright/test
npx playwright install chromium
npx playwright test
```
Expected: 4 passed. (If `Control+k` toggles devtools in headed mode, the test runs headless by default so it's fine.)

- [ ] **Step 4: Commit**

```bash
git add e2e/smoke.spec.js playwright.config.js package.json package-lock.json
git commit -m "test: Playwright smoke for surfaces, toggle, panel, withdraw"
```

---

### Task 26: Final verification + redeploy

**Files:** none (deploy step)

- [ ] **Step 1: Run the full unit suite**

Run: `npm test`
Expected: all `node --test` suites pass (rng, dates, format, engine, schema, presets, persistence, store, withdraw-machine, chart-math, apply-theme, animate).

- [ ] **Step 2: Run the e2e suite**

Run: `npx playwright test`
Expected: 4 passed.

- [ ] **Step 3: Deploy to Vercel (production)**

Run: `npx vercel@latest deploy --prod --yes --scope go-freelance`
Expected: `Production` URL returned, `readyState: READY`. The `earningsdashboard.app` domain (already attached) serves the rebuilt app once DNS has propagated.

- [ ] **Step 4: Commit any final docs/state**

```bash
git add -A
git commit -m "chore: rebuilt earnings dashboard ready for production"
```

---

## Self-Review

**1. Spec coverage** — every spec section maps to a task:
- Architecture / buildless ES modules → Tasks 1, 24 (no bundler; `<script type="module">`)
- Seeded data engine → Task 5
- Config schema (5 groups + withdraw) → Task 6; presets → Task 7; persistence + JSON import/export → Task 8
- Reactive store → Task 9
- Stat cards (count-up + deltas) → Task 18
- Balance + 4-step withdraw (bottom-sheet on mobile) → Tasks 10, 19, 22
- Area+gradient graph with D/W/M toggle + draw-in → Tasks 11, 17, 20
- Breakdown tables → Task 21
- Layout A, mobile-first + desktop → Tasks 15–16 (CSS media queries), 24 (DOM order)
- Theming via CSS custom properties → Tasks 12, 15
- Animations + `prefers-reduced-motion` → Task 13 (and surface usage)
- Live control panel (keyboard toggle, live updates, export/import/reset) → Task 23
- Testing (unit + one Playwright smoke) → Tasks 2–13 + 25
- Deployment (Vercel static) → Task 26 (domain already attached this session)

**2. Placeholder scan** — no TBD/TODO; every code step contains complete code and every test step complete assertions.

**3. Type consistency** — verified across tasks:
- Store shape `{ config, data }` consumed identically by every surface (Tasks 18–22) and produced by `build()` (Task 24).
- `data` shape `{ daily, weekly, monthly, totals:{today,week,month,total}, balance }` from Task 5 matches all readers.
- `config.locale` object passed straight into `formatCurrency(amount, config.locale)` everywhere (its `{currency, locale}` keys match Task 4's signature).
- `config.withdraw` (`bank`, `presets`, `processingMs`) used in Task 22 is defined in the schema (Task 6).
- `controller.{getConfig,setConfig}` defined in Task 24 matches every call in Task 23.
- Surface contract `mount(root, store) → { destroy }` consistent across Tasks 18–22; control panel uses `mount(root, controller) → { open, close }` (intentionally different — it takes the controller, not the store).

---

## Execution Handoff

**Plan complete and saved to** `docs/superpowers/plans/2026-06-06-earnings-dashboard-rebuild.md`. **Two execution options:**

**1. Subagent-Driven (recommended)** — I dispatch a fresh subagent per task, review between tasks, fast iteration.

**2. Inline Execution** — Execute tasks in this session using executing-plans, batch execution with checkpoints.

**Which approach?**
