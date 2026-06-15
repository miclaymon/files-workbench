# Roadmap

Items roughly ordered by priority. See `TODO.md` for the full flat list.

## Near-term

- **Rename via F2** — trigger inline rename from keyboard in addition to double-click
- **Directory address bar** — history dropdown and path autocomplete in the breadcrumb bar

## Medium-term

- **Keybind customization** — full keyboard shortcut editor in preferences; keybind events bubble through the DOM and can be captured by components
- **Command palette** — fuzzy search over commands, recently visited paths, and open tabs
- **Custom directory icons (extended)** — custom thumbnail support; `[Files Workbench]` section in `.directory` for app-specific overrides; open-variant folder icons require `generateOpenFolderIcons.ts` (needs Bun), currently falls back to closed-folder variant
- **Home page improvements** — recent files, pinned folders, quick-access shortcuts
- **Archive exploration** — browse contents of `.zip`, `.tar`, `.gz`, `.7z`, `.rar` as virtual directories

## Long-term

- **Explorer panel new root nodes** — Favorites, Recently Accessed, Network (SMB/FTP/SFTP), Cloud (Google Drive, OneDrive, Proton Drive)
- **Service worker + WebSocket** — real-time directory change notifications; move heavy data transfer (large directory listings, streaming thumbnails) to a persistent WebSocket channel
- **Background file indexing** — full-text and metadata search index
- **Tab window splitting** — drag a tab out to open it in a new Electron window (like VS Code)
- **MCP integration** — expose file operations as MCP tools

## Known issues / tech debt

- Thumbnail rendering for directories with custom icons (`.directory`, `desktop.ini`) not yet implemented
- Explorer tree does not show a visual indicator when a directory is empty (cannot expand)
- `useDragAndDrop.js` is now orphaned — editor tabs moved to `useEditorDnd.js` (region-aware drop targets); the generic helper can be removed or repurposed
- Old per-layout Vue components (`DirectoryGridLayout.vue`, `DirectoryListLayout.vue`, etc.) remain in `client/components/workbench/` but are no longer used — should be removed once the new unified `DirectoryLayout.vue` is confirmed stable
- Click debounce not yet applied to explorer tree nodes and some directory item edge cases
- Open-folder icon variants for `vscode-material-icon-theme` require `generateOpenFolderIcons.ts` (needs Bun); currently falls back to the closed-folder variant

## Recently completed

- **ViewContainer panel system** — unified `ViewContainer.vue` replaces the old `Panel` component for secondary sidebar and bottom panel; two modes: tabs (one activity visible at a time) and accordion sections (primary sidebar Open Editors + Places); tab drag-to-reorder within a container and cross-container drag between secondary sidebar and bottom panel; drag-to-merge drops a tab onto a panel's content area to stack it as a collapsible sub-section inside the target slot (`mergedSlots`); sub-sections resize with sash handles (top/bottom for secondary sidebar, left/right for bottom panel); section headers drag back to the tab bar to extract; `ViewSection.vue`, `ViewDropOverlay.vue`, and `OpenEditorsView.vue` added as new components

- **Activity management** — `PANEL_ACTIVITY_REGISTRY` + View ▸ Views submenu to show/hide individual activities (Preview, Details, Chat, Debug); hiding marks the activity in `hiddenActivities` so it stays hidden after reload; startup recovery (`recoverMissingActivities`) restores activities lost due to corrupted workspace state; panel action buttons to maximize and hide each panel

- **View menu additions** — View ▸ Appearance submenu with per-element toggle checkmarks (primary sidebar, secondary sidebar, bottom panel, status bar, zen mode, centered layout); View ▸ Views submenu for per-activity toggles; `FloatingMenu` now renders a checkmark glyph for `type: 'toggle'` items with a truthy `checked()` callback

- **Workspace schema v3** — `panel.viewContainerOrder`, `panel.activeViewContainerId`, `panel.mergeGroups`, `panel.hiddenActivities`, and `secondarySidebar.mergeGroups` added to the persisted workspace model; forward-compat backfill patches ensure existing workspaces upgrade automatically; v2→v3 migration renames panel areas to `primarySidebar`/`secondarySidebar`/`panel`

- **Editor split grid** — recursive split-view grid of editor groups (`useLayoutGrid.js` engine, `GridView.vue`/`Sash.vue` renderer, `EditorGroup.vue` leaf); split any group up/down/left/right via tab drag-drop to an edge, View ▸ Editor Layout menu, or `Ctrl+\`; five layout presets; per-group tab-previews toggle, lock, and maximize; `⋯` group actions menu; workspace schema v2 with forward migration; all layout mutations logged to the debug panel

- **Right-click drag-and-drop** — `useRightClickDrag` composable suppresses native `contextmenu` on mousedown (fixes Linux/X11 early-fire), shows ghost clone during drag, resolves to a "drop action" menu on release: Move Here, Copy Here, Create Symlink Here; archives get Extract Here instead of Compress to Archive Here
- **Context menu redesign** — two `<teleport to="body">` panels (main + submenu) prevent clipping; MDI SVG icons in quick-action buttons and item rows; split label/chevron item pattern so label click fires action and chevron opens submenu independently; viewport clamping and submenu left-flip on overflow; 1 px separators
- **Empty-space context menu** — right-clicking the directory background shows New Folder, New File, Open in Terminal, and Paste
- **Open in Terminal** — `POST /_api/v2/fs/open_terminal` tries common Linux terminal emulators in priority order; macOS uses `osascript`; Windows tries Windows Terminal then `cmd.exe`; `fsOpenTerminal()` in `fs-api.js`
- **Clipboard status bar pill** — clipboard mode (Copy/Cut), item count, and total size shown inline in the status bar; replaced the floating clipboard toast
- **Debug panel expandable entries** — click any log row to expand a detail view; SELECT and CLIPBOARD entries render a mini item table (icon/thumbnail, filename, type, size) using the thumbnail URL already loaded in the directory view; other entries render a key/value grid; `summaryText()` shows a preview of filenames on the collapsed row
- **Enriched debug log calls** — NAV logs from/to paths; SELECT logs item count + total size in the message with full item objects for the table; CLIPBOARD Copy/Cut/Paste logs full item list; OPS-QUEUE logs structured source/dest/format data; TAB logs path and kind
- **Preferences save fix** — `usePreferences.js` save() was POSTing to the data server (port 8001); fixed to use `CONTROL_BASE` (port 8002) where `handlePreferencesPut` is registered
- **New File action** — "New File" in toolbar actions and empty-space context menu; prompts for name and creates via the ops queue
- **Directory customization** — server parses `.directory` (KDE/Dolphin), `desktop.ini` (`[.ShellClassInfo]`), and detects `.DS_Store` for each directory in listings; custom name, icon, and comment returned as `customization` field; `GET`/`PUT /_api/v2/fs/customization` endpoints for reading and writing `.directory` files; `useCustomIcon.js` composable resolves Dolphin `folder-<color>` names and absolute icon paths; folder-color tints render as inline `<svg fill="currentColor">` so CSS `color` applies correctly
- **Server-side directory sizes** — `list_dir` now accepts `includeDirSize=true`; sizes are computed concurrently (goroutines + semaphore, capped at 8) for directory items on the current page only; client-side async `dir_size` request-per-directory loop removed
- **Icon pack plugin system** — VSCode icon theme adapter loaded from `config/plugins/`; `vscode-material-icon-theme` bundled as first plugin; icons resolved server-side and embedded in list and explorer API responses; `useIconPack.js` composable for client-side manifest access; MDI fallback on load error
- **Breadcrumb overflow** — ResizeObserver-based detection collapses middle segments into an expandable `···` chip when the path bar overflows; always keeps the first and last two segments visible; clicking `···` shows a dropdown of hidden segments
- **Hover preview centering fix** — image natural dimensions are captured during preload and applied as explicit `width`/`height` on the overlay so `translate(-50%, -50%)` is correct from the first frame (no position snap)
- **Go v2 server** — replaced FastAPI/Python backend with a Go `net/http` server (`server/v2/`) for better concurrency and binary serving performance
- **All directory layouts** — grid (XS, SM, default, MD, LG, XL, XXL), list, details, gallery-grid, gallery-mosaic, and feed, all handled by the unified `DirectoryLayout.vue`
- **Sort and filter** — client-side sort by name/size/type/date (modified, created, accessed); filter by file type group, size preset, and date preset; active-state bar with removable chips
- **Exclusion rules from server config** — excluded file categories loaded server-side from a config file rather than passed as URL parameters
- **Thumbnail caching** — disk-based cache for generated image, video, and audio thumbnails
- **Status bar** — shows item count and total size for the current directory; updates to show selected item count and size when items are selected
