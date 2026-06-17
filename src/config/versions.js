import { defaultConfig, mergeConfig } from './schema.js';

const KEY = 'earnings_dashboard_versions_v1';

function resolveStorage(storage) {
  if (storage) return storage;
  if (typeof localStorage !== 'undefined') return localStorage;
  return { getItem: () => null, setItem: () => {}, removeItem: () => {} };
}

function readAll(storage) {
  const raw = resolveStorage(storage).getItem(KEY);
  if (!raw) return [];
  try {
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function writeAll(list, storage) {
  resolveStorage(storage).setItem(KEY, JSON.stringify(list));
}

function makeId() {
  if (typeof crypto !== 'undefined' && crypto.randomUUID) return crypto.randomUUID();
  return Date.now().toString(36) + Math.random().toString(36).slice(2);
}

// Records in insertion order — saveVersion unshifts, so newest is first.
export function listVersions(storage) {
  return readAll(storage);
}

// Overwrite by name: reuse the existing record's id, move it to the front.
export function saveVersion(name, config, storage) {
  const all = readAll(storage);
  const existing = all.find((v) => v.name === name);
  const list = all.filter((v) => v.name !== name);
  const record = { id: existing ? existing.id : makeId(), name, savedAt: Date.now(), config };
  list.unshift(record);
  writeAll(list, storage);
  return record;
}

// Merge onto defaults so snapshots predating new schema keys still get defaults.
export function loadVersion(id, storage) {
  const found = readAll(storage).find((v) => v.id === id);
  return found ? mergeConfig(defaultConfig, found.config) : null;
}

export function deleteVersion(id, storage) {
  writeAll(readAll(storage).filter((v) => v.id !== id), storage);
}
