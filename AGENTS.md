# Agent Guide — Files Workbench 2

Instructions for AI coding agents (Claude Code, etc.) working in this repository.

## Repository at a glance

- **Frontend**: Nuxt 3 SPA (`client/`) served by Vite in dev and compiled to static in production. Runs inside Electron for the desktop app.
- **Backend**: Go HTTP server (`server/v2/`) — data server on port 8001, control server on port 8002. All routes under `/_api/v2/`.
- **Dev proxy**: Nuxt/Vite proxies `/_api/v2/*` to port 8001 (data). Write ops contact port 8002 directly via `CONTROL_BASE`. The proxy silently drops large binary responses — use Nitro server routes for file preview content (see below).

## Component architecture

```
Workbench.vue                  Root shell: titlebar, activity bar, sidebar, editor grid, panels
├── ExplorerPanel.vue          Sidebar left panel
│   └── ExplorerTree.vue
│       └── TreeList.vue
│           └── TreeItem.vue   Recursive tree node
├── GridView.vue               Recursive editor split-grid (Sash.vue resize handles between siblings)
│   └── EditorGroup.vue        Editor group: tab strip + active tab content (DropOverlay.vue shows drop zones)
│       ├── HomePage.vue
│       ├── DirectoryTab.vue   Directory tab content; owns fetch + nav history
│       │   └── DirectoryPanel.vue       Navigation header, sort/filter state, layout switcher
│       │       └── DirectoryLayout.vue  Unified layout component — all view modes via CSS data-layout attr
│       └── PreferencesActivity.vue
└── PreviewPanel.vue           Right panel: dispatches to per-type preview components
    ├── preview/ImagePreview.vue
    ├── preview/VideoPreview.vue
    ├── preview/AudioPreview.vue
    ├── preview/TextPreview.vue
    └── preview/HtmlPreview.vue
```

## Key lib files and composables

### Lib files

| File | Purpose |
|---|---|
| `lib/api-config.js` | `API_BASE`, `CONTROL_BASE`, `API_V`, `MEDIA_BASE` constants derived from env vars. |
| `lib/fs-api.js` | FS API calls: `fsStat`, `fsListDir`, `fsArchiveList`, `fsExeInfo`, read-only ops. Write ops are now routed through `useFileOpsQueue` / `sw-queue`. |
| `lib/sw-queue.js` | Client bridge to the service worker. `swQueue.enqueue(kind, params)` adds an op; `swQueue.execute(opIds)` drains the SW queue and returns an array of Promises. Falls back to direct fetch when SW is unavailable. |
| `lib/explorer-api.js` | Explorer tree API calls. |
| `lib/perf-log.js` | Client-side performance timing helpers. |
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
| `useViewRegistry.js` | Central content registry keyed by view/section id: `{ label, icon, component, props(ctx), sections, actions, expose }`. Used by `ViewContentHost` to render any view/section in any container. Helpers: `getViewEntry`, `viewActions`, `sectionActions`, `sectionHeadingShown`, `bubbledSectionActions`, `viewAllowsDuplicateSections`, `viewDataId`, `sectionDataId`. |
| `useIconPack.js` | Module-level singleton for the icon pack. Fetches `/icons/manifest` once; exposes `ensureLoaded()`, `resolveIcon(filename, isDir)`, `iconUrl(iconName)`, and `isAvailable`. All components needing pack icons call `ensureLoaded()` at mount time. |
| `useCustomIcon.js` | Pure helper (no reactive state). `resolveCustomIcon(iconStr)` returns `null`, `{ type: 'url', url }`, or `{ type: 'folder-color', color }`. Folder-color must render as inline `<svg>` — not `<img>` — so CSS `color` applies. |
| `useRpc.js` | Lightweight JSON-RPC helper for calling Go control-server endpoints. |

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
| `useArchive.js` | Archive-file detection (`isArchiveItem`, `ARCHIVE_EXTS`, `getArchiveExt`) and host capabilities (`archiveCaps`, `platform`) *(leaf)*. |
| `useEditorGrid.js` | Editor split-grid model, every structural mutation, and the provided `editorController`. Deliberately selection-free. Params: `{ log, getInitialEditor, saveEditor }`. |
| `useViewLayout.js` | Panel/sidebar layout engine: per-container view lists, merge groups, per-view section state, all drag-driven layout mutations, and the provided `workbenchChrome`. Params: `{ workspaces, prefs, savePrefs }`. |
| `useSelection.js` | Current selection + explorer/directory/navigate handlers. Consumes the editor grid one-directionally. Params: `{ editor, statusbar, log, fsStat, fsOpenWithSystem, isArchiveItem, uuid }`. |
| `useFileOperations.js` | Create/rename/trash/delete/compress/extract/paste/move/undo + clipboard, elevation dialog, and install prompt. Params: `{ editor, selection, statusbar, enqueue, history, log, explorerPanelRef }`. |
| `useFileContextMenus.js` | Builds the four context-menu item arrays (editor tab / background / right-drag / item). Params: `{ editor, selection, fileOps, archive, enqueue, statusbar, fsOpenWithSystem, fsOpenTerminal, uuid }`. |
| `useAppMenus.js` | File/Edit/View + Settings menus, command-palette command list, and modal open-state. Params: `{ fileOps, selection, editor, history, prefs, savePrefs, statusbar, explorerPanelRef, appearance, views }`. |
| `useWorkbenchKeyboard.js` | Window-level keyboard shortcuts. Self-manages its listener via `onMounted`/`onUnmounted`. Params: `{ editor, fileOps, selection, openCommandPalette, openSettingsModal }`. |

## Nitro server routes (dev proxy workaround)

`client/server/routes/` contains Nitro event handlers that run inside Node.js **before** Vite middleware. They bypass the dev proxy size limit entirely.

- `media-preview.get.ts` — streams binary files (images, video, audio) with correct MIME types.
- `text-preview.get.ts` — reads text/code files up to `max_lines`, decodes UTF-8 (falls back to latin-1), returns JSON.

In production these routes are unused; the client calls `/_api/v2/` directly.

## Go server handlers (`server/v2/`)

The Go process starts **two independent servers**: a read-only data server (port 8001, `PORT` env) and a mutating control server (port 8002, `CONTROL_PORT` env). All routes are prefixed with `/_api/v2/`.

| File | Key handlers |
|---|---|
| `main.go` | `registerDataRoutes` / `registerControlRoutes`, CORS middleware, dual-server startup with `sync.WaitGroup` |
| `fs.go` | `handleFsStat`, `handleFsListDir`, `handleFsPreview`, `handleFsCreateFile`, `handleFsCreateDir`, `handleFsWriteFile`, `handleFsOpenWithSystem`, `handleFsOpenTerminal`, `handleFsRename`, `handleFsMove`, `handleFsCopy`, `handleFsDelete`, `handleFsDeleteElevated`, `handleFsTrash`, `handleFsTrashElevated`, `handleFsCompress`, `handleFsDecompress`. Files with archive extensions get `kind: "archive"` in listing responses. `handleFsOpenTerminal` walks a list of known terminal emulators (`x-terminal-emulator`, `gnome-terminal`, `konsole`, `kitty`, `alacritty`, etc.) and launches the first one found; uses macOS `osascript` / Windows Terminal fallback on other platforms. |
| `archive.go` | `handleFsArchiveLs` — lists archive contents as virtual directory entries. `handleArchiveCapabilities` — reports which tools (7z, unrar) are available. Supports ZIP, TAR/TAR.GZ/TAR.BZ2/TAR.XZ, 7Z (via `7z l -slt`), RAR (via `unrar lt`). `filterArchiveEntries` synthesizes implied directory nodes for archives that omit them. |
| `exe.go` | `handleMediaExeIcon` — extracts the best-resolution icon from a Windows PE `.rsrc` section (PNG direct or DIB wrapped in a minimal ICO). `handleMediaExeInfo` — parses `VS_VERSIONINFO` to return `{ name, publisher, version, description }`. |
| `permissions.go` | `isProtectedPath` — blocks operations on critical OS paths (root, /etc, /sys, etc.). `requiresElevation` — detects whether a path needs sudo/admin and returns the elevation method (`sudo_password` on Linux/macOS, `uac` on Windows). |
| `explorer.go` | `handleExplorer`, `handleExplorerRoot`, `handleExplorerHome`, `handleExplorerDrives`, `handleExplorerCategories` |
| `media.go` | `handleMediaImage`, `handleMediaThumbnail`, `handleMediaPreview`, `handleMediaPreviewText`, `handleMediaMetadata`, `handleMediaArtwork`, `handleMediaCapabilities` |
| `thumbnail.go` | `resizeImage`, `videoThumbnail` (ffmpeg), `audioThumbnail` (ffmpeg), disk-based thumbnail cache |
| `preferences.go` | `handlePreferencesGet`, `handlePreferencesPut`, `handlePreferencesSchema` |
| `blacklist.go` | Path exclusion rules loaded from server-side config |
| `plugins.go` | Plugin loader; `loadPlugins()` reads `config/plugins/*/plugin.json`; `iconTheme` struct with `resolve()`, `resolveOpen()`, `has()`, `pick()`; `activeIconTheme` global |
| `icons.go` | `handleIconsManifest` — returns icon lookup tables; `handleIconsSvg` — serves SVG by definition name (404 returns `image/svg+xml` Content-Type to prevent ORB errors while firing `@error`) |
| `customization.go` | `readDirCustomization(dirPath)` — reads `.directory`, `desktop.ini`, `.DS_Store` from inside a directory; `handleFsCustomizationGet` / `handleFsCustomizationPut` — read and write `.directory` files; bypasses blacklist intentionally (internal server read) |
| `perf.go` | `handlePerf` — client performance log ingestion |

## Known gotchas

### Directory size is computed server-side per page

`list_dir` accepts `includeDirSize=true`. Sizes are computed **after pagination** using one goroutine per directory item on the current page (semaphore caps concurrency at 8). Scoping to the page means at most `PAGE_SIZE` (16) walks per request. The client passes `includeDirSize: true` from `DirectoryTab` and uses `item.size` directly — no separate `dir_size` requests.

### Icon rendering priority (directories)

Thumbnail > custom path icon > folder-color SVG > icon pack `<img>` > MDI SVG fallback.

Folder-color customizations (e.g. `Icon=folder-violet` in `.directory`) **must** render as an inline `<svg fill="currentColor">` with `:style="{ color }"` — not as an `<img>` — because CSS `color` cannot tint an image element. When `customFolderColor(item)` returns a value, skip the pack icon entirely and go straight to the inline SVG.

### Icon SVG 404 must return `image/svg+xml`
When a pack icon name has no backing SVG file, `handleIconsSvg` returns HTTP 404 but **with `Content-Type: image/svg+xml`**. This is intentional: a JSON or plain-text 404 triggers `ERR_BLOCKED_BY_ORB` in Chrome (cross-origin resource blocking for non-image MIME types on `<img>`), which prevents the `@error` handler from firing. By returning an image MIME type the browser lets the `@error` callback run and fall back to the MDI icon.

### `.ts` files detected as video
Some MIME detection logic returns `video/mp2t` for `.ts` files (MPEG-2 transport stream). Always check extension against known text/code extension sets **before** checking MIME type in preview logic.

### Vite dev proxy size limit
Binary responses and large text routed through `/_api/v2/` are silently truncated by the Vite dev proxy. Always use the Nitro routes (`/media-preview`, `/text-preview`) in dev for file content delivered to the preview panel. Thumbnails and JSON API responses pass through the proxy fine.

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

File-read requests (`/_api/v2/fs/list_dir`, media, etc.) go to port 8001 (proxied in dev via Nuxt). File-write requests (`rename`, `move`, `delete`, etc.) go directly to port 8002 (`CONTROL_BASE`). The service worker also targets `CONTROL_BASE` for all queued operations. Do not register write routes on the data mux or vice versa.

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

## Conventions

- Vue component styles use `scoped`. Use `:deep()` only when targeting child component internals from a parent (e.g., `ExplorerTree.vue` targeting `.ig` inside `TreeItem`).
- Events propagate upward through `defineEmits` chains all the way to `Workbench.vue`. When adding a new event in a leaf component, thread it through every intermediate layer.
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

The server resolves icon names and embeds them as `icon` and `icon_open` string fields in all `list_dir` and explorer API responses. Missing SVGs fall back gracefully — the client falls back to MDI icons via `@error` on `<img>` elements.
