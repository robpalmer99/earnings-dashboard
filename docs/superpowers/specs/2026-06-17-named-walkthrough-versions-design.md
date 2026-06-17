# Named walkthrough versions — design

**Date:** 2026-06-17
**Status:** Approved, ready for implementation plan

## Problem

When re-recording an alternative version of a walkthrough (e.g. adding a desktop
version after a portrait one was already shot), there is no way to return to the
exact stats used in the original. Tuning is lost the moment the config is changed.

An Export / Import pair already exists (`control-panel.js`), but it is
file-based, easy to miss, and exports collide as a generic `dashboard-config.json`.
The need is a fast, discoverable, **in-app** way to save a named version of a
walkthrough and reload it later.

## What a "version" is

A snapshot of the **config object** captured at save time — every control-panel
setting: `brand`, `theme`, `locale`, all `data` numbers (including `seed`),
`surfaces`, `withdraw`, `payouts`.

Because all stats (chart, deltas, balances, payout history) are generated
**deterministically** from `seed` + the `data` numbers, reloading a version
reproduces the identical dashboard — a pristine starting point to re-record from.

A version does **not** capture mid-walkthrough live runtime state (a withdrawal
already performed on screen, session payout rows, decremented balance). Loading a
version yields the pristine starting state, not a paused-mid-demo state. This is
the intended behaviour.

## Storage choice

In-app named list persisted in `localStorage` (per-browser). The existing
file-based **Export / Import** buttons are retained unchanged as a
backup/portability escape hatch — `localStorage` is per-browser and is wiped by
clearing browsing data, so files remain the cross-machine safety net.

## Architecture

Three small pieces, each mirroring patterns already in the codebase.

### 1. New module `src/config/versions.js`

Pure storage logic, styled exactly like the existing `src/config/persistence.js`:
the same injected-`storage` pattern (`resolveStorage` fallback for non-browser /
test contexts), a separate localStorage key, and JSON-parse-with-fallback.

- **Key:** `earnings_dashboard_versions_v1` (distinct from the live config key
  `earnings_dashboard_config_v1`).
- **Stored shape:** a JSON array of version records, each:
  ```js
  { id: string, name: string, savedAt: number, config: object }
  ```
  - `id` — unique identifier (timestamp-based string is sufficient; app runtime,
    so `Date.now()` is available).
  - `savedAt` — `Date.now()` at save, for display.
  - `config` — the snapshotted config object.

- **Functions:**
  - `listVersions(storage)` → array of records, **newest first**. Returns `[]`
    if the store is empty or the stored JSON is corrupt (same defensive fallback
    as `loadConfig`).
  - `saveVersion(name, config, storage)` → saves a snapshot.
    **Save-by-name overwrites:** if a version with the same `name` already exists,
    update its `config` and `savedAt` in place rather than appending a duplicate.
    Keeps the list clean. Returns the saved record.
  - `loadVersion(id, storage)` → returns `mergeConfig(defaultConfig, saved.config)`
    so snapshots that predate newly-added schema keys still receive sane defaults
    (forward-compatible as the schema grows). Returns `null` if the id is absent.
  - `deleteVersion(id, storage)` → removes the record. No-op if absent.

- **Dependencies:** only `./schema.js` (`defaultConfig`, `mergeConfig`) — the same
  single dependency `persistence.js` has. Self-contained and unit-testable.

### 2. Controller method in `src/main.js`

`resetConfig` already performs the correct *full-replace* behaviour (set config
directly — not a merge — so stray keys from a previously loaded config cannot
survive; re-apply theme; persist; rebuild surfaces with `session.payouts` cleared).

Refactor so that full-replace logic is shared, then expose it:

- `applyConfig(config)` — full replace: `applyTheme(config)` → `saveConfig(config)`
  → `store.setState({ ...build(config), session: { payouts: [] } })`.
- `resetConfig()` becomes `applyConfig(defaultConfig)`.
- Loading a version calls `applyConfig(loadVersion(id))`.

The loaded config thereby also becomes the live persisted config, surviving a page
reload like any other change.

### 3. UI — "Versions" section in `src/control-panel/control-panel.js`

A new section slotted **above** the existing Export / Import / Reset action row.
Section order becomes: Preset → Brand → … → Surfaces → **Versions** → actions.

Layout:

```
─── Versions ───────────────────
 [ Save current as version… ]

 Portrait v1          Jun 17
   [ Load ]  [ Delete ]
 Desktop demo         Jun 15
   [ Load ]  [ Delete ]
─────────────────────────────────
 [ Export ] [ Import ] [ Reset ]   ← unchanged
```

Interactions:

- **Save current as version…** → `window.prompt` for a name (buildless; no custom
  modal). Empty or cancelled input → no-op. If the entered name matches an existing
  version, `confirm` before overwriting. On success, save via
  `saveVersion(name, controller.getConfig(), …)` and re-render the list.
- **Load** → `confirm("Load '<name>'? This replaces the current setup.")` →
  `controller.applyConfig(loadVersion(id))` → `rebuild()` the panel.
- **Delete** → `confirm` → `deleteVersion(id)` → re-render the list.
- Each row shows the version **name** plus the **saved date** (from `savedAt`,
  formatted with the existing `dates.js` / `format.js` helpers).
- **Empty state:** when no versions exist, show a muted line —
  *"No saved versions yet."*

Error handling: storage operations are wrapped so a quota-exceeded or
disabled-localStorage failure surfaces a simple `alert` rather than throwing
silently — the same defensive posture as `persistence.js`.

The existing Export / Import / Reset buttons are unchanged.

## Testing

- **Unit tests** for `versions.js` (`test/versions.test.js`), against an in-memory
  fake storage object, mirroring `test/persistence.test.js`:
  - save → `listVersions` returns it
  - save-by-name with an existing name overwrites (one record, updated config)
  - newest-first ordering
  - `loadVersion` returns config merged onto `defaultConfig` (missing key gets
    default)
  - `loadVersion` of an unknown id returns `null`
  - `deleteVersion` removes the record
  - corrupt stored JSON → `listVersions` returns `[]`
- **One e2e smoke** (Playwright, matching the existing `e2e/` realism smoke):
  open panel → save a version → tweak a `data` value → load the version back →
  assert a stat reverted to the snapshot value.

## Out of scope (YAGNI)

- Rename in place (delete + re-save covers it).
- Cloud/cross-device sync (Export/Import files cover portability).
- Capturing mid-walkthrough runtime state (explicitly not wanted).
