# Multi-Package Refactor Plan

Splitting Files Workbench into distinct, reusable packages. The original monolith
(`files-workbench2`, a mirror of `origin/development`) is the **read-only reference**;
this repo (branch `refactor/multi-package`) becomes the trimmed-down app that imports
the extracted packages.

## Packages

| Package | Directory | Contents |
|---|---|---|
| *(private, no package)* | `files-workbench-app` | The Electron app / finished product: Electron shell, assembly root, app slices (file ops, menus, selection wiring), first-party plugins, config, packaging |
| `@files-workbench/core` | `files-workbench-core` | The data layer: the Go server (data + control) **and** the JS client library that talks to it (`fs-api`, `explorer-api`, `sw-queue` + service worker, `plugin-rpc`, `api-config`) |
| `@workbench/framework` | `workbench-framework` | The Workbench API as a light reusable framework: activity host + frozen facade, command/keybinding/hook/menu registries, dynamic view registry, UI model classes, plugin model (manifest/permissions), plugin host + permission-scoped API, layout-grid engine. Built on `@vue/reactivity` (stores only — no Vue components/renderer) |
| `@workbench/vue` | `workbench-ui-vue` | The Vue UI kit: shell (TitleBar, MenuBar, ActivityBar, StatusBar, side bars/panel), layout system (SplitView/SplitSection/Sash/ViewContainer/ViewContentHost), editor grid (Editor, GridView, EditorGroup, TabContentHost, tab strips), floating UI (ContextMenu, FloatingMenu, Tooltip, Hint, CommandPalette, ModalEditor/ModalHost, LightboxHost, PeekHost), interaction composables (drag systems, click debounce, sash resize), theming CSS. Exposes `<WorkbenchApp />` bound to a `Workbench` instance |
| `@workbench/plugin-sdk` | `workbench-framework-plugin-sdk` | What plugin projects import at dev time (successor of `@fw/sdk`): the permission-scoped Workbench API surface, UI model classes, manifest schema, server-plugin SDK (WASM `ServerPlugin`). At runtime, imports mount onto the real app's Workbench API |
| `@workbench/react` / `@workbench/solid` | `workbench-ui-react` / `workbench-ui-solid` | Future UI kits — same framework contract, different renderer |

Cross-linking during development: packages are not on npm; use
`npm install /path/to/local/package` to propagate a version into a consumer.

## Decisions

- **Core = Go server + JS client together** — the protocol stays versioned in one repo.
- **Framework reactivity = `@vue/reactivity`** — standalone reactive stores; the Vue kit
  consumes them natively, React/Solid adapters subscribe via `watch`/`effect` later.
- **App tooling = plain Vite + Vue** (drop Nuxt/Nitro) — the extraction forces explicit
  imports anyway; dev media previews fetch the Go server directly (CORS is permissive)
  instead of the Nitro proxy workaround.
- **Language = JS + JSDoc**, shipping generated `.d.ts` for framework/SDK surfaces —
  porting stays pure code-movement; per-package TS conversion possible later.
- **Host UI is not assumed to be Electron** — browser and Tauri remain valid hosts;
  Electron-specific behavior stays in the app.

## Milestones

Each milestone ends with the app runnable and verified before anything is committed.

- [x] **M1 — Nuxt → Vite conversion** (in-place, this repo). Explicit imports everywhere
      (auto-imports hid the dependency graph), `vite.config.js` + `index.html` +
      `main.js` entry, Nitro `/media-preview` + `/text-preview` routes replaced with
      direct Go-server fetches, `sw.client.js` registration moved to `main.js`,
      Electron dev/build scripts ported, docs updated. Verified 2026-07-19 (Mic +
      agent browser session: tree nav, directory tabs, thumbnails, preview, source
      control, icons, all 10 plugins load; Electron window launches). Bonus: the
      material-icon-theme plugin now lives in the standalone
      `files-workbench-material-icons` package (`../files-workbench-plugins/`),
      consumed via a root `file:` install — the first external plugin project.
      Not yet exercised: a full `build:electron` packaging run.
- [x] **M2 — `@workbench/framework`** extracted. Registries, host, facade, UI/plugin
      models, plugin host on `@vue/reactivity`; app imports it.
      *Implemented + verified 2026-07-19; repo `../workbench-framework` (github
      workbench-framework), initial commit `113d10b`.
      26 modules moved to `workbench-framework/src/` (83 public exports), three app
      couplings inverted: the host takes an `activities` param (surfaces registered
      by `activities/index.js` at import), `getActivity` fallback dropped, and the
      plugin `server` slice uses host-supplied `services.callPluginRpc` instead of
      importing the app's RPC bridge. Reactivity via `@vue/reactivity` only (see
      `src/reactivity.js`), single-instance enforced by `resolve.dedupe` in
      vite.config; note the standalone `watch` flushes sync (vs Vue's pre-flush) —
      no misbehavior observed. Verified in-browser: boot, 10 plugins, icons, SCM
      (rpc injection), palette + chords, Settings/Shortcuts modals, plugin hot
      disable→"Unknown view"→re-enable heals live, selection→preview/status
      reactivity, lightbox, editor split/preset; `vite build` clean.*
- [x] **M3 — `@workbench/vue`** extracted. Components + interaction composables +
      theming; app imports `<WorkbenchApp />` and friends.
      *Implemented + verified 2026-07-19 (Mic + agent); repo `../workbench-ui-vue`
      (github workbench-ui-vue), initial commit `1de533d`; framework gained the
      Workbench instance in `9d5f1f1`. 40 components (layout system, editor grid, shell chrome incl.
      notifications, floating UI, hosts/primitives) + all 10 interaction
      composables + time/popup-position/uuid utils moved to
      `workbench-ui-vue/src/` (index.js exports everything named by SFC name).
      App rewired in 16 files (default component imports → named kit imports);
      `resolve.dedupe` extended with `@mdi/js` + `@workbench/framework`
      (symlinked-package bare imports must resolve to the app's node_modules).
      Verified in-browser: boot with full layout restore, context menu, palette,
      split/merge, notifications panel, preview/selection, SCM; `vite build`
      clean. Stage 2 (approved design) also done: `createWorkbench()` /
      `new Workbench()` in the framework (ties the activity host + facade +
      plugin host under one instance; ensures activity-surface registration),
      `<WorkbenchApp :workbench>` in the kit (composition root — provides
      `viewCtx`/`workbench` to the tree and owns the registry-driven overlay
      surfaces: ModalHost, LightboxHost, PeekHost), and the theming CSS moved to
      `@workbench/vue/styles/workbench.css` (imported by the app's main.js).
      Workbench.vue now wraps its chrome in `<WorkbenchApp>`; further chrome
      absorption into WorkbenchApp is future work (M6-ish). Verified in-browser
      after stage 2: boot, Settings modal via palette, lightbox, panels;
      build clean.*
- [x] **M4 — `@files-workbench/core`** extracted. Go server + JS client move out; app
      spawns/bundles the server from the package.
      *Implemented + verified 2026-07-19 (Mic + agent); repo
      `../files-workbench-core` (github files-workbench-core), initial commit
      `0131d6d`. `server/v1` → `files-workbench-core/server/` (dev fallbacks now
      package-relative; the app's `dev:server` passes FW_CONFIG_DIR/FW_DATA_DIR/
      FW_PLUGINS_DIR pointing at the app tree — same contract as packaged
      Electron); 8 JS libs → `files-workbench-core/src/` (47 exports; imported as
      '@files-workbench/core' across 18 app files + plugin-sdk). `client/lib/`
      retains only capability-scan.mjs (M5). public/sw.js stays app-side (root
      SW scope); its ENDPOINTS map must stay in sync with core's sw-queue.js.
      build-server.js + electron-builder extraResources point at the package.
      Verified: go build + vite build clean; server boots from the package (icon
      pack, WASM scm, artifacts, prefs); browser pass incl. an end-to-end WRITE
      (UI rename → sw-queue → control server → disk). Docs updated. Orphan noted:
      composables/useRpc.js has no importers.*
- [ ] **M5 — `@workbench/plugin-sdk`** extracted. Plugin build rewired to externalize
      the new SDK; first-party plugins compile against it.
- [ ] **M6 — App cleanup.** What remains here: Electron shell, assembly root, app
      slices, first-party plugins, config, packaging. Docs updated.

## Working rules

- `/home/mic/dev/projects/files-workbench2` is read-only reference. Never modify.
- No commits until Mic verifies the current state works — no broken/WIP commits.
- Focus on one whole part at a time; keep the packages in sync with each other.
