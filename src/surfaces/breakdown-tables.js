import { el, clear } from '../lib/dom.js';
import { formatCurrency, formatDateShort } from '../lib/format.js';

export function mount(root, store) {
  const wrap = el('div', { class: 'tables' });
  root.append(wrap);

  function render() {
    const { config, data } = store.getState();
    wrap.classList.toggle('hidden', !config.surfaces.tables);
    clear(wrap);
    wrap.append(el('div', { class: 'thead' },
      el('div', {}, 'Date'), el('div', { class: 'amt' }, 'Gross'), el('div', {}, 'Trend')));

    const rows = data.daily.slice(-7).reverse();
    const max = Math.max(1, ...rows.map((r) => r.amount));
    let total = 0;
    for (const r of rows) {
      total += r.amount;
      const pct = Math.round((r.amount / max) * 100);
      wrap.append(el('div', { class: 'row' },
        el('div', {}, formatDateShort(r.date, config.locale.locale)),
        el('div', { class: 'amt' }, formatCurrency(r.amount, config.locale)),
        el('div', { class: 'bar-wrap' }, el('div', { class: 'bar', style: { width: pct + '%' } }))));
    }
    wrap.append(el('div', { class: 'row total' },
      el('div', {}, '7-Day Total'),
      el('div', { class: 'amt' }, formatCurrency(Math.round(total * 100) / 100, config.locale)),
      el('div', {})));
  }

  const off = store.subscribe(render);
  render();
  return { destroy: () => { off(); wrap.remove(); } };
}
