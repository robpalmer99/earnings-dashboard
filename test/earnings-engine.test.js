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

test('daily master series has 180 entries ending today', () => {
  const { daily } = generateEarnings(config, NOW);
  assert.equal(daily.length, 180);
  assert.equal(daily[daily.length - 1].date, '2026-06-06');
});

test('monthly is six complete trailing 30-day buckets', () => {
  const { daily, monthly } = generateEarnings(config, NOW);
  assert.equal(monthly.length, 6);
  const last30 = daily.slice(-30).reduce((s, d) => s + d.amount, 0);
  assert.equal(monthly[5].amount, Math.round(last30 * 100) / 100);
  assert.equal(monthly[5].endDate, '2026-06-06');
  assert.equal(monthly[5].month, '2026-06');
  assert.equal(monthly[0].endDate, '2026-01-07');
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

test('amounts stay within sane bounds', () => {
  const { daily } = generateEarnings(config, NOW);
  // Raw generator: dailyMax is a hard ceiling.
  for (const d of daily) {
    assert.ok(d.amount >= 300 && d.amount <= 1100, `amount ${d.amount}`);
  }
});

test('dailyMax is a hard ceiling even with forcePositiveDeltas', () => {
  for (let seed = 1; seed <= 50; seed++) {
    const c = { data: { ...config.data, seed, forcePositiveDeltas: true } };
    const { daily, totals } = generateEarnings(c, NOW);
    for (const d of daily) assert.ok(d.amount <= 1100, `seed ${seed} ${d.date} amount ${d.amount}`);
    assert.ok(totals.today.amount <= 1100, `seed ${seed} today ${totals.today.amount}`);
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

test('weekendDip scales Sat/Sun down vs neighbors', () => {
  const dipCfg = { data: { ...config.data, weekendDip: true } };
  const a = generateEarnings(config, NOW);
  const b = generateEarnings(dipCfg, NOW);
  for (let i = 0; i < b.daily.length; i++) {
    const dow = new Date(b.daily[i].date + 'T00:00:00Z').getUTCDay();
    if (dow === 0 || dow === 6) {
      // weekend amounts may fall below dailyMin by design (dip applies after clamp)
      assert.equal(b.daily[i].amount, Math.round(a.daily[i].amount * 0.6 * 100) / 100);
    } else {
      assert.equal(b.daily[i].amount, a.daily[i].amount);
    }
  }
});

test('forcePositiveDeltas: all deltas positive across many seeds', () => {
  for (let seed = 1; seed <= 50; seed++) {
    const c = { data: { ...config.data, seed, forcePositiveDeltas: true, todayDeltaOverride: null } };
    const { totals } = generateEarnings(c, NOW);
    assert.ok(totals.today.deltaPct > 0, `seed ${seed} today ${totals.today.deltaPct}`);
    assert.ok(totals.week.deltaPct > 0, `seed ${seed} week ${totals.week.deltaPct}`);
    assert.ok(totals.month.deltaPct > 0, `seed ${seed} month ${totals.month.deltaPct}`);
    assert.ok(totals.week.deltaPct <= 100, `seed ${seed} week too high ${totals.week.deltaPct}`);
  }
});

test('forcePositiveDeltas is deterministic and off by default here', () => {
  const c = { data: { ...config.data, forcePositiveDeltas: true } };
  assert.deepEqual(generateEarnings(c, NOW), generateEarnings(c, NOW));
  const raw = generateEarnings(config, NOW);
  assert.deepEqual(raw, generateEarnings(config, NOW));
});

test('todayDeltaOverride still wins for the hero card', () => {
  const c = { data: { ...config.data, forcePositiveDeltas: true, todayDeltaOverride: 27.3 } };
  assert.equal(generateEarnings(c, NOW).totals.today.deltaPct, 27.3);
});

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
