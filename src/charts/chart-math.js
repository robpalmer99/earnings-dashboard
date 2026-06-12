export function buildChart(series, { width, height, padding = 8 }) {
  if (!series.length) return { points: [], linePath: '', areaPath: '', min: 0, max: 0 };
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

  const linePath = smoothLine(points);

  const areaPath =
    `${linePath} L${round(points[points.length - 1].x)},${round(height - padding)} ` +
    `L${round(points[0].x)},${round(height - padding)} Z`;

  return { points, linePath, areaPath, min, max };
}

// Catmull-Rom → cubic Bézier. Straight-line fallback below 3 points.
function smoothLine(points) {
  if (points.length < 3) {
    return points.map((p, i) => `${i === 0 ? 'M' : 'L'}${round(p.x)},${round(p.y)}`).join(' ');
  }
  let d = `M${round(points[0].x)},${round(points[0].y)}`;
  for (let i = 0; i < points.length - 1; i++) {
    const p0 = points[i - 1] || points[i];
    const p1 = points[i];
    const p2 = points[i + 1];
    const p3 = points[i + 2] || p2;
    const c1x = p1.x + (p2.x - p0.x) / 6;
    const c1y = p1.y + (p2.y - p0.y) / 6;
    const c2x = p2.x - (p3.x - p1.x) / 6;
    const c2y = p2.y - (p3.y - p1.y) / 6;
    d += ` C${round(c1x)},${round(c1y)} ${round(c2x)},${round(c2y)} ${round(p2.x)},${round(p2.y)}`;
  }
  return d;
}

export function resample(values, n) {
  if (n < 2) return values.length ? [values[0]] : [];
  if (values.length === n) return [...values];
  if (values.length === 1) return Array(n).fill(values[0]);
  const out = [];
  for (let i = 0; i < n; i++) {
    const t = (i / (n - 1)) * (values.length - 1);
    const lo = Math.floor(t);
    const hi = Math.min(values.length - 1, lo + 1);
    out.push(values[lo] + (values[hi] - values[lo]) * (t - lo));
  }
  return out;
}

function round(n) {
  return Math.round(n * 100) / 100;
}
