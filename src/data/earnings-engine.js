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
    const progress = windowDays > 1 ? (windowDays - 1 - i) / (windowDays - 1) : 1;
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
