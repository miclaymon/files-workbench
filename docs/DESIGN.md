# Design & Architecture

## Overview

Files Workbench 2 is a multi-process desktop application:

```
┌──────────────────────────────────────┐
│  Electron main process               │
│  (client/electron/main.js)           │
│  ┌────────────────────────────────┐  │
│  │  Renderer process              │  │
│  │  Nuxt 3 SPA (Vue 3)            │  │
│  │  http://localhost:3000         │  │
│  └────────────────────────────────┘  │
└──────────────────────────────────────┘
              │ HTTP /_api/v2/*
┌──────────────────────────────────────┐
│  Go HTTP server                      │
│  data:    http://localhost:8001      │
│  control: http://localhost:8002      │
└──────────────────────────────────────┘
```

In development, Nuxt's Vite dev server proxies `/_api/v2/*` to the data server on port 8001. Write operations contact the control server directly at port 8002. In production, Nuxt generates a static bundle that Electron loads directly from disk; the client calls both servers by their port numbers without a proxy.

## Frontend component model

### Workbench shell

`Workbench.vue` is the root component. It owns:
- Global app state: tabs, selected/focused items, clipboard, context menu
- Activity bar (explorer, search, settings icons)
- Primary sidebar — a `ViewContainer` in sections/accordion mode hosting Open Editors and Places sub-views
- Editor area: a recursive split grid of editor groups, each a tab strip + the active tab's content (Home / DirectoryTab)
- Secondary sidebar and bottom panel — each a `ViewContainer` in tabs mode (see ViewContainer panel system)
- All floating UI (context menus, right-drag drop menus, View menu, command palette, settings modal, keyboard shortcuts modal)
- Status bar: directory item count/size, selection count/size, clipboard pill (mode + count + size)

The View menu exposes two submenus: **Appearance** (toggle sidebar/panel/status bar visibility, zen mode, centered layout) and **Views** (toggle individual activities such as Preview, Details, Chat, and Debug on or off). Toggling an activity off marks it as intentionally hidden in the workspace; startup recovery (`recoverMissingActivities`) skips hidden activities so they stay off across reloads.

### Editor groups (split grid)

The editor area is a recursive split-view tree (VS Code's "grid") defined in `useLayoutGrid.js`. A node is either a **branch** (`direction: 'row' | 'column'`, `children[]`, and `sizes[]` of flex-grow weights) or a **leaf** = an **editor group** holding `tabs[]` + `activeTabId`. `GridView.vue` renders the tree recursively, placing a `Sash.vue` resize handle between siblings; leaves are emitted through a scoped slot so the engine stays generic (it will later host side-bar/panel views too).

`Workbench.vue` holds the reactive tree (`editorRoot`), the focused group (`activeGroupId`), and the maximized group (`maximizedGroupId`). When `maximizedGroupId` is set, `viewRoot` collapses to just that leaf so `GridView` renders only the maximized group. `Workbench` `provide`s an `editorController` (inject key `editorController`) to the groups with the structural ops: `activateTab`, `promoteTab`, `togglePin`, `closeTab`, `dropTab`, `splitActiveGroup`, `applyLayoutPreset`, `closeAllTabs`, `toggleTabPreviews`, `maximizeGroup`, `toggleLockGroup`. New tabs open in the active group; `activeTab` (the active group's active tab) drives the right panel, status bar, and selection. Each `EditorGroup.vue` re-emits its content events (select/open/navigate/…) up to `Workbench`, preserving the centralized-logic pattern. The grid is persisted per workspace (see State management).

Each leaf carries two per-group flags: `tabPreviews` (default `true`) — when `false`, single-click explorer navigation opens a permanent tab instead of the italic preview slot; `locked` — when `true`, the group rejects incoming tab additions and drops from other groups. `EditorGroup` shows a fixed-right actions section outside the scrollable tab strip: a lock icon (when locked, click to unlock) and a `⋯` button that opens a menu with Close All, Enable Tab Previews (toggle), Maximize/Restore Group, and Lock/Unlock Group.

Tabs support preview mode (`mode: 'peek'`, italic, one reused slot per group; promoted to `'normal'` on double-click or navigation), sticky pinning (`pinned`, grouped to the front with a pin affordance), horizontal-scroll overflow with a dropdown, and region-aware drag (see Drag and drop). View ▸ Editor Layout offers split up/down/left/right and presets (Single, Two Columns, Two Rows, Three Columns, Grid 2×2). Keyboard: `Ctrl+\` split right, `Ctrl+1..9` focus group, `Ctrl+W` close tab (Electron only — browser intercepts), `Ctrl+,` open Settings, `Ctrl+Shift+P` open Command Palette.

### Settings modal

`SettingsModal.vue` is a full-screen modal overlay (teleported to `<body>`) styled after VS Code's Settings editor. Layout: a search bar spanning the top, a fixed-width left sidebar listing sections, and a scrollable main area with sticky section headings.

Sections are derived at runtime from `preferences.schema.json` (imported via the `#preferences-schema` alias). Top-level scalar properties form a **General** section; top-level `type: object` properties each become their own named section (Explorer, Preview Panel, Cache, …). Properties marked `x-devOnly` are hidden unless Developer Mode is on.

Every control change updates a local `localPrefs` deep copy immediately (instant UI feedback) and schedules an auto-save via a 300 ms debounce that calls `savePrefs` from `usePreferences`. There is no manual Save button. Settings that differ from their schema default show a small blue dot. A brief `✓ Saved` confirmation appears in the bottom-right corner after each successful write.

`SettingsModal` opens via `Ctrl+,` (checked before the input-focus guard so it works from any context) or Settings ▸ Preferences.

### Keyboard shortcuts modal

`KeyboardShortcutsModal.vue` is a read-only reference modal styled after VS Code's Keyboard Shortcuts editor. It shows all current shortcuts in a grouped table with **Command / Keybinding / When / Source** columns. `<kbd>` elements render each key token with a depressed-border style. The search bar filters across command name, key text, and when-context. Opens via Settings ▸ Keyboard Shortcuts.

### Command palette

`CommandPalette.vue` is a floating modal overlay (teleported to `<body>`) that provides fuzzy command search across all menu items. It opens via `Ctrl+Shift+P` or clicking the omnibar in the title bar.

Commands are sourced by flattening the four menu item arrays (`fileMenuItems`, `editMenuItems`, `viewMenuItems`, `settingsMenuItems`) at open time via `flattenMenuItems()`, which recurses through submenus and emits only leaf items with an `action`, skipping separators and currently-disabled items. Each command carries a `category` string built from the submenu path (e.g. `"View > Editor Layout"`) shown right-aligned in the result row. Toggle items (`type: 'toggle'`) show a checkmark when their `checked()` callback returns true.

Fuzzy scoring ranks results: exact label match → prefix match → substring match → sequential character match → no match (excluded). Results are capped at 50 and re-ranked on every keystroke. Arrow keys navigate, Enter executes (action deferred one frame so the palette closes first), Escape dismisses. The `Ctrl+Shift+P` handler is checked before the early-return guard that skips shortcuts when an input is focused, so the palette can be opened from any context.

### ViewContainer panel system

`ViewContainer.vue` is the unified panel container used for the primary sidebar, secondary sidebar, and bottom panel. It operates in one of two modes depending on the `sections` prop:

- **Sections mode** (`sections` is an array): renders activities as stacked collapsible accordion panels with `Sash.vue` resize handles between them. Used by the primary sidebar (Open Editors + Places).
- **Tabs mode** (`sections` is null): renders a horizontal tab strip at the top; one activity's slot is shown at a time. Used by the secondary sidebar and bottom panel.

**Tab drag**: each tab in tabs mode is HTML5-draggable. Dropping a tab onto another container's tab strip reorders or transfers the tab between containers (secondary sidebar ↔ bottom panel). Module-level `_activeDrag` shared across all `ViewContainer` instances provides a global drag signal without per-instance cleanup.

**Drag-to-merge**: while a tab drag is active, each visible tab slot shows a `ViewDropOverlay` covering the content area. Dropping onto the overlay stacks the dragged activity as a collapsible `ViewSection` inside the target tab's slot — the `mergedSlots` prop tracks these groupings as `{ [primaryId]: [{ id, title, collapsed, size }] }`. Sub-sections resize via sash handles; the `dropDirection` prop controls whether they stack top/bottom (`col`, secondary sidebar) or left/right (`row`, bottom panel). In row mode, sub-sections stay expanded and resize on the X axis. Dragging a merged section's header back to the tab bar extracts it as a standalone tab (via the `fromMergedActivityId` field on the same MIME type, distinguished in `onBarDrop`).

**Slot architecture**: all activity slots (`#preview`, `#details`, `#chat`, `#debug`) are defined in **both** the secondary sidebar and bottom panel ViewContainers in `Workbench.vue`. This allows any activity to be hosted in either container without rendering an empty slot when it moves.

**Activity management**: `PANEL_ACTIVITY_REGISTRY` maps activity IDs to icons and labels. `ACTIVITY_DEFAULT_CONTAINER` maps each ID to its home container. `isActivityVisible` checks all containers and merge groups; `addActivity` places a missing activity back in its default container; `recoverMissingActivities` (called on `onMounted`) restores any activities lost due to corrupted workspace state, skipping those in `hiddenActivities`.

### Context menu

`ContextMenu.vue` renders two independent `<teleport to="body">` elements — one for the main menu panel and one for the submenu panel — so neither is clipped by ancestor `overflow: hidden` containers.

Each menu item has two separate click areas: the `.cm-item-label` span (fires the action) and a `.cm-item-sub-btn` chevron button (opens the submenu). This split-button pattern means clicking the label of an item that has a submenu fires the default action immediately rather than requiring an extra click to open the sub-panel.

Quick-action icon buttons at the top of the menu render MDI SVG icons when `icon` is an MDI path string (detected by `isMdiPath`: starts with `'M'`).

Submenu position is computed from the chevron button's `getBoundingClientRect()` and flipped left if it would overflow the right viewport edge. Main menu position is clamped to the viewport in a `watch` that fires after `nextTick` once the menu DOM is mounted.

### Directory view

`DirectoryTab` fetches directory listings and manages navigation history. It passes items down to `DirectoryPanel`, which applies client-side sort/filter via a `processedItems` computed property, then renders the result through `DirectoryLayout`.

`DirectoryLayout` is a single unified component that handles all view modes — grid (XS through XXL), list, details, gallery-grid, gallery-mosaic, and feed — via a `data-layout` attribute on its root element. All layout-specific behavior is CSS-driven from that attribute. The layout prop is set by the user via a picker button in `DirectoryPanel`.

### Sort and filter

`DirectoryPanel` owns `sortField`, `sortDir`, `filterTypes`, `filterSizePreset`, and `filterDatePreset` refs. A `processedItems` computed property applies all active filters and then sorts, always placing directories first. The active state is shown in a contextual bar below the navigation header with removable chips.

### Explorer tree

`ExplorerTree` owns expanded/collapsed state and lazy-loads children via `/_api/v2/Explorer`. The tree is recursive: `TreeItem` renders a node and its children, forwarding events up through `TreeList` → `ExplorerTree` → `ExplorerPanel` → `Workbench`.

### Event propagation pattern

All user-initiated events (select, navigate, rename, contextmenu, etc.) travel upward via `defineEmits` chains. Every intermediate component just re-emits the event transparently. `Workbench.vue` is the single place that acts on them — updating state, calling the API, or triggering side effects.

This means adding a new event in a leaf component requires threading it through every layer in the chain. This is intentional: it keeps business logic centralized and components dumb.

## State management

No Pinia or Vuex. State lives in:
- `Workbench.vue` `reactive`/`ref` — global app state (editor grid, selection, prefs, clipboard)
- `useWorkspaces.js` — the persisted per-workspace model in `localStorage` (`files-workbench.workspaces`), versioned with forward migration (v1→v2 wraps the flat tabs array into a single-group leaf; v2→v3 renames panel areas to primarySidebar/secondarySidebar/panel and adds `viewContainerOrder`, `mergeGroups`, `hiddenActivities`, and `activeViewContainerId` for the panel containers); serialises the editor grid, sidebar/panel layout, and explorer tree state
- `DirectoryTab.vue` — navigation history, items list, thumbnail map
- `DirectoryPanel.vue` — sort/filter state, layout picker state
- `ExplorerTree.vue` — expanded Set, children cache (also persisted to localStorage)
- Module-level refs in `useTreeDrag.js` — shared drag state across all tree nodes

## Drag and drop systems

There are four independent drag systems:

| System | Used by | Mechanism |
|---|---|---|
| `useDrag.js` | Directory grid/list/table items (left-button) | Custom mousedown → ghost clone, 200 ms delay, `onActivate` callback for multi-select |
| `useRightClickDrag.js` | Directory items (right-button) | Suppresses native `contextmenu` on mousedown; ghost clone on move; resolves to `onRightClick` or `onDrop` on mouseup |
| `useTreeDrag.js` | Explorer tree nodes | Custom mousedown → chip ghost, module-level shared state, directory-only drop targets |
| `useEditorDnd.js` | Editor tabs & groups | Native HTML5 drag with shared module state + region detection (`dropRegion`): dropping on a tab strip reorders/moves a tab; dropping on a group's edge/center splits or merges groups (`DropOverlay.vue` shows the target zone) |
| `ViewContainer.vue` (inline) | Secondary sidebar and bottom panel tabs | Native HTML5 drag with module-level `_activeDrag` ref; tab strip drop reorders or transfers between containers; content-area drop (`ViewDropOverlay`) merges activities into stacked sub-sections; section header drag extracts a merged section back to a standalone tab |

The file drag systems (`useDrag`, `useTreeDrag`, `useRightClickDrag`) do not set `dataTransfer` and therefore cannot interoperate with native OS drop targets.

Right-click drag releases show a "drop action" context menu (`showRightDragDropMenu` in `Workbench.vue`) with Move Here / Copy Here / Create Symlink Here options; if all dragged items are archives, the menu offers Extract Here instead of Compress to Archive Here.

## Click handling

`useClickDebounce` wraps every interactive item to distinguish single-click (select) from double-click (navigate/open). Key properties:
- Modifier keys (Ctrl/Meta/Shift) bypass the delay and fire immediately
- `cancel()` flushes any pending single-click timer (used when rename mode activates to suppress spurious selection)
- The delay is 220 ms — long enough to detect a double-click but shorter than most users' patience

## Preview panel

`PreviewPanel` determines the preview type by checking file extension first (via an `EXT_LANGUAGE` map), then MIME type from the server. This avoids misidentifying `.ts` TypeScript files as `video/mp2t`.

Preview kinds: `text` (Monaco), `html` (iframe + source toggle), `image`, `video` (Video.js), `audio` (Wavesurfer.js), `binary` (no preview).

In dev, file content is fetched from Nitro server routes (`/media-preview`, `/text-preview`) to bypass Vite's proxy size limit on large responses.

## Inline rename

Double-clicking a filename in the tree or directory view opens an inline `contenteditable` span. `v-if`/`v-else` swaps the display span for the edit span — this prevents Vue's virtual DOM from patching over user edits. On commit (Enter or blur) the component emits `rename({ path, newName })` which travels up to `Workbench.handleRename` for the eventual API call.

## Theming

All colors are CSS custom properties defined in `client/assets/css/workbench.css`. The theme JSON files in `config/themes/` are the source of truth for each built-in theme; at startup the app applies them by setting CSS variables on `:root`. The user's accent color overrides `--accent` independently of the theme.

## File operations

`Workbench.vue` handles all mutating file operations (rename, move, copy, trash, delete, compress, decompress, create folder). Every op is enqueued as a serialisable descriptor via `useFileOpsQueue.enqueue({ label, kind, params })` — there are no inline fetch calls for writes. The queue resolves to a Promise that `Workbench` awaits to handle success, errors, and special responses:

- **`requiresElevation`** (403): the server detected a path that needs sudo/admin. The UI shows a password dialog; the caller re-enqueues with the `*_elevated` kind.
- **`missingTool`** (422, decompress only): a required external tool (`7z`, `unrar`) is not installed. The UI shows per-platform install instructions.

Rename uses an optimistic update: `DirectoryTab.renameItem` patches the item in-place immediately; the network op runs in the background; on failure the patch is rolled back.

Reversible operations (rename, move, copy) push an entry to `useActionHistory` so Ctrl+Z / Ctrl+Y work across the session.

## Service worker operations queue

`public/sw.js` is a service worker that maintains a per-client operation queue keyed by `event.source.id`. The lifecycle:

1. App startup calls `swQueue.init()` (plugin `sw.client.js`), which registers the SW and sends `INIT` with `controlBase` and `apiV`.
2. Each `useFileOpsQueue.enqueue()` call sends `ENQUEUE { id, kind, params }` to the SW and stores the op locally as a fallback buffer.
3. When the caller is ready to execute, `swQueue.execute(opIds)` creates one Promise per op in a `_pending` map, then sends `EXECUTE` to the SW.
4. The SW drains its queue and fires all ops **concurrently** via `fetch`. Each op sends `OP_COMPLETE` or `OP_ERROR` back to the client independently.
5. The client's `_onMessage` handler resolves or rejects the corresponding Promise.

If the SW is unavailable (first load, no HTTPS, unsupported browser), `sw-queue.js` falls back to direct `fetch` from the main thread using the same `ENDPOINTS` map.

## Server architecture

The active backend is a Go HTTP server (`server/v2/`) using the stdlib `net/http` package. There is no framework — routes are registered on a `http.ServeMux`. All routes are prefixed with `/_api/v2/`.

The process starts **two independent `http.Server` goroutines** on separate ports:

| Server | Port | Content |
|---|---|---|
| Data | 8001 (`PORT` env) | All read-only GETs — listing, stat, preview, media, icons, preferences |
| Control | 8002 (`CONTROL_PORT` env) | All mutating POSTs/PUTs — rename, move, copy, delete, trash, compress, decompress |

This separation ensures slow thumbnail or listing requests on the data server never delay file-operation responses on the control server — the two goroutines share no locks in the hot path.

Functional areas:

- **fs** — file system CRUD: list directory, stat, rename, move, copy, create file/dir, write file, delete, trash, open with system app; archive files get `kind: "archive"` in listing responses
- **archive** — list archive contents (ZIP, TAR, 7Z, RAR) as virtual directory entries; capabilities endpoint reports available tools
- **permissions** — blocks critical OS paths; detects when elevation is required and returns structured 403 responses
- **exe** (Windows) — extract icon and version metadata from PE resource sections
- **explorer** — directory tree listing: root nodes, home directory, drives, lazy-expandable subtree, exclusion categories
- **media** — thumbnails (image resize via `golang.org/x/image`; video frame and audio artwork extraction via ffmpeg), file metadata, raw file serving
- **icons** — serve icon pack manifest (`/icons/manifest`) and individual SVG icons by definition name (`/icons/svg?name=…`)
- **preferences** — read and write user preferences JSON, serve the preferences JSON Schema
- **perf** — client-side performance log ingestion

Thumbnail generation is handled by `thumbnail.go` and results are stored in a disk-based cache keyed by file path, size, and type. `blacklist.go` loads path exclusion rules from a server-side config file rather than URL parameters.

### Directory customization

`customization.go` reads platform-specific directory customization files at listing time — no extra round-trip needed:

| File | Platform | Parsed fields |
|---|---|---|
| `.directory` | KDE/Dolphin (freedesktop.org) | `Name`, `Icon`, `Comment` from `[Desktop Entry]` |
| `desktop.ini` | Windows | `IconResource`/`IconFile`, `InfoTip` from `[.ShellClassInfo]` |
| `.DS_Store` | macOS | presence only (binary format) |

These reads bypass the blacklist intentionally — the blacklist controls what appears in listing responses; `readDirCustomization` is an internal server read that enriches parent directory metadata.

The `customization` field is embedded in every directory item returned by `list_dir` and the Explorer APIs. `PUT /_api/v2/fs/customization` writes or updates the `.directory` file, using pointer fields in the JSON body so `null` = keep existing value, `""` = clear the field.

The client resolves customization icons via `useCustomIcon.js`: absolute paths are served through `fs/preview`; Dolphin `folder-<color>` names map to CSS colors and render as inline `<svg fill="currentColor">` (bypassing the icon pack `<img>` since CSS `color` cannot tint an image element). Icon priority: custom path → folder-color SVG → icon pack → MDI default.

### Icon pack plugin system

`plugins.go` loads third-party icon packs from `config/plugins/` at startup. Each plugin directory contains a `plugin.json` manifest. The only supported adapter is `vscode-icon-theme`, which reads a VSCode extension icon theme JSON file and builds lookup tables for file extensions, file names, and folder names.

At startup, the first successfully-loaded plugin becomes `activeIconTheme`. Icon names are resolved server-side and embedded in every list and explorer API response as `icon` and `icon_open` string fields. `resolve()` and `resolveOpen()` only return icon names whose SVG files exist on disk, cascading through fallbacks gracefully (named-open → default-open → named-closed → default-closed).

The client composable `useIconPack.js` is a module-level singleton that fetches the manifest once and provides `resolveIcon()`, `iconUrl()`, and `isAvailable` to all components. `<img>` elements that load pack icons fall back to MDI icons via `@error` handlers if the SVG request fails.

A legacy FastAPI/Python server lives in `server/v1/` and is no longer actively used.

## Configuration system

User configuration is read from `config/` at startup. The app merges `user-*.json` over `default-*.json` using a shallow merge. JSON Schema files (`*.schema.json`) validate the merged result. Unknown keys in user files are ignored rather than causing errors, to support forward-compatibility when the schema evolves.

Plugins are loaded from `config/plugins/`. Each subdirectory is a plugin; the server reads `plugin.json` and initializes any supported plugins at startup. Plugin directories are not gitignored — they are part of the repo and can contain bundled or cloned third-party assets.
