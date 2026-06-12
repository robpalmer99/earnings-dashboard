import { el, clear } from '../lib/dom.js';
import { icons } from '../lib/icons.js';

const ITEMS = [
  { label: 'Home', icon: 'home' },
  { label: 'Earnings', icon: 'chart', active: true },
  { label: 'Payouts', icon: 'dollar' },
  { label: 'Settings', icon: 'gear' },
];

export function mount(root, store) {
  const bar = el('nav', { class: 'tabbar' });
  root.append(bar);

  function render() {
    const on = !!store.getState().config.surfaces.tabBar;
    bar.classList.toggle('hidden', !on);
    document.body.classList.toggle('has-tabbar', on);
    clear(bar);
    for (const it of ITEMS) {
      bar.append(el('button', { class: 'tab' + (it.active ? ' on' : '') },
        icons[it.icon](20), el('span', {}, it.label)));
    }
  }

  const off = store.subscribe(render);
  render();
  return { destroy: () => { off(); bar.remove(); document.body.classList.remove('has-tabbar'); } };
}
