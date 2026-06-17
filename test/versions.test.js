import { test } from 'node:test';
import assert from 'node:assert/strict';
import { listVersions, saveVersion, loadVersion, deleteVersion } from '../src/config/versions.js';
import { defaultConfig } from '../src/config/schema.js';

function fakeStorage() {
  const m = new Map();
  return {
    getItem: (k) => (m.has(k) ? m.get(k) : null),
    setItem: (k, v) => m.set(k, String(v)),
    removeItem: (k) => m.delete(k),
  };
}

test('listVersions is empty for a fresh store', () => {
  assert.deepEqual(listVersions(fakeStorage()), []);
});

test('saveVersion then listVersions returns the record', () => {
  const s = fakeStorage();
  saveVersion('Portrait', { ...defaultConfig, data: { ...defaultConfig.data, seed: 7 } }, s);
  const list = listVersions(s);
  assert.equal(list.length, 1);
  assert.equal(list[0].name, 'Portrait');
  assert.equal(list[0].config.data.seed, 7);
});

test('saveVersion overwrites by name (no duplicates, same id)', () => {
  const s = fakeStorage();
  const first = saveVersion('Demo', defaultConfig, s);
  const second = saveVersion('Demo', { ...defaultConfig, data: { ...defaultConfig.data, seed: 99 } }, s);
  const list = listVersions(s);
  assert.equal(list.length, 1);
  assert.equal(list[0].config.data.seed, 99);
  assert.equal(second.id, first.id);
});

test('listVersions returns newest first', () => {
  const s = fakeStorage();
  saveVersion('A', defaultConfig, s);
  saveVersion('B', defaultConfig, s);
  assert.equal(listVersions(s)[0].name, 'B');
});

test('loadVersion merges snapshot onto defaults', () => {
  const s = fakeStorage();
  const { id } = saveVersion('Sparse', { data: { seed: 3 } }, s);
  const cfg = loadVersion(id, s);
  assert.equal(cfg.data.seed, 3);
  assert.equal(cfg.data.dailyMin, defaultConfig.data.dailyMin);
  assert.equal(cfg.brand.name, defaultConfig.brand.name);
});

test('loadVersion returns null for an unknown id', () => {
  assert.equal(loadVersion('nope', fakeStorage()), null);
});

test('deleteVersion removes the record', () => {
  const s = fakeStorage();
  const { id } = saveVersion('Gone', defaultConfig, s);
  deleteVersion(id, s);
  assert.deepEqual(listVersions(s), []);
});

test('corrupt stored JSON yields an empty list', () => {
  const s = fakeStorage();
  s.setItem('earnings_dashboard_versions_v1', '{not json');
  assert.deepEqual(listVersions(s), []);
});
