import { test } from 'node:test';
import assert from 'node:assert/strict';
import { lerp, easeOutExpo } from '../src/lib/animate.js';

test('lerp interpolates endpoints', () => {
  assert.equal(lerp(0, 10, 0), 0);
  assert.equal(lerp(0, 10, 1), 10);
  assert.equal(lerp(0, 10, 0.5), 5);
});

test('easeOutExpo is 0 at 0 and 1 at 1 and monotonic', () => {
  assert.equal(easeOutExpo(0), 0);
  assert.equal(easeOutExpo(1), 1);
  assert.ok(easeOutExpo(0.4) < easeOutExpo(0.6));
});
