import { test } from 'node:test';
import assert from 'node:assert/strict';
import { formatCurrency, formatPercent, formatDateShort } from '../src/lib/format.js';

test('formatCurrency USD', () => {
  assert.equal(formatCurrency(1467, { currency: 'USD', locale: 'en-US' }), '$1,467.00');
});

test('formatCurrency GBP', () => {
  assert.equal(formatCurrency(4401.86, { currency: 'GBP', locale: 'en-GB' }), '£4,401.86');
});

test('formatPercent keeps one decimal and sign', () => {
  assert.equal(formatPercent(27.34), '27.3%');
  assert.equal(formatPercent(-3.1), '-3.1%');
});

test('formatDateShort renders weekday + month + day', () => {
  assert.equal(formatDateShort('2026-06-04', 'en-US'), 'Thu, Jun 4');
});
