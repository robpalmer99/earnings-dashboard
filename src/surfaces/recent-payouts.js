import { el, clear } from '../lib/dom.js';
import { formatCurrency, formatDateShort } from '../lib/format.js';
import { icons } from '../lib/icons.js';

export function mount(root, store) {
  const wrap = el('div', { class: 'payouts' });
  root.append(wrap);

  function render() {
    const { config, data, session } = store.getState();
    wrap.classList.toggle('hidden', !config.surfaces.payouts);
    clear(wrap);
    wrap.append(el('div', { class: 'p-head' }, 'Recent Payouts'));
    const rows = [...(session?.payouts || []), ...(data.payouts || [])];
    for (const r of rows) {
      wrap.append(el('div', { class: 'p-row' },
        el('div', { class: 'p-ico' }, icons.bank(16)),
        el('div', { class: 'p-main' },
          el('div', { class: 'p-date' }, r.date === 'now' ? 'Just now' : formatDateShort(r.date, config.locale.locale)),
          el('div', { class: 'p-sub' }, config.withdraw.bank)),
        el('div', { class: 'p-right' },
          el('div', { class: 'p-amt' }, formatCurrency(r.amount, config.locale)),
          el('div', { class: 'p-badge' }, 'Completed'))));
    }
  }

  const off = store.subscribe(render);
  render();
  return { destroy: () => { off(); wrap.remove(); } };
}
