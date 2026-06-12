import { makeRng } from '../lib/rng.js';
import { addDays, monthKey } from '../lib/dates.js';

export const MASTER_DAYS = 180;

const round2 = (n) => Math.round(n * 100) / 100;
const sum = (arr) => arr.reduce((s, d) => s + d.amount, 0);

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
  // Six complete trailing 30-day buckets ending today. Complete buckets only —
  // the calendar-month "partial month crash" is structurally impossible.
  // Note: 'month' reflects the bucket's END date; buckets may cross calendar months.
  const buckets = [];
  for (let k = 5; k >= 0; k--) {
    const end = daily.length - k * 30;
    const slice = daily.slice(end - 30, end);
    const endDate = slice[slice.length - 1].date;
    buckets.push({ month: monthKey(endDate), endDate, amount: round2(sum(slice)) });
  }
  return buckets;
}

function pctDelta(current, previous) {
  if (!previous) return null;
  return round2(((current - previous) / previous) * 100);
}

function computeTotals(daily, config) {
  const n = daily.length;
  const windowDays = Math.min(config.data.windowDays || n, n);
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
    total: { amount: round2(sum(daily.slice(-windowDays))) },
  };
}

export function generateEarnings(config, now) {
  const rng = makeRng(config.data.seed);
  const daily = generateDaily(rng, config, now);
  return {
    daily,
    weekly: aggregateWeekly(daily.slice(-(8 * 7))),
    monthly: aggregateMonthly(daily),
    totals: computeTotals(daily, config),
    balance: config.data.balance,
  };
}
