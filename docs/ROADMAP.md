# Roadmap

Items roughly ordered by priority. See `TODO.md` for the full flat list.

## Near-term

- **File/folder delete** — move to trash or permanent delete with confirmation
- **Drop behavior** — complete the drag-and-drop move/copy implementation (visual drop targets exist; server call and optimistic UI update pending)
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
- Tab bar drag uses native HTML5 drag; should be migrated to the custom `useDrag` system for consistency
- Old per-layout Vue components (`DirectoryGridLayout.vue`, `DirectoryListLayout.vue`, etc.) remain in `client/components/workbench/` but are no longer used — should be removed once the new unified `DirectoryLayout.vue` is confirmed stable
- Click debounce not yet applied to explorer tree nodes and some directory item edge cases
- Open-folder icon variants for `vscode-material-icon-theme` require `generateOpenFolderIcons.ts` (needs Bun); currently falls back to the closed-folder variant

## Recently completed

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
