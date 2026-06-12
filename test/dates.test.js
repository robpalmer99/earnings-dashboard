import { test } from 'node:test';
import assert from 'node:assert/strict';
import { isoDate, addDays, monthKey } from '../src/lib/dates.js';

test('isoDate uses the local calendar date, not UTC', () => {
  // 23:30 local on Jun 12 — toISOString() flips to Jun 13 in UTC-negative
  // zones and stays Jun 12 in UTC+; local components are always Jun 12.
  assert.equal(isoDate(new Date(2026, 5, 12, 23, 30)), '2026-06-12');
  assert.equal(isoDate(new Date(2026, 5, 12, 0, 10)), '2026-06-12');
});

test('addDays is pure string arithmetic regardless of timezone', () => {
  assert.equal(addDays('2026-06-12', 1), '2026-06-13');
  assert.equal(addDays('2026-06-01', -1), '2026-05-31');
  assert.equal(addDays('2026-01-01', -1), '2025-12-31');
});

test('monthKey returns YYYY-MM', () => {
  assert.equal(monthKey('2026-06-06'), '2026-06');
});
