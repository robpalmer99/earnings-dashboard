import { makeRng } from '../lib/rng.js';
import { addDays, monthKey } from '../lib/dates.js';

export const MASTER_DAYS = 180;

const round2 = (n) => Math.round(n * 100) / 100;
const sum = (arr) => arr.reduce((s, d) => s + d.amount, 0);

function isWeekend(dateStr) {
  const dow = new Date(dateStr + 'T00:00:00Z').getUTCDay();
  return dow === 0 || dow === 6;
}

function generateDaily(rng, config, now) {
  const { dailyMin, dailyMax, trend, volatility, weekendDip } = config.data;
  const days = [];
  for (let i = MASTER_DAYS - 1; i >= 0; i--) {
    const date = addDays(now, -i);
    const progress = (MASTER_DAYS - 1 - i) / (MASTER_DAYS - 1);
    const trendFactor = 1 + trend * (progress - 0.5);
    const base = dailyMin + rng() * (dailyMax - dailyMin);
    const noise = 1 + (rng() - 0.5) * 2 * volatility;
    let amount = base * trendFactor * noise;
    amount = Math.max(dailyMin, Math.min(dailyMax * 1.5, amount));
    amount = round2(amount);
    if (weekendDip && isWeekend(date)) amount = round2(amount * 0.6);
    days.push({ date, amount });
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

// Month → Week → Today cascade. Scaling an inner block only increases the
// outer blocks' sums, so earlier-fixed deltas can only get more positive.
// Interactions, by design:
// - weekendDip: if today is Sat/Sun, the today-nudge can override the dip
//   (positive hero delta beats weekend realism; use todayDeltaOverride to control).
// - Uplifted values may exceed the dailyMax*1.5 clamp (reads as a spike day).
// - Without todayDeltaOverride, a naturally huge today can show a >100% delta;
//   it stays consistent with the visible 7-day table, so we don't cap it.
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
  let daily = generateDaily(rng, config, now);
  if (config.data.forcePositiveDeltas) daily = upliftPositive(daily, rng);
  return {
    daily,
    weekly: aggregateWeekly(daily.slice(-(8 * 7))),
    monthly: aggregateMonthly(daily),
    totals: computeTotals(daily, config),
    balance: config.data.balance,
  };
}
