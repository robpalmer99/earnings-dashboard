import { defaultConfig, mergeConfig } from './schema.js';

const KEY = 'earnings_dashboard_config_v1';

function resolveStorage(storage) {
  if (storage) return storage;
  if (typeof localStorage !== 'undefined') return localStorage;
  return { getItem: () => null, setItem: () => {}, removeItem: () => {} };
}

export function loadConfig(storage) {
  const s = resolveStorage(storage);
  const raw = s.getItem(KEY);
  if (!raw) return mergeConfig(defaultConfig, {});
  try {
    return mergeConfig(defaultConfig, JSON.parse(raw));
  } catch {
    return mergeConfig(defaultConfig, {});
  }
}

export function saveConfig(config, storage) {
  resolveStorage(storage).setItem(KEY, JSON.stringify(config));
}

export function exportConfig(config) {
  return JSON.stringify(config, null, 2);
}

export function importConfig(json) {
  let parsed;
  try {
    parsed = JSON.parse(json);
  } catch {
    throw new Error('Invalid config JSON');
  }
  return mergeConfig(defaultConfig, parsed);
}
