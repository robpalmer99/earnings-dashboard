import { el } from '../lib/dom.js';
import { buildChart, resample } from './chart-math.js';
import { drawPath, lerp, easeOutExpo } from '../lib/animate.js';

const PAD = 14;
const MORPH_MS = 450;
let uid = 0;

export function createLineChart() {
  const gradId = 'chart-grad-' + ++uid;
  const defs = el('defs', {},
    el('linearGradient', { id: gradId, x1: 0, y1: 0, x2: 0, y2: 1 },
      el('stop', { offset: '0%', 'stop-color': 'var(--accent)', 'stop-opacity': 0.28 }),
      el('stop', { offset: '100%', 'stop-color': 'var(--accent)', 'stop-opacity': 0 })));
  const area = el('path', { class: 'area', fill: `url(#${gradId})` });
  const line = el('path', { class: 'line' });
  const dot = el('circle', { class: 'dot', r: 4, style: { opacity: 0 } });
  const tipDot = el('circle', { class: 'dot', r: 4, style: { opacity: 0 } });
  const tipBox = el('rect', { class: 'tip', rx: 6, height: 22, style: { opacity: 0 } });
  const tipText = el('text', { class: 'tip-text', 'text-anchor': 'middle', style: { opacity: 0 } });
  const svg = el('svg', { viewBox: '0 0 600 160' }, defs, area, line, dot, tipDot, tipBox, tipText);

  let values = [];
  let points = [];
  let format = (n) => String(Math.round(n));
  let morphRaf = null;

  function box() {
    const w = svg.clientWidth || 600;
    const h = svg.clientHeight || 160;
    return { w, h };
  }

  function draw(vals, { w, h }) {
    svg.setAttribute('viewBox', `0 0 ${w} ${h}`);
    const built = buildChart(vals.map((amount) => ({ amount })), { width: w, height: h, padding: PAD });
    area.setAttribute('d', built.areaPath);
    line.setAttribute('d', built.linePath);
    const last = built.points[built.points.length - 1];
    dot.setAttribute('cx', last.x);
    dot.setAttribute('cy', last.y);
    dot.style.opacity = '1';
    points = built.points;
  }

  function morphTo(next) {
    const b = box();
    const n = Math.max(values.length, next.length);
    const from = resample(values, n);
    const to = resample(next, n);
    line.style.strokeDasharray = '';
    if (morphRaf) cancelAnimationFrame(morphRaf);
    const start = performance.now();
    function frame(now) {
      const t = Math.min(1, (now - start) / MORPH_MS);
      const e = easeOutExpo(t);
      draw(from.map((v, i) => lerp(v, to[i], e)), b);
      if (t < 1) morphRaf = requestAnimationFrame(frame);
      else { draw(next, b); morphRaf = null; }
    }
    morphRaf = requestAnimationFrame(frame);
  }

  function hideTip() {
    tipDot.style.opacity = tipBox.style.opacity = tipText.style.opacity = '0';
  }

  svg.addEventListener('pointermove', (e) => {
    if (!points.length) return;
    const rect = svg.getBoundingClientRect();
    const vw = svg.viewBox.baseVal.width || rect.width;
    const x = ((e.clientX - rect.left) / rect.width) * vw;
    let best = 0;
    for (let i = 1; i < points.length; i++) {
      if (Math.abs(points[i].x - x) < Math.abs(points[best].x - x)) best = i;
    }
    const p = points[best];
    const label = format(p.amount);
    const wBox = Math.max(48, label.length * 7 + 16);
    const bx = Math.min(Math.max(p.x, PAD + wBox / 2), vw - PAD - wBox / 2);
    const above = p.y > 34;
    tipDot.setAttribute('cx', p.x); tipDot.setAttribute('cy', p.y);
    tipBox.setAttribute('width', wBox); tipBox.setAttribute('x', bx - wBox / 2);
    tipBox.setAttribute('y', above ? p.y - 32 : p.y + 10);
    tipText.setAttribute('x', bx); tipText.setAttribute('y', above ? p.y - 17 : p.y + 25);
    tipText.textContent = label;
    tipDot.style.opacity = tipBox.style.opacity = tipText.style.opacity = '1';
  });
  svg.addEventListener('pointerleave', hideTip);

  if (typeof ResizeObserver !== 'undefined') {
    new ResizeObserver(() => { if (values.length && !morphRaf) draw(values, box()); }).observe(svg);
  }

  function render(series, { animate = true, morph = false, format: fmt } = {}) {
    if (!series.length) return;
    if (fmt) format = fmt;
    const next = series.map((d) => d.amount);
    hideTip();
    if (morph && values.length && animate) {
      morphTo(next);
    } else {
      const firstDraw = !values.length;
      draw(next, box());
      if (animate && firstDraw) drawPath(line, { duration: 900 });
    }
    values = next;
  }

  return { svg, render };
}
