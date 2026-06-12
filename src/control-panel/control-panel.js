import { el, clear } from '../lib/dom.js';
import { presets } from '../config/presets.js';
import { exportConfig, importConfig } from '../config/persistence.js';

export function mount(root, controller) {
  const body = el('div', { class: 'cp-body' });
  const drawer = el('aside', { class: 'cp-drawer' },
    el('div', { class: 'cp-head' },
      el('h4', {}, 'Setup'),
      el('span', { class: 'cp-kbd' }, '⌘K to hide')),
    body);
  root.append(drawer);

  const open = () => { drawer.classList.add('open'); rebuild(); };
  const close = () => drawer.classList.remove('open');
  document.addEventListener('keydown', (e) => {
    if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') { e.preventDefault(); drawer.classList.toggle('open'); if (drawer.classList.contains('open')) rebuild(); }
    if (e.key === 'Escape') close();
  });

  function field(label, input) {
    return el('label', { class: 'cp-field' }, el('span', { class: 'cp-lab' }, label), input);
  }
  function text(path, value) {
    return el('input', { class: 'cp-inp', value, onInput: (e) => controller.setConfig(patch(path, e.target.value)) });
  }
  function number(path, value, step = 1) {
    return el('input', { class: 'cp-inp', type: 'number', step, value, onInput: (e) => {
      if (e.target.value === '') return; // don't slam to 0 mid-edit while the field is empty
      const n = Number(e.target.value);
      if (Number.isFinite(n)) controller.setConfig(patch(path, n));
    } });
  }
  function range(path, value, min, max, step) {
    return el('input', { class: 'cp-inp', type: 'range', min, max, step, value, onInput: (e) => controller.setConfig(patch(path, Number(e.target.value))) });
  }
  function color(path, value) {
    return el('input', { class: 'cp-color', type: 'color', value, onInput: (e) => controller.setConfig(patch(path, e.target.value)) });
  }
  function select(path, value, options) {
    const sel = el('select', { class: 'cp-inp', onChange: (e) => controller.setConfig(patch(path, e.target.value)) },
      ...options.map(([v, l]) => el('option', { value: v, ...(v === value ? { selected: '' } : {}) }, l)));
    return sel;
  }
  function checkbox(path, value) {
    return el('input', { type: 'checkbox', ...(value ? { checked: '' } : {}), onChange: (e) => controller.setConfig(patch(path, e.target.checked)) });
  }
  function patch(path, v) {
    return path.split('.').reverse().reduce((acc, k) => ({ [k]: acc }), v);
  }
  function section(title) { return el('div', { class: 'cp-sec' }, title); }

  function rebuild() {
    const c = controller.getConfig();
    clear(body);

    body.append(section('Preset'),
      el('select', { class: 'cp-inp', onChange: (e) => { const p = presets.find((x) => x.id === e.target.value); if (p) { controller.setConfig(p.patch); rebuild(); } } },
        el('option', { value: '' }, 'Choose preset…'),
        ...presets.map((p) => el('option', { value: p.id }, p.label))));

    body.append(section('Brand'),
      field('Name', text('brand.name', c.brand.name)),
      field('Portal subtitle', text('brand.subtitle', c.brand.subtitle)),
      field('Logo URL', text('brand.logo', c.brand.logo)));

    body.append(section('Theme'),
      field('Accent', color('theme.accent', c.theme.accent)),
      field('Base', select('theme.base', c.theme.base, [['light', 'Light'], ['dark', 'Dark']])),
      field('Corner radius', range('theme.radius', c.theme.radius, 0, 24, 1)));

    body.append(section('Currency'),
      field('Currency', select('locale.currency', c.locale.currency, [['USD', 'USD $'], ['GBP', 'GBP £'], ['EUR', 'EUR €']])),
      field('Locale', select('locale.locale', c.locale.locale, [['en-US', 'en-US'], ['en-GB', 'en-GB'], ['de-DE', 'de-DE']])));

    body.append(section('Data'),
      field('Daily min', number('data.dailyMin', c.data.dailyMin, 10)),
      field('Daily max', number('data.dailyMax', c.data.dailyMax, 10)),
      field('Trend (-1…1)', range('data.trend', c.data.trend, -1, 1, 0.05)),
      field('Volatility (0…1)', range('data.volatility', c.data.volatility, 0, 1, 0.05)),
      field('Window (days)', number('data.windowDays', c.data.windowDays, 1)),
      field('Seed', number('data.seed', c.data.seed, 1)),
      field('Available balance', number('data.balance', c.data.balance, 1)),
      field('Hero "Today" %', number('data.todayDeltaOverride', c.data.todayDeltaOverride, 0.1)),
      field('Always-positive deltas', checkbox('data.forcePositiveDeltas', c.data.forcePositiveDeltas)),
      field('Weekend dip', checkbox('data.weekendDip', c.data.weekendDip)));

    body.append(section('Withdraw'),
      field('Bank label', text('withdraw.bank', c.withdraw.bank)),
      field('Processing (ms)', number('withdraw.processingMs', c.withdraw.processingMs, 100)),
      field('Payout history rows', number('payouts.count', c.payouts.count, 1)));

    const surf = (k, l) => el('label', { class: 'cp-tog' }, l, checkbox('surfaces.' + k, c.surfaces[k]));
    body.append(section('Surfaces'),
      surf('statCards', 'Stat cards'), surf('graph', 'Graph'),
      surf('balance', 'Balance + Withdraw'), surf('tables', 'Breakdown tables'),
      surf('payouts', 'Recent payouts'), surf('tabBar', 'Bottom tab bar'));

    body.append(el('div', { class: 'cp-actions' },
      el('button', { class: 'cp-btn', onClick: doExport }, 'Export'),
      el('button', { class: 'cp-btn', onClick: doImport }, 'Import'),
      el('button', { class: 'cp-btn', onClick: () => { controller.resetConfig(); rebuild(); } }, 'Reset')));
  }

  function doExport() {
    const blob = new Blob([exportConfig(controller.getConfig())], { type: 'application/json' });
    const a = el('a', { href: URL.createObjectURL(blob), download: 'dashboard-config.json' });
    document.body.append(a); a.click(); URL.revokeObjectURL(a.href); a.remove();
  }
  function doImport() {
    const input = el('input', { type: 'file', accept: 'application/json' });
    input.addEventListener('change', async () => {
      const file = input.files[0]; if (!file) return;
      try { controller.setConfig(importConfig(await file.text())); rebuild(); }
      catch (err) { alert(err.message); }
    });
    input.click();
  }

  return { open, close };
}
