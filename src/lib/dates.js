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
