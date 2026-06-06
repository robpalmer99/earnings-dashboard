import { test } from 'node:test';
import assert from 'node:assert/strict';
import { isoDate, addDays, monthKey } from '../src/lib/dates.js';

test('isoDate formats a Date as YYYY-MM-DD (UTC)', () => {
  assert.equal(isoDate(new Date('2026-06-06T15:30:00Z')), '2026-06-06');
});

test('addDays subtracts/adds in UTC without TZ drift', () => {
  assert.equal(addDays('2026-06-06', -1), '2026-06-05');
  assert.equal(addDays('2026-03-01', -1), '2026-02-28');
  assert.equal(addDays('2026-06-06', 7), '2026-06-13');
});

test('monthKey returns YYYY-MM', () => {
  assert.equal(monthKey('2026-06-06'), '2026-06');
});
