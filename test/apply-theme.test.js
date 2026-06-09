import { test } from 'node:test';
import assert from 'node:assert/strict';
import { applyTheme } from '../src/theme/apply-theme.js';
import { defaultConfig } from '../src/config/schema.js';

function fakeTarget() {
  const props = {}, attrs = {};
  return {
    props, attrs,
    style: { setProperty: (k, v) => { props[k] = v; } },
    setAttribute: (k, v) => { attrs[k] = v; },
  };
}

test('writes accent, font and radius custom properties', () => {
  const t = fakeTarget();
  applyTheme(defaultConfig, t);
  assert.equal(t.props['--accent'], defaultConfig.theme.accent);
  assert.equal(t.props['--font'], defaultConfig.theme.font);
  assert.equal(t.props['--radius'], defaultConfig.theme.radius + 'px');
});

test('sets data-base attribute for light/dark', () => {
  const t = fakeTarget();
  applyTheme({ ...defaultConfig, theme: { ...defaultConfig.theme, base: 'dark' } }, t);
  assert.equal(t.attrs['data-base'], 'dark');
});

test('derives a soft accent tint custom property', () => {
  const t = fakeTarget();
  applyTheme(defaultConfig, t);
  assert.ok(t.props['--accent-soft']);
});

test('picks black ink on a bright accent and white on a dark one', () => {
  const bright = fakeTarget();
  applyTheme({ ...defaultConfig, theme: { ...defaultConfig.theme, accent: '#ffd014' } }, bright);
  assert.equal(bright.props['--accent-contrast'], '#000000');

  const dark = fakeTarget();
  applyTheme({ ...defaultConfig, theme: { ...defaultConfig.theme, accent: '#15448f' } }, dark);
  assert.equal(dark.props['--accent-contrast'], '#ffffff');
});
