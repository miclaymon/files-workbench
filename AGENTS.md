# Agent Guide — Files Workbench 2

Instructions for AI coding agents (Claude Code, etc.) working in this repository.

## Repository at a glance

- **Frontend**: Nuxt 3 SPA (`client/`) served by Vite in dev and compiled to static in production. Runs inside Electron for the desktop app.
- **Backend**: Go HTTP server (`server/v1/`) — data server on port 8001, control server on port 8002. All routes under `/_api/v1/`.
- **Dev proxy**: Nuxt/Vite proxies `/_api/v1/*` to port 8001 (data). Write ops contact port 8002 directly via `CONTROL_BASE`. The proxy silently drops large binary responses — use Nitro server routes for file preview content (see below).

## Component architecture

```
Workbench.vue                  Root shell: titlebar, activity bar, sidebar, editor grid, panels
├── ExplorerPanel.vue          Sidebar left panel (composable-driven via useDirectoryFileTree lazy mode)
│   └── TreeList.vue
│       └── TreeItem.vue       Recursive tree node
├── GridView.vue               Recursive editor split-grid (Sash.vue resize handles between siblings)
│   └── EditorGroup.vue        Editor group: tab strip + active tab content (DropOverlay.vue shows drop zones)
│       └── TabContentHost.vue Resolves the active tab's `kind` → registered tab view (editor twin of ViewContentHost)
│           ├── HomePage.vue            (Workbench activity · tab view "home")
│           └── DirectoryTab.vue        (Explorer activity · tab view "directory") — owns fetch + nav history
│               └── DirectoryPanel.vue       Navigation header, sort/filter state, layout switcher
│                   └── DirectoryLayout.vue  Unified layout component — all view modes via CSS data-layout attr
└── (Secondary Side Bar / Bottom Panel views are contributed by first-party plugins —
     Preview / Details / Debug live under client/builtin-plugins/, see Plugin system)
```

Preview's component tree (now `client/builtin-plugins/preview/src/components/`):

```
PreviewPanel.vue               Dispatches to per-type preview components
└── preview/{ImagePreview,VideoPreview,AudioPreview,TextPreview,HtmlPreview}.vue
```

## Activity system

The workbench is organized into **activities** — self-contained feature modules. Only the core `workbench` shell is in-core in `client/activities/`; `explorer`, `preview`, `details`, `debug`, `chat`, `search`, `storage`, and `converter` are contributed by first-party **plugins** (`client/builtin-plugins/`) — they are still activities, just registered through the plugin host rather than compiled into `ACTIVITIES`. (`chat`/`search`/`storage`/`converter` are placeholder panels awaiting their roadmap build-out.) Each declares the surfaces it contributes and, optionally, a runtime **API** for collaboration. This is the foundation of the plugin system (see **Plugin system** below) — first-party activities use the same internal API a plugin does, narrowed by permission.

**Activity definition** (default export of each `activities/*.js`):

```
{
  id, label, icon, core?,
  setup(ctx) → api,                       // optional; ctx = { api, host, editor, prefs, services, log }
                                          // call api.commands/keybindings/menus/hooks.register(…) here
  tabViews:    { [viewId]: { kind, label, icon, component, props(tab, ctx) } },
  panelViews:  { [viewId]: { label, icon, location?, component?, sections?, acceptsSections?, actions?, props?, on? } },
  sections:    { [sectionId]: { label, icon, homeView, component, props(ctx), on(ctx), actions, … } },
  statusViews: { [id]: { region: 'left'|'right', order, component } },
  modals:      { [id]: { label, icon, component, width?, height?, props(ctx), on(ctx), actions? } },
}
```

A `panelView` with `location: 'PrimarySideBar'` becomes an Activity Bar entry (the bar + primary sidebar are registry-driven, not hardcoded). `modals` are opened by id via `facade.modals.open(...)` and rendered in the shared `ui/ModalEditor.vue` chrome (Settings + Keyboard Shortcuts are modals on the Workbench activity).

**Three surfaces, rendered by id:**
- **tab views** → `editor/TabContentHost.vue` resolves a tab's runtime `kind` → tab view → component; listeners pass through via `$attrs` (so the EditorGroup → Editor → Workbench event chain is unchanged), and the mounted instance is handed back via `registerInstance` so EditorGroup keeps its imperative handle (refresh / optimistic rename).
- **panel views + sections** → unchanged; `ViewContentHost.vue` + the SplitView system render them. `useViewRegistry.js` just sources them from activities now.
- **status views** → `shell/StatusBar.vue` is a host that renders the registered widgets by region (`shell/status/*`); each widget injects the host and **self-gates** (renders nothing when it has no data).

**The activity host** (`composables/activity/useActivityHost.js`) instantiates each activity's API and is `provide()`d as `viewCtx` (it replaced the old hand-built bag). Public surface used by registry entries / widgets / other activities:
- `api(id)` / `requireApi(id)` — query another activity's API.
- `selection` — reactive **capability**: the *active* activity's published selection snapshot (`{ selectedItems, focusedItem, selectedPath, details }`) or `null`. Preview/Details read this and self-gate on `null`.
- `on` / `once` / `emit` — app-level pub/sub. Events: `active-tab-change`, `active-activity-change`.
- `log(category, msg, data)` — delegates to the Debug activity's logger.
- `activeTab`, `activeActivityId`, `activeGroupId`, `editorRoot`, `prefs`.
- Workbench `Object.assign`s its slice handlers (`handleRename`, `doMove`, `showItemContextMenu`, modals, `setRef`, status refs) onto the host so existing entries reach them. **These are app internals, not the eventual public plugin API.**

**Two collaboration mechanisms:**
1. **Reactive capability pull** — read `host.selection` / `host.api(id).<ref>` in a computed/template; Vue updates it automatically. Used by Preview/Details and the status widgets.
2. **Event push** — `composables/activity/useEmitter.js` (`createEmitter` → `on`/`once`/`off`/`emit`/`clear`). A provider activity owns an emitter and `emit`s on change (Explorer emits `selection-change`); subscribe via `host.api('explorer').on('selection-change', cb)`. Use for imperative side effects (prefetch, logging) and non-Vue consumers.

**Ownership:** Explorer owns the selection + dir-stats context (its `setup` wraps the existing `useSelection` slice, exposes the `selection` capability + `dirStats`, emits `selection-change`); Workbench pulls the selection refs/handlers from `host.api('explorer')` and feeds them to the file-op / menu / keyboard slices unchanged. Debug is a *provider* (exposes `log`). Preview/Details are *consumers*.

**Contribution registries (`host.facade`)** — the frozen public surface handed to `setup` as `api` (and the eventual plugin import). It is the *registration/query* surface, distinct from `ctx` (the host) that a command's `run(ctx)` receives:
- `commands.register/execute/get/list/isEnabled` — **commands are the single source of truth** for invokable behaviour. A command is `{ id, title, category?, icon?, when?(ctx), toggled?(ctx), run(ctx, …args), palette? }`. Workbench registers the app catalog (`editor.*` / `edit.*` / `file.*` / `view.*` / `workbench.*`); activities register their own (e.g. `debug.clearLog`).
- `keybindings.register({ key, command, args?, when?, allowInInput? })` — chord → command; dispatcher is `useWorkbenchKeyboard`; `cmd`/`meta` fold to `ctrl`.
- `menus.register(menuId, { command|items|build, group?, order?, when? })` + `menus.items(menuId, ctx)` — app-level menu contributions. Menu ids: `menubar/{file,edit,view,settings}`, `editor/tab`, `directory/{item,background,right-drag}`. Owner menus build their base items directly; contributions append.
- `hooks.add(name, fn, order)` / `apply(name, value, ctx)` — generic ordered transform/veto chain (the menu API is built on it).
- `activities.register(def)/unregister(id)/get/list` — dynamic activity registration (API **and** surfaces together); first-party use the startup bootstrap, plugins call this at runtime.
- `modals.open(id)/close()/promote(id)/active/get/list` — modal-editor surfaces; `promote` re-presents a modal as an editor tab.
- `editor.openTab(kind, { title, params, focusExisting })/tabs()` — open registered editor tabs by kind; read the open tabs. `focusExisting` matches by kind **and** `params` (so a per-item tab focuses the same item but a different item opens a new tab). An `EditorView` may set `tabIcon(tab)` for a per-tab icon (e.g. Preview's thumbnail / file-type icon).
- `icons.register({ id, label, getIcon })/setActive/list` — register an icon theme (`icons` permission); layer 2 of the icon pipeline (see `useIconRegistry`).
- `lightbox.open({ component, props })/close()/active` — open a near-fullscreen overlay (`lightbox` permission); `LightboxHost.vue` renders it. The Preview plugin opens its single-item media viewer here on double-click.
- `preferences.register({ key, title, properties })/get(path)` — contribute a Settings section + read a value (see Plugin system → preference contributions).
- `events.on/once/emit`, `selection`, `peer(id)`, `query.{activeTab,activeActivityId}`, `log`.

Menus, keybindings, and the command palette all **reference commands by id** — to add a shortcut/menu item, register or point at a command; don't hardcode an action.

## Plugin system

A **plugin** is an out-of-core activity loaded at runtime through a *permission-scoped* view of the same facade. First-party activities and plugins use one contribution path; plugins just get a narrowed API. **See [`docs/PLUGINS.md`](docs/PLUGINS.md) for the authoring guide.**

- **UI model** (`client/models/ui/`): UI-agnostic classes — `Activity`, `View`, `EditorView`, `ModalView`, `PanelView`, `ViewSection`, `StatusView` — that carry metadata + a component reference (no Vue imports). `fromDefinition.js` wraps the declarative `client/activities/*.js` objects into instances; the registry stores instances. A plugin authors `new Activity(...).addView(new PanelView(...))`.
- **Manifest + permissions** (`client/models/plugin/`): `manifest.js` (Chrome-style `manifest.json` validator), `permissions.js` (front-end `PERMISSIONS` gating facade slices, backend `HOST_PERMISSIONS` gating brokered services like `scm:read`/`scm:write`). JSON schema + example: `docs/plugins/`.
- **Loader** (`client/composables/plugins/`): `usePluginApi.js` builds the frozen, permission-scoped `api` (UI classes + `log` + only the granted facade slices/brokers); `usePluginHost.js` loads/unloads `{ manifest, module }` pairs (dependency-ordered, lifecycle). `activate(api)` may be sync or async and returns (or resolves to) a disposer; `deactivate(api)` is optional. **Fault isolation**: the host imports optional plugins lazily and in parallel, then activates them sequentially — an import failure, a thrown/rejected `activate()`, or a bogus disposer is logged and confined to that plugin (peers and the host keep running); a reactive `states` map tracks each plugin's `loading`/`active`/`failed` status.
- **Loading**: built-ins are listed in `client/builtin-plugins/index.js` and loaded at startup in `Workbench.vue`. Current built-ins: **`explorer`** (the file-tree + directory-tab + selection-capability plugin — must load first so Workbench can pull its selection refs before the other slices initialise), **`source-control`** (brokers to the Go scm API — the richest surface reference), and **`preview`** / **`details`** / **`debug`** (pure surface contributors: selection-consuming panels in the Secondary Side Bar, and Debug's log-provider panel in the Bottom Panel). The archive/sandbox runtime path is not built yet — it will produce the same `{ manifest, module }` pairs the host already consumes.
- **Brokered backend**: plugins never touch the filesystem/control server directly — host-permission'd services (e.g. `api.scm`) forward to the Go server (`server/v1/scm.go`) via a client broker (`client/lib/scm-api.js`, reads→data / writes→control, mock fallback when offline).
- **Preference contributions** (`client/composables/usePreferenceSchema.js`): `api.preferences.register({ key, title, properties })` adds a section to the Settings panel (merged with the static base schema in `SettingsModal.vue`); values live under `prefs.<key>` and persist normally. `api.preferences.get(path)` reads a value.

## Key lib files and composables

### Lib files

| File | Purpose |
|---|---|
| `lib/api-config.js` | `API_BASE`, `CONTROL_BASE`, `API_V`, `MEDIA_BASE` constants derived from env vars. |
| `lib/fs-api.js` | FS API calls: `fsStat`, `fsListDir`, `fsArchiveList`, `fsExeInfo`, read-only ops. Write ops are now routed through `useFileOpsQueue` / `sw-queue`. |
| `lib/sw-queue.js` | Client bridge to the service worker. `swQueue.enqueue(kind, params)` adds an op; `swQueue.execute(opIds)` drains the SW queue and returns an array of Promises. Falls back to direct fetch when SW is unavailable. |
| `lib/explorer-api.js` | Explorer tree API calls. |
| `lib/scm-api.js` | Source-control (git) broker the plugin SCM service forwards to: `detectRepos`/`repoInfo` (reads→data server), `commit`/`init` (writes→control server), with mock fallback when the `/scm` endpoints are offline. |
| `lib/perf-log.js` | Client-side performance timing helpers. |
| `lib/time.js` | Notification time helpers: `isoDuration`/`humanAgo` for `<time>` relative labels, `isoDurationMs`/`humanDurationMs` for op timings, `clockTime` for absolute timestamps. |
| `public/sw.js` | Service worker. Maintains a per-client op queue (keyed by `event.source.id`). Handles `INIT`, `ENQUEUE`, `EXECUTE`, `CLEAR` messages. `EXECUTE` fires all queued ops concurrently via fetch and replies `OP_COMPLETE`/`OP_ERROR` per op. |
| `plugins/sw.client.js` | Registers the service worker on app startup (fire-and-forget; fallback handles early ops). |

### Composables — root (foundational services and utilities)

| File | Purpose |
|---|---|
| `useWorkspaces.js` | Persisted per-workspace model in `localStorage`. Owns schema versioning (v1–v5) and forward migrations. Single instance kept in `Workbench.vue` and passed as a parameter to `useViewLayout`. |
| `usePreferences.js` | Reads and saves user preferences from `config/preferences/`. Exposes `prefs` ref and `savePrefs`. |
| `useFileOpsQueue.js` | Module-level queue shared across the app. `enqueue({ label, kind, params })` routes through `swQueue`; in deferred mode ops accumulate until `flush()`. |
| `useActionHistory.js` | Global undo/redo stack. `push({ label, undo, redo })` adds a reversible action. `undo()` / `redo()` execute and shift between stacks. |
| `useDebugLog.js` | In-memory debug log shown in the Debug panel. `log(kind, msg, data)` appends; `.clear()` resets. |
| `useLayoutGrid.js` | Pure recursive split-view grid engine. Leaves carry `{tabs[], activeTabId, tabPreviews, locked}`; branches carry `{direction, children[], sizes[]}`. Core ops: `insertLeafBeside`, `removeLeaf`, `mergeAll`, five presets. No DOM/reactivity. |
| `useViewRegistry.js` | **Dynamic** flat content registry aggregated from `client/activities/` (grouped by activity, flattened to a by-id lookup) keyed by view/section/tab/status id. Reactive stores populated via `registerActivity(def)` / `unregisterActivity(id)` — bootstrapped from the activities list at import; plugins use the same path at runtime (so contributed surfaces appear/disappear live; `StatusBar` reads `getStatusViews` in a computed). Used by `ViewContentHost` (plus `TabContentHost` and `StatusBar`) to render content by id; `props(ctx)`/`on(ctx)` receive the activity host. Helpers: `getViewEntry`, `viewActions`, `sectionActions`, `sectionHeadingShown`, `bubbledSectionActions`, `viewAllowsDuplicateSections`, `viewDataId`, `sectionDataId`, plus activity-aware `tabViewForKind`, `getStatusViews(region)`, `listPrimaryViews` (PrimarySideBar panels → Activity Bar), `getModal`/`listModals`, `activityOfView`, `activityOfTabKind`, `tabViewIdForKind`, `listActivities`, `getActivity`. |
| `useIconRegistry.js` | Module-level singleton: the **icon-theme registry** (layer 2 of the icon pipeline). An icon-pack plugin registers a theme (`{ id, label, getIcon }`) through the facade (`api.icons`, `icons` permission); renderers call `resolveIcon(ctx)`, which delegates to the *active* theme's `getIcon` and returns a `{ type, icon }` descriptor (or null). `ResolvedIcon.vue` renders that descriptor (`url`/`file.path`→`<img>`, `component`, `svg.path`→inline SVG). The Material pack lives in `builtin-plugins/material-icon-theme/` and resolves names against `/icons/manifest`. The active theme follows the `iconTheme` preference (else the first registered). |
| `useCustomIcon.js` | Pure helper (no reactive state). `resolveCustomIcon(iconStr)` returns `null`, `{ type: 'url', url }`, or `{ type: 'folder-color', color }`. Folder-color must render as inline `<svg>` — not `<img>` — so CSS `color` applies. |
| `useRpc.js` | Lightweight JSON-RPC helper for calling Go control-server endpoints. |
| `useDirectoryFileTree.js` | Builds a renderable file tree (tree or flat list) from a directory path set. Two modes: **lazy** (ExplorerPanel — virtual roots, per-path child cache, soft-refresh via `reloadDir`/`reloadAll`, expanded state persisted to workspace) and **eager** (Source Control changes view — flat `{ path }` set rendered as a tree). Nodes carry **no baked icon** — the renderer resolves each node's icon at render time via the active icon theme (`useIconRegistry`); virtual root nodes still pin their own `mdiPath`, which the renderer honours over any pack icon. |
| `usePreferenceSchema.js` | Registry of preference **sections** contributed by activities/plugins (`registerPreferences({ key, title, properties })`); `SettingsModal` merges them with the static base schema. Backs `facade.preferences`. |

### Composables — `activity/` (inter-activity API)

| File | Purpose |
|---|---|
| `useEmitter.js` | `createEmitter()` → tiny synchronous pub/sub (`on`/`once`/`off`/`emit`/`clear`); subscriber errors are isolated. One per providing activity API, plus one for the host's app-level events. |
| `useActivityHost.js` | The broker. Instantiates each activity's API (calls `setup`) and exposes `api(id)`/`requireApi(id)`, the reactive `selection` capability, `on`/`once`/`emit` (app events `active-tab-change` / `active-activity-change` / `activity-register` / `activity-unregister`), `log()`, and `activeTab`/`activeActivityId`/`activeGroupId`/`editorRoot`/`prefs`. Also builds the frozen **`host.facade`** — the contribution surface (`commands`, `keybindings`, `menus`, `hooks`, `activities`, `modals`, `editor`, `preferences`, `events`, `selection`, `peer`, `query`, `log`) handed to each `setup` as `api` and the plugin import (narrowed per permission for plugins). Provided as `viewCtx`. Params: `{ editor, prefs, services, log }`. |
| `useCommandRegistry.js` | `createCommandRegistry({ getCtx, log })` → dynamic command store (`register`→disposer, `execute`, `get`, `list`, `isEnabled`). Commands are the single source of truth; `when`/`run` receive `ctx` (the host). |
| `useKeybindingRegistry.js` | `createKeybindingRegistry()` → chord→command bindings (`register`→disposer, `forChord`, `list`) + `normalizeChord` (folds `cmd`/`meta`→`ctrl`, orders modifiers). |
| `useHookRegistry.js` | `createHookRegistry()` → ordered transform/veto chain (`add`→disposer, `apply(name, value, ctx)`, `has`). Backs the menu contribution API. |

### Composables — `interaction/` (UI-behavior primitives)

Pure composables consumed by individual components for user interaction. No business logic.

| File | Purpose |
|---|---|
| `useDrag.js` | Custom ghost-clone drag for directory items. 200 ms activation delay. `onActivate` receives the mousedown item and returns the full drag array (auto-selects unselected items). |
| `useRightClickDrag.js` | Right-click drag for directory items. Suppresses native `contextmenu` on `mousedown`; on `mouseup`: no movement → `onRightClick({ item, event })`; threshold exceeded → `onDrop({ items, dropPath, x, y })`. |
| `useTreeDrag.js` | Module-level singleton drag for tree nodes. Chip-style ghost; valid drop targets: `type === 'directory'` only. Shared refs mean all `TreeItem` instances see the same `draggingNode`/`dragOverNode`. |
| `useEditorDnd.js` | Editor tab/group HTML5 drag: shared module state + `dropRegion()` edge/center detection. Replaced the orphaned `useDragAndDrop.js`. |
| `useViewDrag.js` | Shared drag state (`activeDrag`, `activeSectionDrag`) + MIME constants (`DRAG_MIME`, `SECTION_DRAG_MIME`) for panel view and section drag-drop. Consumed by `ViewContainer`, `SplitViewArea`, `SplitSectionArea`, and `ViewTabStrip`. |
| `useClickDebounce.js` | Single vs double-click disambiguation. Modifier keys bypass the delay. `cancel()` flushes pending timers (used when rename mode activates). |
| `useHoverPreview.js` | Hover preview overlay: positioning, show/hide timing, preload of full-resolution media. |
| `useSideBar.js` | Owns the mousedown drag-resize loop for the three shell panes; reports new sizes back via `v-model`. Attaches a `ResizeObserver` that derives `dropDirection` (`col`/`row`) from measured pane shape. |
| `useStackResize.js` | Sash math for `SplitViewArea` and `SplitSectionArea`: pointer-move loop, size clamps, `sizes[]` update. |
| `useDragAndDrop.js` | Orphaned generic drag helper (superseded by `useEditorDnd.js`). Retained but no longer wired. |

### Composables — `workbench/` (assembly-root slices)

Hand-rolled store slices instantiated by `Workbench.vue` and wired by dependency injection. Leaf slices (no slice dependencies) come first; arrows show what each consumes. See `docs/REFACTOR-WORKBENCH.md` for the full dependency graph.

| File | Purpose |
|---|---|
| `useStatusBar.js` | Server-ping lifecycle, the transient status line, directory stats, and `flashStatus(msg, ms)` helper *(leaf)*. |
| `useNotifications.js` | Module-level singleton notification center *(leaf)*. `notify`/`update`/`dismiss`/`clear` plus `startJob({verb, operations})` which returns `start`/`succeed`/`fail`/`setActions` handles that recompute a job's title/type/progress live. `silent` notifications skip the unread dot; `activeJob` (running `progress` job) drives the status-bar `<meter>`. Rendered by `shell/NotificationPanel.vue` → `NotificationItem` → `NotificationJobGroup` → `NotificationOperation`. |
| `useArchive.js` | Archive-file detection (`isArchiveItem`, `ARCHIVE_EXTS`, `getArchiveExt`) and host capabilities (`archiveCaps`, `platform`) *(leaf)*. |
| `useEditorGrid.js` | Editor split-grid model, every structural mutation, and the provided `editorController`. Deliberately selection-free. Params: `{ log, getInitialEditor, saveEditor }`. |
| `useViewLayout.js` | Panel/sidebar layout engine: per-container view lists, merge groups, per-view section state, all drag-driven layout mutations, and the provided `workbenchChrome`. Params: `{ workspaces, prefs, savePrefs }`. |
| `useSelection.js` | Current selection + explorer/directory/navigate handlers. Consumes the editor grid one-directionally. Exposes `updateSelectionAfterRename` and `updateSelectionAfterBatchRename` for post-rename reconciliation. Params: `{ editor, statusbar, log, fsStat, fsOpenWithSystem, isArchiveItem, uuid }`. **Instantiated by the Explorer plugin's `setup` (in `client/builtin-plugins/explorer/src/plugin.js`), which wraps it as the `selection` capability + `selection-change` event and owns `dirStats`; Workbench pulls its refs/handlers from `host.api('explorer')`.** |
| `useFileOperations.js` | Create/rename/trash/delete/compress/extract/paste/move/undo + clipboard, elevation dialog, and install prompt. `handleRenameBatch` handles the `rename-batch` event from find-replace Replace All: one optimistic `batchRenameItems` call, parallel server enqueues, per-item rollback on failure, `clearOptimisticThumbnails` after settle. Params: `{ editor, selection, statusbar, enqueue, history, log, explorerPanelRef }`. |
| `useFileContextMenus.js` | Builds the four context-menu item arrays (editor tab / background / right-drag / item). Params: `{ editor, selection, fileOps, archive, enqueue, statusbar, fsOpenWithSystem, fsOpenTerminal, uuid }`. |
| `useAppMenus.js` | File/Edit/View + Settings menus **assembled from the command registry** (`{ command }` refs resolved to label / enabled / toggle-state) plus items contributed via `menus.items(menuId)`; modal open-state and the prefs-save passthrough. Params: `{ host, history, views, savePrefs, statusbar, explorerPanelRef }`. |
| `useWorkbenchKeyboard.js` | Window-level keyboard **dispatcher**: normalizes each keydown to a chord and runs the bound command (`host.keybindings.forChord` → `commands.execute`), honoring `allowInInput`. Self-manages its listener. Params: `{ host }`. The command palette list is built in `Workbench` from `commands.list()`. |

## Nitro server routes (dev proxy workaround)

`client/server/routes/` contains Nitro event handlers that run inside Node.js **before** Vite middleware. They bypass the dev proxy size limit entirely.

- `media-preview.get.ts` — streams binary files (images, video, audio) with correct MIME types.
- `text-preview.get.ts` — reads text/code files up to `max_lines`, decodes UTF-8 (falls back to latin-1), returns JSON.

In production these routes are unused; the client calls `/_api/v1/` directly.

## Go server handlers (`server/v1/`)

The Go process starts **two independent servers**: a read-only data server (port 8001, `PORT` env) and a mutating control server (port 8002, `CONTROL_PORT` env). All routes are prefixed with `/_api/v1/`.

| File | Key handlers |
|---|---|
| `main.go` | `registerDataRoutes` / `registerControlRoutes`, CORS middleware, dual-server startup with `sync.WaitGroup` |
| `fs.go` | `handleFsStat`, `handleFsListDir`, `handleFsPreview`, `handleFsCreateFile`, `handleFsCreateDir`, `handleFsWriteFile`, `handleFsOpenWithSystem`, `handleFsOpenTerminal`, `handleFsRename`, `handleFsMove`, `handleFsCopy`, `handleFsDelete`, `handleFsDeleteElevated`, `handleFsTrash`, `handleFsTrashElevated`, `handleFsCompress`, `handleFsDecompress`, `handleFsDirSize`. Files with archive extensions get `kind: "archive"` in listing responses. `handleFsOpenTerminal` walks a list of known terminal emulators (`x-terminal-emulator`, `gnome-terminal`, `konsole`, `kitty`, `alacritty`, etc.) and launches the first one found; uses macOS `osascript` / Windows Terminal fallback on other platforms. `handleFsDirSize` serves `GET /_api/v1/fs/dir_size?path=…`; backed by `getDirSize(path)` (a `sync.Map` cache with 5-min TTL that walks on miss) and `invalidateDirSize(paths…)` (evicts path + immediate parent, called by all write handlers). |
| `archive.go` | `handleFsArchiveLs` — lists archive contents as virtual directory entries. `handleArchiveCapabilities` — reports which tools (7z, unrar) are available. Supports ZIP, TAR/TAR.GZ/TAR.BZ2/TAR.XZ, 7Z (via `7z l -slt`), RAR (via `unrar lt`). `filterArchiveEntries` synthesizes implied directory nodes for archives that omit them. |
| `exe.go` | `handleMediaExeIcon` — extracts the best-resolution icon from a Windows PE `.rsrc` section (PNG direct or DIB wrapped in a minimal ICO). `handleMediaExeInfo` — parses `VS_VERSIONINFO` to return `{ name, publisher, version, description }`. |
| `permissions.go` | `isProtectedPath` — blocks operations on critical OS paths (root, /etc, /sys, etc.). `requiresElevation` — detects whether a path needs sudo/admin and returns the elevation method (`sudo_password` on Linux/macOS, `uac` on Windows). |
| `explorer.go` | `handleExplorer`, `handleExplorerRoot`, `handleExplorerHome`, `handleExplorerDrives`, `handleExplorerCategories` |
| `media.go` | `handleMediaImage`, `handleMediaThumbnail`, `handleMediaPreview`, `handleMediaPreviewText`, `handleMediaMetadata`, `handleMediaArtwork`, `handleMediaCapabilities` |
| `thumbnail.go` | `resizeImage`, `videoThumbnail` (ffmpeg), `audioThumbnail` (ffmpeg), disk-based thumbnail cache |
| `preferences.go` | `handlePreferencesGet`, `handlePreferencesPut` (writes the prefs JSON verbatim — no schema strip), `handlePreferencesSchema` |
| `scm.go` | Source control (git via the `git` CLI): `handleScmDetect` (repo discovery from open paths — ancestor/sibling/child), `handleScmInfo` (branch/ahead-behind/status/log), `handleScmCommit`, `handleScmInit`. detect/info on the data server, commit/init on control. The client reaches these only through the broker (`lib/scm-api.js`) behind the `scm:read`/`scm:write` plugin permissions. |
| `blacklist.go` | Path exclusion rules loaded from server-side config |
| `plugins.go` | Plugin loader; `loadPlugins()` reads `config/plugins/*/plugin.json`; `iconTheme` struct with `resolve()`, `resolveOpen()`, `has()`, `pick()`; `activeIconTheme` global |
| `icons.go` | `handleIconsManifest` — returns icon lookup tables; `handleIconsSvg` — serves SVG by definition name (404 returns `image/svg+xml` Content-Type to prevent ORB errors while firing `@error`) |
| `customization.go` | `readDirCustomization(dirPath)` — **merges** `.directory` + `desktop.ini` (app group `[X-Files-Workbench]` beats standard group; `.directory` beats `desktop.ini`), resolves relative/`~` icons to abs paths (raw kept in `icon_raw`); order-preserving `iniDoc` makes writes lossless; `handleFsCustomizationGet` (typed + raw `sections`) / `PUT` (typed) / `PATCH` (generic `ops`) / `handleFsPin` (`[X-Files-Workbench] Pinned` list); bypasses blacklist intentionally (internal server read) |
| `perf.go` | `handlePerf` — client performance log ingestion |

## Known gotchas

### Directory size loading is two-phase and async

`list_dir` does **not** walk directories for sizes. Sizes are loaded separately via `GET /_api/v1/fs/dir_size?path=…` in a two-phase flow inside `DirectoryTab`:

- **Phase 1** — `fetchItems()` renders the directory listing immediately; every directory shows no size until phase 2 completes.
- **Phase 2** — after phase 1, `DirectoryTab` fires concurrent `/fs/dir_size` requests (4 workers) filling a `dirSizes = reactive({})` map keyed by path. `DirectoryPanel` passes `dirSizes` as a prop; `DirectoryLayout` renders `DirSizeCell.vue` per directory item, reading only `dirSizes[item.path]` — so only that one cell re-renders when its size resolves (not the whole list). `DirSizeCell` shows a shimmer skeleton while loading.

**Server-side cache**: `getDirSize(path)` uses a `sync.Map` with a 5-min TTL (walks on miss). `invalidateDirSize(paths…)` evicts the path and its immediate parent; all mutating handlers (`rename`, `move`, `copy`, `delete`, `trash`, `create`) call it after success. `handleFsDirSize` serves `GET /_api/v1/fs/dir_size`.

Do not add `includeDirSize: true` to `fsListDir` calls — the separate endpoint + reactive map pattern is intentional for granular updates.

### Icon rendering priority (directories)

Thumbnail > custom path icon > folder-color SVG > **active icon theme** (`resolveIcon(ctx)` → `<ResolvedIcon>`) > MDI SVG fallback.

Layer 2 is no longer a hardcoded `useIconPack` lookup — it is whatever the active icon-pack plugin's `getIcon(ctx)` returns (`useIconRegistry`). Each renderer (TreeItem, DirectoryLayout, SourceControlFileTree, DetailsSectionInfo) builds a descriptor `{ path, name, isDir, kind, extension, expanded, … }`, calls `resolveIcon`, and renders the `{ type, icon }` result through `<ResolvedIcon>`, falling back to MDI on a null result or an `<img>` `@fail`. Icons are resolved at **render time**, not baked into the item/node.

Folder-color customizations (e.g. `Icon=folder-violet` in `.directory`) **must** render as an inline `<svg fill="currentColor">` with `:style="{ color }"` — not as an `<img>` — because CSS `color` cannot tint an image element. When `customFolderColor(item)` returns a value, skip the pack icon entirely and go straight to the inline SVG.

### Icon SVG 404 must return `image/svg+xml`
When a pack icon name has no backing SVG file, `handleIconsSvg` returns HTTP 404 but **with `Content-Type: image/svg+xml`**. This is intentional: a JSON or plain-text 404 triggers `ERR_BLOCKED_BY_ORB` in Chrome (cross-origin resource blocking for non-image MIME types on `<img>`), which prevents the `@error` handler from firing. By returning an image MIME type the browser lets the `@error` callback run and fall back to the MDI icon.

### `.ts` files detected as video
Some MIME detection logic returns `video/mp2t` for `.ts` files (MPEG-2 transport stream). Always check extension against known text/code extension sets **before** checking MIME type in preview logic.

### Vite dev proxy size limit
Binary responses and large text routed through `/_api/v1/` are silently truncated by the Vite dev proxy. Always use the Nitro routes (`/media-preview`, `/text-preview`) in dev for file content delivered to the preview panel. Thumbnails and JSON API responses pass through the proxy fine.

### DirectoryLayout view modes
`DirectoryLayout.vue` is a single unified component that handles all view layouts (grid, list, details, gallery-grid, gallery-mosaic, feed, and all grid size variants). The active layout is controlled by the `layout` prop applied as a `data-layout` attribute on the root element; all layout-specific styling is CSS-driven. Old per-layout components (`DirectoryGridLayout.vue`, `DirectoryListLayout.vue`, `DirectoryTableLayout.vue`, `DirectoryFeedLayout.vue`, `DirectoryGalleryLayout.vue`, `DirectoryMosaicLayout.vue`) remain in the repo but are no longer wired into the active rendering path.

### `kind: "archive"` — archives behave like navigable directories

Files with archive extensions (`.zip`, `.tar`, `.7z`, `.rar`, `.tar.gz`, etc.) get `kind: "archive"` from the server instead of `kind: "file"`. On the client this means:
- Double-click navigates into the archive as a virtual directory (`path + '::'`)
- They sort before regular files (alongside `kind: "dir"` / `kind: "app"`)
- The Nested layout shows an expand toggle for them
- `DirectoryPanel` filter/sort treat them like directories (always shown, sorted first)

The `::` separator in a tab path signals archive mode throughout the client. `DirectoryTab.fetchItems` checks for `::` and calls `fsArchiveList` instead of `fsListDir`.

### Data server vs control server

File-read requests (`/_api/v1/fs/list_dir`, media, etc.) go to port 8001 (proxied in dev via Nuxt). File-write requests (`rename`, `move`, `delete`, etc.) go directly to port 8002 (`CONTROL_BASE`). The service worker also targets `CONTROL_BASE` for all queued operations. Do not register write routes on the data mux or vice versa.

### Packaging: Electron spawns the Go server

In a packaged build there is no separate backend — `client/electron/main.js` spawns the
bundled server binary (fixed ports 8001/8002) and waits for `/health` before opening
the window; in dev the spawn is skipped (`npm run dev:server` runs it). The server
resolves paths through `FW_CONFIG_DIR` / `FW_DATA_DIR` / `FW_LOGS_DIR` / `FW_BLACKLIST`
(set by main.js to app-resources + Electron `userData`), falling back to the repo
layout when unset. So: read-only config is bundled, user data is written to `userData`,
and any new server file path must go through one of those roots — never assume the repo
is on disk. See **Packaging & distribution** in `docs/DESIGN.md`.

### Service worker operations queue

All mutating file ops are enqueued via `useFileOpsQueue.enqueue({ label, kind, params })` — **not** via direct `fs-api.js` calls. The op is serialised and sent to the SW as `{ kind, params }`; the SW maps kind → endpoint using `ENDPOINTS` in `sw.js`. If the SW is unavailable, `sw-queue.js` falls back to a direct fetch with the same ENDPOINTS map. Adding a new write endpoint requires updating `ENDPOINTS` in **both** `client/public/sw.js` and `client/lib/sw-queue.js`.

### Sort and filter live in DirectoryPanel
`DirectoryPanel.vue` owns all sort/filter state and applies it client-side via a `processedItems` computed property (filter then sort, directories always first). `DirectoryLayout` receives the already-processed item list — it does not sort or filter itself.

### Monaco worker setup
Must configure `window.MonacoEnvironment.getWorker()` before importing Monaco. Use `new URL('monaco-editor/esm/vs/...', import.meta.url)` — Vite bundles these as separate worker chunks automatically. Dynamic `import('monaco-editor')` in `onMounted` to defer loading.

### Right-click context menu timing on Linux/X11

On Linux with X11, the native `contextmenu` event fires on `mousedown` rather than `mouseup` (unlike Windows and macOS). This means a naive `@contextmenu` listener would open the context menu before the user has a chance to start right-click dragging.

`useRightClickDrag` addresses this by attaching a capture-phase `contextmenu` listener on every right `mousedown` that calls `preventDefault()` and `stopPropagation()`. It then fires `onRightClick` on `mouseup` (no drag) or `onDrop` on `mouseup` (drag). The suppression listener is always registered — even when no drag occurs — so the behaviour is uniform across all platforms.

Direct `@contextmenu.prevent` event listeners on individual items are kept as no-op safety nets but are never the primary trigger.

### Ghost drag and trailing click
When a custom drag ends, a `click` event fires after `mouseup`. `wasDragging` in `useDrag` / `useTreeDrag` is briefly `true` after drag ends (reset via `setTimeout(..., 0)`) so item click handlers can skip that trailing event.

### Tree drag shared state
`useTreeDrag` stores `draggingNode`, `dragOverNode`, `isDragging`, `wasDragging` at module level. All `TreeItem` instances share them. This means there can only be one active tree drag at a time (correct) but also means the state persists across tree re-renders.

### Inline rename and click debounce
`useClickDebounce` has a `cancel()` method. Call it in `startRename()` to prevent the pending single-click callback from firing after rename mode activates.

### `viewCtx` is the activity host
The object injected as `viewCtx` (by `ViewContentHost`, `ViewActions`, `TabContentHost`, and the status widgets) is the **activity host** from `useActivityHost.js` — not a hand-built bag anymore. Registry `props(ctx)` / `on(ctx)` and `actions[].run/icon/title(ctx)` all receive it. Read selection via `ctx.selection.value` (never a global `selectedItems`), query other activities via `ctx.api(id)`, and reach Workbench's late-bound handlers (`ctx.handleRename`, `ctx.doMove`, …) which are `Object.assign`ed onto the host after the slices initialise (so always optional-chain: `ctx.handleRename?.(…)`).

### Adding a tab / panel / status surface = edit an activity, not the host
Tab content is registry-driven through `editor/TabContentHost.vue` (resolves a tab's `kind` → tab view). The status bar is registry-driven through `shell/StatusBar.vue`. To add a new editor tab type, sidebar panel, section, or status widget, add it to the relevant `client/activities/*.js` module (creating a new one + registering it in `activities/index.js` if it's a new activity) — **do not** edit EditorGroup / StatusBar. A tab view declares the runtime `kind` it renders; `activityOfTabKind`/`tabViewForKind` map `kind` → activity/view. There is **no workspace-schema migration** for this — the persisted tab `kind` is still the bridge.

### Status widgets self-gate
Each status widget (`shell/status/*`) injects the host and renders nothing when it lacks relevant context (e.g. the Explorer widget only shows on a `dir` tab; the job meter only while a job runs). `StatusBar.vue` carries no props — it just lays out `getStatusViews('left')` / `('right')`.

### Commands are the source of truth (menus / keybindings / palette reference them)
Don't hardcode an action in a menu item, keybinding switch, or the palette. Register a command (`host.facade.commands.register({ id, title, run, when?, toggled? })`) and reference it by id: menus use `{ command: 'id' }`, keybindings use `{ key, command }`, the palette lists `commands.list()`. App-level commands are the catalog in `Workbench.vue`; activity-specific ones are registered in that activity's `setup`. A command needing arguments (e.g. `editor.focusGroup`) sets `palette: false` and is invoked via a keybinding's `args`.

### facade (`api`) vs ctx (host)
Two different objects: **`api`** = `host.facade`, the frozen *contribution/registration* surface passed to `setup` and imported by plugins (`commands`, `keybindings`, `menus`, `hooks`, `activities`, `modals`, `editor`, `preferences`, `events`, `selection`, `peer`, `query`, `log`). **`ctx`** = the host itself, the *binding context* a command's `run(ctx)` / `when(ctx)` and registry `props(ctx)` receive (carries late-bound slice handlers like `ctx.doMove`). The facade deliberately omits those internals. When adding behaviour: register through `api`; implement the behaviour against `ctx`.

## Conventions

- When writing JavaScript comments, use standard JSDoc formatting.
- Vue component styles use `scoped`. Use `:deep()` only when targeting child component internals from a parent (e.g., `ExplorerTree.vue` targeting `.ig` inside `TreeItem`).
- Events propagate upward through `defineEmits` chains all the way to `Workbench.vue`. When adding a new event in a leaf component, thread it through every intermediate layer. The `rename-batch` event follows the chain DirectoryLayout → DirectoryPanel → DirectoryTab → EditorGroup → Editor → Workbench. Between the tab content and EditorGroup the event passes through `TabContentHost.vue`, which forwards all parent listeners to the rendered component via `$attrs` (so tab views don't need to re-declare them).
- `DirectoryTab` assigns a stable `_id` (monotonically-incrementing integer, scoped to the module) to every item at fetch time. `DirectoryLayout` uses `item._id ?? item.path` as the v-for key. This ensures that an optimistic rename — which changes `item.path` but not `_id` — reuses the existing DOM node rather than remounting it, preventing unnecessary thumbnail reloads. Always preserve `_id` when mutating items (spread `...item` as the base).
- `DirectoryTab.defineExpose` includes `renameItem`, `batchRenameItems`, and `clearOptimisticThumbnails`. `EditorGroup` proxies all three to `directoryTabRef`. `handleRenameBatch` in `useFileOperations` reaches them via `forEachGroup`.
- `user-select: none` on all interactive UI chrome. Restore `user-select: text` explicitly inside Monaco containers and `contenteditable` spans.
- No comments unless the WHY is non-obvious. No trailing summary comments.
- All theme colors are CSS custom properties defined in `client/assets/css/workbench.css`. Theme JSON files in `config/themes/` map variable names to hex values.

### CSS conventions

- **Native nesting**: use `&` child blocks instead of repeating selectors. Nest state variants (`:hover`, `.--modifier`) and child elements inside their semantic parent.
- **Container queries over media queries**: panels are embedded in resizable panes, so `@media` (viewport-relative) is useless for layout adaptation. Declare `container-type: inline-size; container-name: <name>;` on the relevant wrapper and use `@container <name> (max-width: Xpx)` at the bottom of the `<style scoped>` block.
- **`@layer` belongs in `workbench.css`**: scoped component styles do not use `@layer`. Cascade layers for utility classes and global resets go in `client/assets/css/workbench.css` only.
- **Layout variants via `data-layout`**: `DirectoryLayout.vue` controls all view modes through a `data-layout` attribute on `.dl`. Nest each variant inside `.dl { &[data-layout="x"] { … } }`. Shared behavior across multiple layouts uses `:is()` — e.g., `&:is([data-layout="list"], [data-layout="details"]) { … }`.
- **No `background` double-declarations**: when a layout variant sets `background: transparent` on `.dl-thumb`, don't also set a non-transparent default above it. Keep the single correct value.

## Configuration files

User configuration lives in `config/` at the repo root.

```
config/
├── preferences/
│   ├── default-preferences.json   Shipped defaults (read-only reference)
│   ├── user-preferences.json      User overrides (gitignored)
│   └── preferences.schema.json    JSON Schema for validation
├── keybindings/
│   ├── default-keybindings.json   Built-in key bindings
│   ├── user-keybindings.json      User overrides (gitignored)
│   └── keybindings.schema.json    JSON Schema for validation
├── themes/
│   ├── dark.json                  Default dark theme
│   ├── light.json                 Light theme
│   └── black.json                 True-black / OLED theme
└── plugins/
    └── material-icon-theme/
        ├── plugin.json            Plugin manifest (id, type, adapter, source, theme)
        └── vscode-material-icon-theme/   Cloned repo; dist/material-icons.json is the theme file
```

`user-preferences.json` and `user-keybindings.json` are gitignored. The app merges user values over defaults at startup.

### Icon pack plugins

Each subdirectory under `config/plugins/` is a plugin. The server reads `plugin.json` at startup. Supported fields:

| Field | Description |
|---|---|
| `id` | Unique plugin identifier |
| `type` | Must be `"icon-pack"` |
| `adapter` | Must be `"vscode-icon-theme"` |
| `source` | Path to the cloned extension repo, relative to the plugin directory |
| `theme` | Path to the theme JSON inside `source` (auto-detected from `package.json` if empty) |

The server loads the pack's mapping tables + SVGs and exposes them at `/icons/manifest` (incl. `folderNamesExpanded`/`folderExpanded`) and `/icons/svg`. It still embeds `icon`/`icon_open` on listings, but the **client no longer consumes those** — the first-party `material-icon-theme` plugin (`client/builtin-plugins/`) fetches the manifest and resolves names itself in its `getIcon` handler, registered through the `icons` permission (see [`docs/PLUGINS.md`](docs/PLUGINS.md)). So an icon pack now has two layers: this server-side config plugin that *serves the assets*, and a client-side plugin that *registers the handler*. Missing SVGs fall back to MDI via `@error`/`@fail`.
