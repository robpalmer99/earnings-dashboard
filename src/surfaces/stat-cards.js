import { el, clear } from '../lib/dom.js';
import { formatCurrency, formatPercent } from '../lib/format.js';
import { countUp } from '../lib/animate.js';

const CARDS = [
  { key: 'today', label: "Today's Earnings", hero: true },
  { key: 'week', label: 'This Week' },
  { key: 'month', label: 'This Month' },
  { key: 'total', label: 'Total' },
];

export function mount(root, store) {
  const wrap = el('div', { class: 'cards' });
  root.append(wrap);

  function render() {
    const { config, data } = store.getState();
    wrap.classList.toggle('hidden', !config.surfaces.statCards);
    clear(wrap);
    for (const def of CARDS) {
      const t = data.totals[def.key];
      const amountEl = el('div', { class: 'amount' }, formatCurrency(t.amount, config.locale));
      const delta = t.deltaPct != null
        ? el('div', { class: 'delta' + (t.deltaPct < 0 ? ' down' : '') },
            `${t.deltaPct < 0 ? '▼' : '▲'} ${formatPercent(Math.abs(t.deltaPct))} vs prior`)
        : el('div', { class: 'delta' }, def.key === 'total' ? 'all-time' : '');
      wrap.append(el('div', { class: 'card' + (def.hero ? ' hero' : '') },
        el('div', { class: 'label' }, def.label), amountEl, delta));
      countUp(amountEl, t.amount, { duration: 900, format: (n) => formatCurrency(n, config.locale) });
    }
  }

  const off = store.subscribe(render);
  render();
  return { destroy: () => { off(); wrap.remove(); } };
}
