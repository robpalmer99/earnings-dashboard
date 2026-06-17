# Named Walkthrough Versions Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add an in-app named list to the control panel that saves a snapshot of the current walkthrough config and reloads it later to reproduce identical stats.

**Architecture:** A new pure storage module (`src/config/versions.js`) persists named config snapshots to `localStorage`, mirroring the existing `persistence.js`. The controller in `main.js` gains an `applyConfig(config)` method (a generalisation of the existing full-replace `resetConfig`) used to load a version. The control panel grows a "Versions" section that saves the current config and lists saved versions with Load/Delete actions. The existing Export/Import/Reset buttons stay as a file-based backup.

**Tech Stack:** Buildless ES modules, `node --test` for unit tests, Playwright for e2e. No new dependencies.

**Spec:** `docs/superpowers/specs/2026-06-17-named-walkthrough-versions-design.md`

---

## File Structure

- **Create** `src/config/versions.js` — pure CRUD over the named-versions localStorage store. Depends only on `./schema.js`.
- **Create** `test/versions.test.js` — unit tests for the module (fake storage).
- **Modify** `src/main.js` — add `controller.applyConfig(config)`; refactor `resetConfig` to use it.
- **Modify** `src/control-panel/control-panel.js` — add the "Versions" UI section + handlers.
- **Modify** `src/styles/control-panel.css` — styles for version rows.
- **Create** `e2e/versions.spec.js` — save → change → load smoke test.

---

## Task 1: Versions storage module

**Files:**
- Create: `src/config/versions.js`
- Test: `test/versions.test.js`

The module stores a JSON array under key `earnings_dashboard_versions_v1`, newest record at the front. Each record is `{ id, name, savedAt, config }`. `saveVersion` overwrites by name (keeping the existing record's `id`) so the list never accumulates duplicates. `loadVersion` returns the snapshot merged onto `defaultConfig` so older snapshots gain defaults for any newly-added schema keys.

- [ ] **Step 1: Write the failing tests**

Create `test/versions.test.js`:

```js
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { listVersions, saveVersion, loadVersion, deleteVersion } from '../src/config/versions.js';
import { defaultConfig } from '../src/config/schema.js';

function fakeStorage() {
  const m = new Map();
  return {
    getItem: (k) => (m.has(k) ? m.get(k) : null),
    setItem: (k, v) => m.set(k, String(v)),
    removeItem: (k) => m.delete(k),
  };
}

test('listVersions is empty for a fresh store', () => {
  assert.deepEqual(listVersions(fakeStorage()), []);
});

test('saveVersion then listVersions returns the record', () => {
  const s = fakeStorage();
  saveVersion('Portrait', { ...defaultConfig, data: { ...defaultConfig.data, seed: 7 } }, s);
  const list = listVersions(s);
  assert.equal(list.length, 1);
  assert.equal(list[0].name, 'Portrait');
  assert.equal(list[0].config.data.seed, 7);
});

test('saveVersion overwrites by name (no duplicates, same id)', () => {
  const s = fakeStorage();
  const first = saveVersion('Demo', defaultConfig, s);
  const second = saveVersion('Demo', { ...defaultConfig, data: { ...defaultConfig.data, seed: 99 } }, s);
  const list = listVersions(s);
  assert.equal(list.length, 1);
  assert.equal(list[0].config.data.seed, 99);
  assert.equal(second.id, first.id);
});

test('listVersions returns newest first', () => {
  const s = fakeStorage();
  saveVersion('A', defaultConfig, s);
  saveVersion('B', defaultConfig, s);
  assert.equal(listVersions(s)[0].name, 'B');
});

test('loadVersion merges snapshot onto defaults', () => {
  const s = fakeStorage();
  const { id } = saveVersion('Sparse', { data: { seed: 3 } }, s);
  const cfg = loadVersion(id, s);
  assert.equal(cfg.data.seed, 3);
  assert.equal(cfg.data.dailyMin, defaultConfig.data.dailyMin);
  assert.equal(cfg.brand.name, defaultConfig.brand.name);
});

test('loadVersion returns null for an unknown id', () => {
  assert.equal(loadVersion('nope', fakeStorage()), null);
});

test('deleteVersion removes the record', () => {
  const s = fakeStorage();
  const { id } = saveVersion('Gone', defaultConfig, s);
  deleteVersion(id, s);
  assert.deepEqual(listVersions(s), []);
});

test('corrupt stored JSON yields an empty list', () => {
  const s = fakeStorage();
  s.setItem('earnings_dashboard_versions_v1', '{not json');
  assert.deepEqual(listVersions(s), []);
});
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `node --test test/versions.test.js`
Expected: FAIL — module `../src/config/versions.js` cannot be resolved (does not exist yet).

- [ ] **Step 3: Implement the module**

Create `src/config/versions.js`:

```js
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
  return Date.now().toString(36) + Math.random().toString(36).slice(2, 6);
}

// Newest record first.
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
```

- [ ] **Step 4: Run the tests to verify they pass**

Run: `node --test test/versions.test.js`
Expected: PASS — all 8 tests pass.

- [ ] **Step 5: Run the full unit suite (no regressions)**

Run: `npm test`
Expected: PASS — existing suites plus the new one.

- [ ] **Step 6: Commit**

```bash
git add src/config/versions.js test/versions.test.js
git commit -m "feat: named-version storage module"
```

---

## Task 2: Controller `applyConfig` method

**Files:**
- Modify: `src/main.js:24-40`

`resetConfig` already does the correct full-replace (set config directly, re-apply theme, persist, rebuild surfaces with `session.payouts` cleared). Generalise that into `applyConfig(config)` and have `resetConfig` delegate to it. Loading a version (Task 3) will call `controller.applyConfig(...)`.

- [ ] **Step 1: Replace the controller's `resetConfig` with `applyConfig` + delegating `resetConfig`**

In `src/main.js`, replace this block:

```js
  // True reset: set the default config directly (not a merge), so stray keys from a
  // previously imported config can't survive a reset.
  resetConfig() {
    applyTheme(defaultConfig);
    saveConfig(defaultConfig);
    store.setState({ ...build(defaultConfig), session: { payouts: [] } });
  },
```

with:

```js
  // Full replace: set config directly (not a merge) and clear session state, so
  // stray keys from a previously loaded config can't survive. Used to load a saved
  // version and to reset.
  applyConfig(config) {
    applyTheme(config);
    saveConfig(config);
    store.setState({ ...build(config), session: { payouts: [] } });
  },
  resetConfig() {
    this.applyConfig(defaultConfig);
  },
```

- [ ] **Step 2: Verify the app still loads and reset still works**

Run: `npm run dev` (serves on http://localhost:8000), open the page, press `⌘K`/`Ctrl+K`, click **Reset**.
Expected: panel re-skins to defaults, no console errors. Stop the dev server when done.

- [ ] **Step 3: Run the unit suite (no regressions)**

Run: `npm test`
Expected: PASS.

- [ ] **Step 4: Commit**

```bash
git add src/main.js
git commit -m "refactor: extract controller.applyConfig from resetConfig"
```

---

## Task 3: Versions UI section in the control panel

**Files:**
- Modify: `src/control-panel/control-panel.js`

Add a "Versions" section directly above the existing `cp-actions` row (Export/Import/Reset). It has a "Save current as version…" button and a list of saved versions, each with Load and Delete buttons. Naming uses `window.prompt`; destructive/overwrite actions use `window.confirm`. The save path is wrapped so a storage failure surfaces an `alert` instead of throwing.

- [ ] **Step 1: Add imports**

At the top of `src/control-panel/control-panel.js`, below the existing imports:

```js
import { listVersions, saveVersion, loadVersion, deleteVersion } from '../config/versions.js';
import { formatDateShort } from '../lib/format.js';
import { isoDate } from '../lib/dates.js';
```

- [ ] **Step 2: Append the Versions section inside `rebuild()`**

In `rebuild()`, immediately **before** the existing `body.append(el('div', { class: 'cp-actions' }, …))` line, insert:

```js
    body.append(section('Versions'),
      el('button', { class: 'cp-btn cp-ver-save', onClick: doSaveVersion }, 'Save current as version…'),
      renderVersions());
```

- [ ] **Step 3: Add the render helper and handlers**

Inside `mount`, after the `doImport` function (and before `return { open, close };`), add:

```js
  function renderVersions() {
    const list = listVersions();
    const wrap = el('div', { class: 'cp-versions' });
    if (!list.length) {
      wrap.append(el('div', { class: 'cp-empty' }, 'No saved versions yet.'));
      return wrap;
    }
    for (const v of list) {
      wrap.append(el('div', { class: 'cp-ver' },
        el('div', { class: 'cp-ver-head' },
          el('span', { class: 'cp-ver-name' }, v.name),
          el('span', { class: 'cp-ver-date' }, formatDateShort(isoDate(new Date(v.savedAt))))),
        el('div', { class: 'cp-ver-acts' },
          el('button', { class: 'cp-btn', onClick: () => doLoad(v) }, 'Load'),
          el('button', { class: 'cp-btn', onClick: () => doDelete(v) }, 'Delete'))));
    }
    return wrap;
  }

  function doSaveVersion() {
    const name = (window.prompt('Name this version:') || '').trim();
    if (!name) return;
    const exists = listVersions().some((v) => v.name === name);
    if (exists && !window.confirm(`Overwrite the existing version “${name}”?`)) return;
    try {
      saveVersion(name, controller.getConfig());
    } catch {
      alert('Could not save version (storage full or unavailable).');
      return;
    }
    rebuild();
  }

  function doLoad(v) {
    if (!window.confirm(`Load “${v.name}”? This replaces the current setup.`)) return;
    const cfg = loadVersion(v.id);
    if (cfg) controller.applyConfig(cfg);
    rebuild();
  }

  function doDelete(v) {
    if (!window.confirm(`Delete “${v.name}”?`)) return;
    deleteVersion(v.id);
    rebuild();
  }
```

- [ ] **Step 4: Manually verify the flow**

Run: `npm run dev`, open http://localhost:8000, press `Ctrl+K`.
Expected: a **Versions** section appears above Export/Import/Reset showing "No saved versions yet." Click **Save current as version…**, enter `Portrait v1` → a row appears with the name and today's date. Change **Available balance**, then click **Load** on the row and accept the confirm → the balance reverts. Stop the dev server.

- [ ] **Step 5: Commit**

```bash
git add src/control-panel/control-panel.js
git commit -m "feat: versions section in control panel"
```

---

## Task 4: Version row styles

**Files:**
- Modify: `src/styles/control-panel.css`

- [ ] **Step 1: Append styles**

Add to the end of `src/styles/control-panel.css`:

```css
.cp-ver-save { width: 100%; margin-bottom: 8px; }
.cp-empty { font-size: 12px; color: var(--ink-mute); padding: 4px 0; }
.cp-ver { border: 1px solid var(--line); border-radius: 8px; padding: 8px; margin-bottom: 6px; }
.cp-ver-head { display: flex; align-items: baseline; justify-content: space-between; margin-bottom: 6px; }
.cp-ver-name { font-size: 13px; font-weight: 700; }
.cp-ver-date { font-size: 10px; color: var(--ink-mute); }
.cp-ver-acts { display: flex; gap: 6px; }
```

- [ ] **Step 2: Verify visually**

Run: `npm run dev`, open the panel, save a version.
Expected: the version row is a bordered card with the name bold on the left, date muted on the right, and two equal-width Load/Delete buttons below. Stop the dev server.

- [ ] **Step 3: Commit**

```bash
git add src/styles/control-panel.css
git commit -m "style: version row cards in control panel"
```

---

## Task 5: End-to-end smoke test

**Files:**
- Create: `e2e/versions.spec.js`

Playwright auto-dismisses native dialogs by default, which would cancel the `prompt`/`confirm` calls. The test registers a single `dialog` handler that accepts every dialog (passing the version name for the prompt; the same `accept(...)` confirms the load).

- [ ] **Step 1: Write the e2e test**

Create `e2e/versions.spec.js`:

```js
import { test, expect } from '@playwright/test';

test.use({ viewport: { width: 390, height: 844 } });

test('save a version, change a setting, load it back', async ({ page }) => {
  // Accept the save prompt (with the name) and every confirm dialog.
  page.on('dialog', (d) => d.accept('Test Version'));
  await page.goto('/');

  const hero = page.locator('.card.hero .amount');
  const heroBefore = await hero.textContent();

  // Open the panel and save the current config as a version.
  await page.keyboard.press('Control+k');
  await page.locator('.cp-ver-save').click();
  await expect(page.locator('.cp-ver-name')).toHaveText('Test Version');

  // Change the available balance; the live balance card updates.
  const balInput = page.locator('.cp-field', { hasText: 'Available balance' }).locator('input');
  await balInput.fill('99999');
  await expect(page.locator('.balance .amount')).toHaveText('$99,999.00');

  // Load the saved version back; the balance and hero revert to the snapshot.
  await page.locator('.cp-ver', { hasText: 'Test Version' }).locator('.cp-btn', { hasText: 'Load' }).click();
  await expect(page.locator('.balance .amount')).toHaveText('$4,401.86');
  await expect(hero).toHaveText(heroBefore);
});
```

- [ ] **Step 2: Run the e2e test**

Run: `npx playwright test e2e/versions.spec.js`
Expected: PASS — 1 test passed. (Playwright auto-starts the python server via `webServer` in `playwright.config.js`.)

- [ ] **Step 3: Run the full e2e suite (no regressions)**

Run: `npx playwright test`
Expected: PASS — existing smoke/realism specs plus the new one.

- [ ] **Step 4: Commit**

```bash
git add e2e/versions.spec.js
git commit -m "test: e2e smoke for named versions"
```

---

## Final verification

- [ ] **Run everything**

Run: `npm test && npx playwright test`
Expected: all unit tests and all e2e tests PASS.
