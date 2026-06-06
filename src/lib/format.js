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
