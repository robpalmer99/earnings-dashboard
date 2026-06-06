import { test } from 'node:test';
import assert from 'node:assert/strict';
import { makeRng } from '../src/lib/rng.js';

test('same seed produces identical sequence', () => {
  const a = makeRng(42), b = makeRng(42);
  const seqA = [a(), a(), a(), a()];
  const seqB = [b(), b(), b(), b()];
  assert.deepEqual(seqA, seqB);
});

test('different seeds diverge', () => {
  const a = makeRng(1), b = makeRng(2);
  assert.notEqual(a(), b());
});

test('values are in [0,1)', () => {
  const r = makeRng(7);
  for (let i = 0; i < 100; i++) {
    const v = r();
    assert.ok(v >= 0 && v < 1, `out of range: ${v}`);
  }
});
