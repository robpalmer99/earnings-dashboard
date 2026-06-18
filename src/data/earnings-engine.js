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
    amount = Math.max(dailyMin, Math.min(dailyMax, amount));
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

// Force the recent periods to out-earn the prior ones to keep every delta
// positive — but WITHOUT lifting any day above the hard dailyMax ceiling. Rather
// than inflate the recent block (which would breach the cap, e.g. a $1,941 "today"
// against a $1,100 max), we deflate the *baseline* block each period is compared
// against. Since we only ever scale values down, nothing can exceed dailyMax.
// Tells a clean "ramped up to the ceiling" story. Order today→week→month so each
// step reads the already-adjusted series; the three baseline ranges don't overlap
// (prev7, prev30, and the yesterday nudge touch disjoint days).
// By design:
// - weekendDip: a Sat/Sun "yesterday" gets nudged below today, so the positive
//   hero delta can override the weekend dip (use todayDeltaOverride to control).
// - Deflated baselines may dip below dailyMin (reads as an early ramp-up day).
// - A naturally huge recent period can still show a >100% delta; it stays
//   consistent with the visible tables, so we leave it.
function upliftPositive(days, rng) {
  const out = days.map((d) => ({ ...d }));
  const n = out.length;
  const margin = () => 0.05 + rng() * 0.35; // recent leads baseline by +5%..+40%, seeded
  const block = (from, to) => out.slice(from, to).reduce((s, d) => s + d.amount, 0);
  const deflate = (from, to, f) => { for (let i = from; i < to; i++) out[i].amount *= f; };

  // Today: if it isn't already above yesterday, dip yesterday just below it.
  if (out[n - 1].amount <= out[n - 2].amount) out[n - 2].amount = out[n - 1].amount / (1 + margin());

  // Week: deflate prev-7 so last-7 leads it by the margin.
  const last7 = block(n - 7, n);
  const prev7 = block(n - 14, n - 7);
  const cap7 = last7 / (1 + margin());
  if (prev7 > cap7) deflate(n - 14, n - 7, cap7 / prev7);

  // Month: deflate prev-30 so last-30 leads it by the margin.
  const last30 = block(n - 30, n);
  const prev30 = block(n - 60, n - 30);
  const cap30 = last30 / (1 + margin());
  if (prev30 > cap30) deflate(n - 60, n - 30, cap30 / prev30);

  for (const d of out) d.amount = round2(d.amount);
  return out;
}

// Available balance: an explicit override when config.data.balance is set,
// otherwise a believable "few days of recent earnings, cleared and ready to
// withdraw" figure derived from the series — so it tracks the seed (varies on
// Randomize) and stays coherent with the daily numbers on screen. Own rng stream
// (seed offset) so it doesn't disturb the data series.
function resolveBalance(config, daily) {
  const override = config.data.balance;
  if (override != null) return override;
  const avgDaily = sum(daily.slice(-7)) / 7;
  const rng = makeRng(((config.data.seed >>> 0) + 104729) >>> 0);
  return round2(avgDaily * (3 + rng() * 4)); // 3..7 days' worth
}

function pctDelta(current, previous) {
  if (!previous) return null;
  return round2(((current - previous) / previous) * 100);
}

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
    balance: resolveBalance(config, daily),
    payouts: generatePayouts(config, now),
  };
}
