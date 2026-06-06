import { test } from 'node:test';
import assert from 'node:assert/strict';
import { buildChart } from '../src/charts/chart-math.js';

const box = { width: 300, height: 100, padding: 10 };

test('maps the max value to the top padding and min to the bottom', () => {
  const { points } = buildChart([{ amount: 10 }, { amount: 20 }, { amount: 30 }], box);
  assert.equal(points.length, 3);
  const ys = points.map((p) => p.y);
  assert.ok(Math.min(...ys) >= box.padding - 0.001);
  assert.ok(Math.max(...ys) <= box.height - box.padding + 0.001);
  const maxPoint = points[2];
  assert.ok(maxPoint.y <= points[0].y);
});

test('x spans from left padding to width - padding', () => {
  const { points } = buildChart([{ amount: 1 }, { amount: 2 }], box);
  assert.equal(points[0].x, box.padding);
  assert.equal(points[points.length - 1].x, box.width - box.padding);
});

test('produces line and area path strings', () => {
  const { linePath, areaPath } = buildChart([{ amount: 1 }, { amount: 2 }, { amount: 3 }], box);
  assert.match(linePath, /^M/);
  assert.match(areaPath, /Z$/);
});

test('flat series does not divide by zero', () => {
  const { points } = buildChart([{ amount: 5 }, { amount: 5 }], box);
  assert.ok(points.every((p) => Number.isFinite(p.y)));
});

test('empty series returns empty geometry without throwing', () => {
  const { points, linePath, areaPath } = buildChart([], box);
  assert.deepEqual(points, []);
  assert.equal(linePath, '');
  assert.equal(areaPath, '');
});
