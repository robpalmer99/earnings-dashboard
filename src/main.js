import { createStore } from './store.js';
import { loadConfig, saveConfig } from './config/persistence.js';
import { mergeConfig, defaultConfig } from './config/schema.js';
import { generateEarnings } from './data/earnings-engine.js';
import { applyTheme } from './theme/apply-theme.js';
import { el, clear } from './lib/dom.js';
import { isoDate } from './lib/dates.js';
import * as statCards from './surfaces/stat-cards.js';
import * as balanceCard from './surfaces/balance-card.js';
import * as earningsGraph from './surfaces/earnings-graph.js';
import * as breakdownTables from './surfaces/breakdown-tables.js';
import * as withdrawFlow from './surfaces/withdraw-flow.js';
import * as controlPanel from './control-panel/control-panel.js';

const today = isoDate(new Date());
const build = (config) => ({ config, data: generateEarnings(config, today) });

const store = createStore({ ...build(loadConfig()), session: { payouts: [] } });
applyTheme(store.getState().config);

const controller = {
  store,
  getConfig: () => store.getState().config,
  setConfig(patch) {
    const config = mergeConfig(store.getState().config, patch);
    applyTheme(config);
    saveConfig(config);
    store.setState(build(config));
  },
  // True reset: set the default config directly (not a merge), so stray keys from a
  // previously imported config can't survive a reset.
  resetConfig() {
    applyTheme(defaultConfig);
    saveConfig(defaultConfig);
    store.setState(build(defaultConfig));
  },
};

const brandbar = document.getElementById('brandbar');
function renderBrand() {
  const { brand } = store.getState().config;
  clear(brandbar);
  const logo = brand.logo ? el('img', { class: 'logo', src: brand.logo, alt: '' }) : el('div', { class: 'logo' });
  brandbar.append(
    el('div', { class: 'brand' }, logo, el('span', {}, brand.name), el('span', { class: 'sub' }, '· ' + brand.subtitle)),
    el('div', { class: 'avatar' }));
  document.title = brand.name + ' — ' + brand.subtitle;
}
store.subscribe(renderBrand);
renderBrand();

const surfaces = document.getElementById('surfaces');
statCards.mount(surfaces, store);
balanceCard.mount(surfaces, store);
earningsGraph.mount(surfaces, store);
breakdownTables.mount(surfaces, store);
withdrawFlow.mount(document.getElementById('overlays'), store);
controlPanel.mount(document.getElementById('panel-root'), controller);
