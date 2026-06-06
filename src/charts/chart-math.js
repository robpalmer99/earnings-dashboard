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

  const linePath = points
    .map((p, i) => `${i === 0 ? 'M' : 'L'}${round(p.x)},${round(p.y)}`)
    .join(' ');

  const areaPath =
    `${linePath} L${round(points[points.length - 1].x)},${round(height - padding)} ` +
    `L${round(points[0].x)},${round(height - padding)} Z`;

  return { points, linePath, areaPath, min, max };
}

function round(n) {
  return Math.round(n * 100) / 100;
}
