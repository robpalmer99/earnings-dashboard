import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createWithdrawMachine, STEPS } from '../src/surfaces/withdraw-machine.js';

const opts = { balance: 4401.86, presets: [500, 1000, 1500] };

test('starts on amount step with zero amount', () => {
  const m = createWithdrawMachine(opts);
  assert.equal(m.getState().step, 'amount');
  assert.equal(m.getState().amount, 0);
});

test('STEPS order is amount → review → processing → complete', () => {
  assert.deepEqual(STEPS, ['amount', 'review', 'processing', 'complete']);
});

test('setAmount clamps to [0, balance]', () => {
  const m = createWithdrawMachine(opts);
  m.setAmount(99999);
  assert.equal(m.getState().amount, 4401.86);
  m.setAmount(-5);
  assert.equal(m.getState().amount, 0);
});

test('selectPreset(max) sets amount to balance', () => {
  const m = createWithdrawMachine(opts);
  m.selectPreset('max');
  assert.equal(m.getState().amount, 4401.86);
});

test('next() is blocked from amount when amount is 0', () => {
  const m = createWithdrawMachine(opts);
  m.next();
  assert.equal(m.getState().step, 'amount');
});

test('happy path advances amount → review → processing → complete', () => {
  const m = createWithdrawMachine(opts);
  m.setAmount(1500);
  m.next();
  assert.equal(m.getState().step, 'review');
  m.next();
  assert.equal(m.getState().step, 'processing');
  m.next();
  assert.equal(m.getState().step, 'complete');
});

test('back() from review returns to amount, preserving amount', () => {
  const m = createWithdrawMachine(opts);
  m.setAmount(1000); m.next();
  m.back();
  assert.equal(m.getState().step, 'amount');
  assert.equal(m.getState().amount, 1000);
});

test('reset() returns to the initial state', () => {
  const m = createWithdrawMachine(opts);
  m.setAmount(1000); m.next(); m.next();
  m.reset();
  assert.equal(m.getState().step, 'amount');
  assert.equal(m.getState().amount, 0);
});

test('complete state exposes a reference id', () => {
  const m = createWithdrawMachine(opts);
  m.setAmount(1500); m.next(); m.next(); m.next();
  assert.match(m.getState().reference, /^[A-Z0-9-]{4,}$/);
});

test('back() is a no-op from the terminal complete step', () => {
  const m = createWithdrawMachine(opts);
  m.setAmount(1500); m.next(); m.next(); m.next();
  assert.equal(m.getState().step, 'complete');
  m.back();
  assert.equal(m.getState().step, 'complete');
});
