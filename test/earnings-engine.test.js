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
  assert.equal(daily[0].date, '2026-04-08');
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
