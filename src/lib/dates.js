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
