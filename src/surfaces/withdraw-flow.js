import { el, clear } from '../lib/dom.js';
import { formatCurrency } from '../lib/format.js';
import { createWithdrawMachine, STEPS } from './withdraw-machine.js';
import { icons } from '../lib/icons.js';

export function mount(root, store) {
  const sheet = el('div', { class: 'wd-sheet' });
  const overlay = el('div', { class: 'wd-overlay hidden' }, sheet);
  root.append(overlay);
  let machine = null;
  let timer = null;
  let settled = false;

  function close() {
    settle();
    overlay.classList.add('hidden');
    if (timer) { clearTimeout(timer); timer = null; }
  }
  function open() {
    if (timer) { clearTimeout(timer); timer = null; }
    settled = false;
    const { config, data } = store.getState();
    machine = createWithdrawMachine({ balance: data.balance, presets: config.withdraw.presets });
    overlay.classList.remove('hidden');
    render();
  }

  overlay.addEventListener('click', (e) => { if (e.target === overlay) close(); });
  document.addEventListener('withdraw:open', open);

  // Runtime-only continuity: balance drops and a payout row appears for the rest
  // of the session; reload restores the configured balance (zero-cleanup retakes).
  function settle() {
    if (settled || !machine) return;
    const st = machine.getState();
    if (st.step !== 'complete') return;
    settled = true;
    store.setState((s) => ({
      data: { ...s.data, balance: Math.round((s.data.balance - st.amount) * 100) / 100 },
      session: { payouts: [{ date: 'now', amount: st.amount, status: 'Completed' }, ...(s.session?.payouts || [])] },
    }));
  }

  function stepper(current) {
    const idx = STEPS.indexOf(current);
    const row = el('div', { class: 'wd-stepper' });
    STEPS.forEach((_, i) => {
      const cls = i < idx ? 'done' : i === idx ? 'active' : 'todo';
      row.append(el('div', { class: 'wd-node ' + cls }, i < idx ? icons.check(12) : String(i + 1)));
      if (i < STEPS.length - 1) row.append(el('div', { class: 'wd-seg' + (i < idx ? ' done' : '') }));
    });
    return row;
  }

  const rowEl = (k, v) => el('div', { class: 'wd-row' }, el('span', { class: 'k' }, k), el('span', { class: 'v' }, v));

  function render() {
    const { config } = store.getState();
    const cur = config.locale;
    const { bank, processingMs } = config.withdraw;
    const st = machine.getState();
    clear(sheet);
    sheet.append(stepper(st.step));

    if (st.step === 'amount') {
      const input = el('input', {
        class: 'wd-input', type: 'text', inputmode: 'decimal', placeholder: '0.00',
        value: st.amount > 0 ? String(st.amount) : '',
        onInput: (e) => { machine.setAmount(e.target.value); syncContinue(); },
      });
      const cont = el('button', { class: 'btn-accent wd-full', onClick: () => { machine.next(); render(); } }, 'Continue');
      function syncContinue() {
        if (machine.getState().amount > 0) cont.removeAttribute('disabled');
        else cont.setAttribute('disabled', '');
      }
      const chips = el('div', { class: 'wd-chips' },
        ...[...st.presets.map(String), 'max'].map((k) =>
          el('button', { class: 'wd-chip', onClick: () => { machine.selectPreset(k); render(); } },
            k === 'max' ? 'Max' : formatCurrency(Number(k), cur))));
      sheet.append(
        el('div', { class: 'wd-h' }, 'Withdraw Funds'),
        el('div', { class: 'wd-sub' }, 'Enter the amount to withdraw to your bank account.'),
        el('div', { class: 'wd-amount-row' }, el('span', { class: 'wd-cursign' }, formatCurrency(0, cur).replace(/[\d.,\s]/g, '')), input),
        chips,
        el('div', { class: 'wd-dest' }, icons.bank(16), ' ' + bank),
        cont);
      syncContinue();
      input.focus();
    } else if (st.step === 'review') {
      sheet.append(
        el('div', { class: 'wd-h' }, 'Review & confirm'),
        rowEl('Amount', formatCurrency(st.amount, cur)),
        rowEl('To', bank),
        rowEl('Fee', formatCurrency(0, cur)),
        rowEl('Arrival', el('span', {}, 'Instant ', icons.bolt(13))),
        el('button', { class: 'btn-accent wd-full', onClick: () => { machine.next(); render(); timer = setTimeout(() => { machine.next(); render(); }, processingMs); } }, 'Confirm withdrawal'),
        el('button', { class: 'wd-back', onClick: () => { machine.back(); render(); } }, '← Back'));
    } else if (st.step === 'processing') {
      sheet.append(
        el('div', { class: 'wd-ring' }),
        el('div', { class: 'wd-h center' }, 'Processing your withdrawal…'),
        el('div', { class: 'wd-sub center' }, 'Securely contacting your bank. This only takes a moment.'),
        el('div', { class: 'wd-secure' }, icons.lock(12), ' Bank-grade encryption'));
    } else {
      sheet.append(
        el('div', { class: 'wd-check' }, icons.check(26)),
        el('div', { class: 'wd-h center' }, 'Transfer complete!'),
        el('div', { class: 'wd-sub center' }, `${formatCurrency(st.amount, cur)} is on its way to ${bank}.`),
        rowEl('Reference', '#' + st.reference),
        rowEl('Status', el('span', { class: 'wd-ok' }, 'Completed')),
        el('button', { class: 'btn-accent wd-full', onClick: close }, 'Done'));
    }
  }

  return { destroy: () => { document.removeEventListener('withdraw:open', open); if (timer) { clearTimeout(timer); timer = null; } overlay.remove(); } };
}
