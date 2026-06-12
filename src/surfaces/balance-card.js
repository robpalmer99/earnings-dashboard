import { el } from '../lib/dom.js';
import { formatCurrency } from '../lib/format.js';
import { icons } from '../lib/icons.js';

export function mount(root, store) {
  const amountEl = el('div', { class: 'amount' });
  const btn = el('button', {
    class: 'btn-accent',
    onClick: () => document.dispatchEvent(new CustomEvent('withdraw:open')),
  }, icons.arrowUp(14), ' Withdraw');

  const card = el('div', { class: 'balance' },
    el('div', {},
      el('div', { class: 'label' }, 'Available Balance'),
      amountEl,
      el('div', { class: 'sub' }, 'Cleared & ready to withdraw')),
    btn);
  root.append(card);

  function render() {
    const { config, data } = store.getState();
    card.classList.toggle('hidden', !config.surfaces.balance);
    amountEl.textContent = formatCurrency(data.balance, config.locale);
  }

  const off = store.subscribe(render);
  render();
  return { destroy: () => { off(); card.remove(); } };
}
