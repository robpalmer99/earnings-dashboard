import { test } from 'node:test';
import assert from 'node:assert/strict';
import { isoDate, addDays, monthKey } from '../src/lib/dates.js';

test('isoDate uses the local calendar date, not UTC', () => {
  // TZ-neutral: isoDate must agree with the local-component formula in ANY
  // environment. The old toISOString() implementation fails this in UTC+ zones.
  const d = new Date('2026-06-13T02:00:00Z');
  const pad = (n) => String(n).padStart(2, '0');
  const localDay = `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
  assert.equal(isoDate(d), localDay);
  // Dates built from local components are always the local day, any offset.
  assert.equal(isoDate(new Date(2026, 5, 12, 23, 30)), '2026-06-12');
  assert.equal(isoDate(new Date(2026, 5, 12, 0, 10)), '2026-06-12');
});

test('addDays is pure string arithmetic regardless of timezone', () => {
  assert.equal(addDays('2026-06-12', 1), '2026-06-13');
  assert.equal(addDays('2026-06-01', -1), '2026-05-31');
  assert.equal(addDays('2026-01-01', -1), '2025-12-31');
  assert.equal(addDays('2026-03-01', -1), '2026-02-28'); // non-leap Feb boundary
});

test('monthKey returns YYYY-MM', () => {
  assert.equal(monthKey('2026-06-06'), '2026-06');
});
