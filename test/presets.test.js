import { test } from 'node:test';
import assert from 'node:assert/strict';
import { presets, applyPreset } from '../src/config/presets.js';
import { defaultConfig } from '../src/config/schema.js';

test('presets are named partial configs', () => {
  assert.ok(presets.length >= 3);
  for (const p of presets) {
    assert.ok(p.id && p.label && p.patch);
  }
});

test('applyPreset merges a preset patch onto a config', () => {
  const green = presets.find((p) => p.id === 'crypto-green');
  const merged = applyPreset(defaultConfig, 'crypto-green');
  assert.equal(merged.theme.accent, green.patch.theme.accent);
});

test('applyPreset with unknown id returns config unchanged', () => {
  const merged = applyPreset(defaultConfig, 'nope');
  assert.deepEqual(merged, defaultConfig);
});
