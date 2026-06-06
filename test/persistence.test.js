import { test } from 'node:test';
import assert from 'node:assert/strict';
import { loadConfig, saveConfig, exportConfig, importConfig } from '../src/config/persistence.js';
import { defaultConfig } from '../src/config/schema.js';

function fakeStorage() {
  const m = new Map();
  return {
    getItem: (k) => (m.has(k) ? m.get(k) : null),
    setItem: (k, v) => m.set(k, String(v)),
    removeItem: (k) => m.delete(k),
  };
}

test('loadConfig returns merged defaults when storage empty', () => {
  const cfg = loadConfig(fakeStorage());
  assert.equal(cfg.data.seed, defaultConfig.data.seed);
});

test('saveConfig then loadConfig round-trips', () => {
  const s = fakeStorage();
  saveConfig({ ...defaultConfig, brand: { ...defaultConfig.brand, name: 'Acme' } }, s);
  assert.equal(loadConfig(s).brand.name, 'Acme');
});

test('loadConfig merges a partial stored config onto defaults', () => {
  const s = fakeStorage();
  s.setItem('earnings_dashboard_config_v1', JSON.stringify({ data: { seed: 5 } }));
  const cfg = loadConfig(s);
  assert.equal(cfg.data.seed, 5);
  assert.equal(cfg.data.dailyMin, defaultConfig.data.dailyMin);
});

test('exportConfig produces pretty JSON; importConfig parses + merges', () => {
  const json = exportConfig({ ...defaultConfig, data: { ...defaultConfig.data, seed: 9 } });
  assert.match(json, /\n/);
  const cfg = importConfig(json);
  assert.equal(cfg.data.seed, 9);
});

test('importConfig on bad JSON throws a friendly error', () => {
  assert.throws(() => importConfig('{not json'), /Invalid config JSON/);
});
