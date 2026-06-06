import { el, clear } from '../lib/dom.js';
import { createLineChart } from '../charts/line-chart.js';

const PERIODS = [
  { key: 'daily', label: 'Daily', title: 'Daily Earnings — Last 30 Days' },
  { key: 'weekly', label: 'Weekly', title: 'Weekly Earnings' },
  { key: 'monthly', label: 'Monthly', title: 'Monthly Earnings' },
];

function seriesFor(period, data) {
  if (period === 'weekly') return data.weekly.map((w) => ({ amount: w.amount }));
  if (period === 'monthly') return data.monthly.map((m) => ({ amount: m.amount }));
  return data.daily.slice(-30).map((d) => ({ amount: d.amount }));
}

export function mount(root, store) {
  let active = 'daily';
  const chart = createLineChart();
  const titleEl = el('div', { class: 'title' });
  const toggle = el('div', { class: 'toggle' });
  const card = el('div', { class: 'graph' },
    el('div', { class: 'top' }, titleEl, toggle), chart.svg);
  root.append(card);

  function renderToggle() {
    clear(toggle);
    for (const p of PERIODS) {
      toggle.append(el('button', {
        class: p.key === active ? 'on' : '',
        onClick: () => { active = p.key; render(true); },
      }, p.label));
    }
  }

  function render(animate = true) {
    const { config, data } = store.getState();
    card.classList.toggle('hidden', !config.surfaces.graph);
    titleEl.textContent = PERIODS.find((p) => p.key === active).title;
    renderToggle();
    chart.render(seriesFor(active, data), { animate });
  }

  const off = store.subscribe(() => render(false));
  render(true);
  return { destroy: () => { off(); card.remove(); } };
}
