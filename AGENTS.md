# Agent Guide — Files Workbench 2

Instructions for AI coding agents (Claude Code, etc.) working in this repository.

## Repository at a glance

- **Frontend**: Nuxt 3 SPA (`client/`) served by Vite in dev and compiled to static in production. Runs inside Electron for the desktop app.
- **Backend**: Go HTTP server (`server/v2/`) on port 8000. All routes under `/_api/v2/`.
- **Dev proxy**: Nuxt/Vite proxies `/_api/v2/*` to port 8000. The proxy silently drops large binary responses — use Nitro server routes for file preview content (see below).

## Component architecture

```
Workbench.vue                  Root shell: titlebar, activity bar, sidebar, tab bar, panels
├── ExplorerPanel.vue          Sidebar left panel
│   └── ExplorerTree.vue
│       └── TreeList.vue
│           └── TreeItem.vue   Recursive tree node
├── DirectoryTab.vue           Main content area for a directory tab; owns fetch + nav history
│   └── DirectoryPanel.vue     Navigation header, sort/filter state, layout switcher
│       └── DirectoryLayout.vue  Unified layout component — all view modes via CSS data-layout attr
├── SplitView.vue / SplitViewPanel.vue
├── PreviewPanel.vue           Right panel: dispatches to per-type preview components
│   ├── preview/ImagePreview.vue
│   ├── preview/VideoPreview.vue
│   ├── preview/AudioPreview.vue
│   ├── preview/TextPreview.vue
│   └── preview/HtmlPreview.vue
└── PreferencesActivity.vue
```

## Key lib files and composables

| File | Purpose |
|---|---|
| `lib/api-config.js` | `API_BASE`, `API_V`, `MEDIA_BASE` constants derived from env vars. |
| `lib/fs-api.js` | FS API calls: `fsStat`, `fsListDir`, `fsRename`, etc. |
| `lib/explorer-api.js` | Explorer tree API calls. |
| `lib/perf-log.js` | Client-side performance timing helpers. |
| `useClickDebounce.js` | Single vs double-click disambiguation. Modifier keys (Ctrl/Shift/Meta) fire immediately. Exposes `cancel()` to flush pending timers (used when rename mode activates). |
| `useDrag.js` | Custom ghost-clone drag for directory items. 200 ms activation delay. `onActivate` callback receives the mousedown item and returns the full array of items being dragged (auto-selects unselected items). |
| `useTreeDrag.js` | Module-level singleton drag for tree nodes. Creates a chip-style ghost (icon + name). Valid drop targets: `type === 'directory'` nodes only; root/drive nodes and files are not valid targets. Shared refs mean all `TreeItem` instances see the same `draggingNode`/`dragOverNode`. |
| `useDragAndDrop.js` | Native HTML5 drag for the tab bar (reordering). Separate from the file drag systems. |
| `useIconPack.js` | Module-level singleton composable for the icon pack. Fetches `/icons/manifest` once; exposes `ensureLoaded()`, `resolveIcon(filename, isDir)`, `iconUrl(iconName)`, and `isAvailable`. All components that need pack icons call `ensureLoaded()` once at mount time. |

## Nitro server routes (dev proxy workaround)

`client/server/routes/` contains Nitro event handlers that run inside Node.js **before** Vite middleware. They bypass the dev proxy size limit entirely.

- `media-preview.get.ts` — streams binary files (images, video, audio) with correct MIME types.
- `text-preview.get.ts` — reads text/code files up to `max_lines`, decodes UTF-8 (falls back to latin-1), returns JSON.

In production these routes are unused; the client calls `/_api/v2/` directly.

## Go server handlers (`server/v2/`)

All routes are prefixed with `/_api/v2/`.

| File | Key handlers |
|---|---|
| `main.go` | Route registration, CORS middleware, server startup |
| `fs.go` | `handleFsStat`, `handleFsListDir`, `handleFsPreview`, `handleFsCreateFile`, `handleFsCreateDir`, `handleFsWriteFile`, `handleFsOpenWithSystem` |
| `explorer.go` | `handleExplorer`, `handleExplorerRoot`, `handleExplorerHome`, `handleExplorerDrives`, `handleExplorerCategories` |
| `media.go` | `handleMediaImage`, `handleMediaThumbnail`, `handleMediaPreview`, `handleMediaPreviewText`, `handleMediaMetadata`, `handleMediaArtwork`, `handleMediaCapabilities` |
| `thumbnail.go` | `resizeImage`, `videoThumbnail` (ffmpeg), `audioThumbnail` (ffmpeg), disk-based thumbnail cache |
| `preferences.go` | `handlePreferencesGet`, `handlePreferencesPut`, `handlePreferencesSchema` |
| `blacklist.go` | Path exclusion rules loaded from server-side config |
| `plugins.go` | Plugin loader; `loadPlugins()` reads `config/plugins/*/plugin.json`; `iconTheme` struct with `resolve()`, `resolveOpen()`, `has()`, `pick()`; `activeIconTheme` global |
| `icons.go` | `handleIconsManifest` — returns icon lookup tables; `handleIconsSvg` — serves SVG by definition name (404 returns `image/svg+xml` Content-Type to prevent ORB errors while firing `@error`) |
| `perf.go` | `handlePerf` — client performance log ingestion |

## Known gotchas

### Icon SVG 404 must return `image/svg+xml`
When a pack icon name has no backing SVG file, `handleIconsSvg` returns HTTP 404 but **with `Content-Type: image/svg+xml`**. This is intentional: a JSON or plain-text 404 triggers `ERR_BLOCKED_BY_ORB` in Chrome (cross-origin resource blocking for non-image MIME types on `<img>`), which prevents the `@error` handler from firing. By returning an image MIME type the browser lets the `@error` callback run and fall back to the MDI icon.

### `.ts` files detected as video
Some MIME detection logic returns `video/mp2t` for `.ts` files (MPEG-2 transport stream). Always check extension against known text/code extension sets **before** checking MIME type in preview logic.

### Vite dev proxy size limit
Binary responses and large text routed through `/_api/v2/` are silently truncated by the Vite dev proxy. Always use the Nitro routes (`/media-preview`, `/text-preview`) in dev for file content delivered to the preview panel. Thumbnails and JSON API responses pass through the proxy fine.

### DirectoryLayout view modes
`DirectoryLayout.vue` is a single unified component that handles all view layouts (grid, list, details, gallery-grid, gallery-mosaic, feed, and all grid size variants). The active layout is controlled by the `layout` prop applied as a `data-layout` attribute on the root element; all layout-specific styling is CSS-driven. Old per-layout components (`DirectoryGridLayout.vue`, `DirectoryListLayout.vue`, `DirectoryTableLayout.vue`, `DirectoryFeedLayout.vue`, `DirectoryGalleryLayout.vue`, `DirectoryMosaicLayout.vue`) remain in the repo but are no longer wired into the active rendering path.

### Sort and filter live in DirectoryPanel
`DirectoryPanel.vue` owns all sort/filter state and applies it client-side via a `processedItems` computed property (filter then sort, directories always first). `DirectoryLayout` receives the already-processed item list — it does not sort or filter itself.

### Monaco worker setup
Must configure `window.MonacoEnvironment.getWorker()` before importing Monaco. Use `new URL('monaco-editor/esm/vs/...', import.meta.url)` — Vite bundles these as separate worker chunks automatically. Dynamic `import('monaco-editor')` in `onMounted` to defer loading.

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
