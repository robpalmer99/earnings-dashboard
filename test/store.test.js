import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createStore } from '../src/store.js';

test('getState returns initial state', () => {
  const s = createStore({ count: 1 });
  assert.deepEqual(s.getState(), { count: 1 });
});

test('setState shallow-merges and notifies subscribers', () => {
  const s = createStore({ count: 1, name: 'a' });
  let seen = null;
  s.subscribe((state) => { seen = state; });
  s.setState({ count: 2 });
  assert.deepEqual(s.getState(), { count: 2, name: 'a' });
  assert.deepEqual(seen, { count: 2, name: 'a' });
});

test('setState accepts an updater function', () => {
  const s = createStore({ count: 1 });
  s.setState((prev) => ({ count: prev.count + 1 }));
  assert.equal(s.getState().count, 2);
});

test('unsubscribe stops notifications', () => {
  const s = createStore({ count: 0 });
  let calls = 0;
  const off = s.subscribe(() => { calls++; });
  s.setState({ count: 1 });
  off();
  s.setState({ count: 2 });
  assert.equal(calls, 1);
});

test('functional setState supports runtime balance decrement + session payout', () => {
  const store = createStore({
    config: {},
    data: { balance: 4401.86 },
    session: { payouts: [] },
  });
  const amount = 750;
  store.setState((s) => ({
    data: { ...s.data, balance: Math.round((s.data.balance - amount) * 100) / 100 },
    session: { payouts: [{ date: 'now', amount, status: 'Completed' }, ...s.session.payouts] },
  }));
  assert.equal(store.getState().data.balance, 3651.86);
  assert.equal(store.getState().session.payouts[0].date, 'now');
});
