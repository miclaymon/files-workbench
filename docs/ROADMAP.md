# Roadmap

Items roughly ordered by priority. See `TODO.md` for the full flat list.

## Near-term

- **File/folder delete** — move to trash or permanent delete with confirmation
- **Drop behavior** — complete the drag-and-drop move/copy implementation (visual drop targets exist; server call and optimistic UI update pending)
- **Rename via F2** — trigger inline rename from keyboard in addition to double-click
- **Directory address bar** — history dropdown and path autocomplete in the breadcrumb bar
- **Hover preview** — hovering a grid/list item shows a floating media preview; prefetches the preview API endpoint to warm server caches

## Medium-term

- **Keybind customization** — full keyboard shortcut editor in preferences; keybind events bubble through the DOM and can be captured by components
- **Command palette** — fuzzy search over commands, recently visited paths, and open tabs
- **Custom directory icons** — read `.directory` and `desktop.ini` for per-folder icon overrides; integrate `vscode-material-icon-theme` icon set
- **Home page improvements** — recent files, pinned folders, quick-access shortcuts
- **Archive exploration** — browse contents of `.zip`, `.tar`, `.gz`, `.7z`, `.rar` as virtual directories

## Long-term

- **Explorer panel new root nodes** — Favorites, Recently Accessed, Network (SMB/FTP/SFTP), Cloud (Google Drive, OneDrive, Proton Drive)
- **Service worker + WebSocket** — real-time directory change notifications; move heavy data transfer (large directory listings, streaming thumbnails) to a persistent WebSocket channel
- **Background file indexing** — full-text and metadata search index
- **Plugin system** — third-party plugins loaded from `config/plugins/`
- **Breadcrumb overflow** — truncate middle segments with an expandable `…` when the path bar overflows
- **Tab window splitting** — drag a tab out to open it in a new Electron window (like VS Code)
- **MCP integration** — expose file operations as MCP tools

## Known issues / tech debt

- Thumbnail rendering for directories with custom icons (`.directory`, `desktop.ini`) not yet implemented
- Explorer tree does not show a visual indicator when a directory is empty (cannot expand)
- Tab bar drag uses native HTML5 drag; should be migrated to the custom `useDrag` system for consistency
- Old per-layout Vue components (`DirectoryGridLayout.vue`, `DirectoryListLayout.vue`, etc.) remain in `client/components/workbench/` but are no longer used — should be removed once the new unified `DirectoryLayout.vue` is confirmed stable
- Click debounce not yet applied to explorer tree nodes and some directory item edge cases

## Recently completed

- **Go v2 server** — replaced FastAPI/Python backend with a Go `net/http` server (`server/v2/`) for better concurrency and binary serving performance
- **All directory layouts** — grid (XS, SM, default, MD, LG, XL, XXL), list, details, gallery-grid, gallery-mosaic, and feed, all handled by the unified `DirectoryLayout.vue`
- **Sort and filter** — client-side sort by name/size/type/date (modified, created, accessed); filter by file type group, size preset, and date preset; active-state bar with removable chips
- **Exclusion rules from server config** — excluded file categories loaded server-side from a config file rather than passed as URL parameters
- **Thumbnail caching** — disk-based cache for generated image, video, and audio thumbnails
- **Status bar** — shows item count and total size for the current directory; updates to show selected item count and size when items are selected
