import { test } from 'node:test';
import assert from 'node:assert/strict';
import { defaultConfig, mergeConfig } from '../src/config/schema.js';

test('defaultConfig has the expected groups', () => {
  for (const k of ['brand', 'theme', 'locale', 'data', 'surfaces', 'withdraw', 'payouts']) {
    assert.ok(defaultConfig[k], `missing ${k}`);
  }
});

test('mergeConfig deep-merges without mutating defaults', () => {
  const merged = mergeConfig(defaultConfig, { brand: { name: 'Acme' }, data: { seed: 7 } });
  assert.equal(merged.brand.name, 'Acme');
  assert.equal(merged.data.seed, 7);
  assert.equal(merged.theme.accent, defaultConfig.theme.accent);
  assert.equal(merged.data.dailyMin, defaultConfig.data.dailyMin);
  assert.notEqual(defaultConfig.brand.name, 'Acme');
});

test('surfaces default all visible', () => {
  assert.equal(defaultConfig.surfaces.statCards, true);
  assert.equal(defaultConfig.surfaces.graph, true);
  assert.equal(defaultConfig.surfaces.balance, true);
  assert.equal(defaultConfig.surfaces.tables, true);
});

test('camera-realism defaults present', () => {
  assert.equal(defaultConfig.data.forcePositiveDeltas, true);
  assert.equal(defaultConfig.data.weekendDip, false);
  assert.equal(defaultConfig.surfaces.payouts, true);
  assert.equal(defaultConfig.surfaces.tabBar, true);
  assert.equal(defaultConfig.payouts.count, 4);
});
