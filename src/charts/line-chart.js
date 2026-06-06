import { el } from '../lib/dom.js';
import { buildChart } from './chart-math.js';
import { drawPath } from '../lib/animate.js';

const W = 600, H = 160, PAD = 12;

export function createLineChart() {
  const area = el('path', { class: 'area' });
  const line = el('path', { class: 'line' });
  const dot = el('circle', { class: 'dot', r: 4, style: { opacity: 0 } });
  const svg = el('svg', { viewBox: `0 0 ${W} ${H}`, preserveAspectRatio: 'none' }, area, line, dot);

  function render(series, { animate = true } = {}) {
    if (!series.length) return;
    const { linePath, areaPath, points } = buildChart(series, { width: W, height: H, padding: PAD });
    area.setAttribute('d', areaPath);
    line.setAttribute('d', linePath);
    const last = points[points.length - 1];
    dot.setAttribute('cx', last.x);
    dot.setAttribute('cy', last.y);
    dot.style.opacity = '1';
    if (animate) drawPath(line, { duration: 900 });
  }

  return { svg, render };
}
