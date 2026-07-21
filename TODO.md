# TODO

- [x] Explorer Tree Items: change dropdown icon from the triangle to use a chevron like the breadcrumb paths do in DirectoryTab views
- [x] Remember last folder tree state and restore
  - TODO: later, remember tabs and sidebar and panel states - but important consideration since we may want to make it so that we can easily save/load the app state, not just one component
- [x] Fix/update preview endpoint so that it actually works
- [x] Fix: add debounce for single-click, double-click handling (applies the explorer tree view nodes, directory view items, etc.)
- [x] Fix: make images in file items `user-select: none` but allow the file item to be custom draggable and handled by other drop areas depending on the allow contexts (well add the drop-targets and behavior later)
  - When dragging the item it should not change the flow of surrounding items: instead when dragging an item, a new floating copy of the dragging item is created that can move with the mouse and be dropped on a target. the original item simply reduces its opacity. There should be maybe a 200ms delay before a drag is actually trigger to avoid accidental activation on clicks and that timing can be adjusted in the user preferences.
  - [ ] How do Electron apps like Notion and VS Code handle dragging tabs? You can drag to reorder tabs in a tablist or you can drag the tab our and it spawns a new Electron window with that tab in it. Is it just checking if the drag target is still within the drag list or using an IntersectionObserver?
- [ ] Explorer panel: new root nodes: Favorites, Recently accessed, Network (SMB, FTP, SFTP), Cloud (to be implemented later: Google Drive, OneDrive, Proton Drive), Libraries
- [x] Directory View: other layouts: `grid-xs`, `grid-sm`, `grid-md` (current), `grid-lg`, `grid-xl`, `grid-xxl`, `details`, `list`, `gallery-grid`, `gallery-mosaic`, `feed`, `content`
- [x] Grid item hover to show a hovering preview of media
- [x] 3️⃣ Support for directory customizations and custom folder icons (.directory and desktop.ini files, with custom extension to .directory under `[X-Files-Workbench]`)
- [ ] Keybinds to toggle side bars and panel; keybind customization; kyebind custom events hooks (events are dispatched and bubble up through DOM like normal events but can be hook into or captured on the way up by some components)
- [ ] Improvements to Home page
  - [ ] Working storage space indicators
- [x] Service worker to help with handling networking, queueing operations
  - [ ] Service worker has a WebSocket connection to the server for more realtime data transfer (listing directories, fetching metadata, sending commands to perform file operations, etc.)
- [ ] Improvements to themes (adjustments to dark and black themes)
- [ ] Directory Tab address bar history and autocomplete
- [x] Command pallete: search, recents, actions, queries (mode-prefix architecture: `>` commands wired, `?` mode list, Go-to-File stub; per-row chords; recently-used)
  - [ ] Need some improvements here
- [ ] Keyboard Shortcuts modal: enable "Open Keyboard Shortcuts (JSON)" titlebar action (currently disabled). Blocked on two prerequisites: (1) keybindings loaded/merged from `config/keybindings/*.json` into the registry so the JSON actually drives bindings; (2) a code-editor tab kind so the file can open as an in-app editor tab (or a config-path API + `fsOpenWithSystem` for an OS-editor stopgap). See `client/components/workbench/ui/KeyboardShortcutsModal.vue`.
- [ ] Keyboard Shortcuts modal: make read-only viewer editable (rebind, conflict detection, write-through to user-keybindings.json) once keybindings are file-backed.
- [x] Breadcrumbs: if longer than about 80% of the container (we could use container queries?) for the path, show ellipses ('...') instead of some of the middle items (always show the first 2 breadcrumb items and the last 2 breadcrumb items, any in between those can be condensed to the overlow breadcrumb denoted with ellipses). Clicking on the overflow breadcrumb will is somehwat similar to how the carets between them trigger a dropdown, but the dropdown will represent the nested directories. Each option in the dropdown for the overflow breadcrumb will have the following indent icon to denote that it's a sub-item, and clicking the options does that same thing as it would do for the other breadcrumbs and navigate to that path.
  - If the breadcrumbs are still too longs after these changes then it can overflow-x within the box, but hopefully the overflow breadcrumb will make that unlikely (unless the folder names are very very long)
- [x] 2️⃣ Pinned items in directories
- [ ] Storage side menu option
- [ ] Activity/View/Section-level option to remember state on new session or reset
- [x] 1️⃣ Tabs persistent (no re-render when switching tabs -- tab loads once and remains until closed to avoid loading multiple times and increase responsiveness)

- [x] File operations functionality: rename (optimistic), delete, trash, move (drag+drop, cut/paste), copy/cut/paste, create folder, compress, extract, undo/redo, elevation prompt
- [x] Bug fix: for our hover tooltip on directory items we don't allow it over thumbnails because those have a dedicated hover preview thumbnail behavior. however, the icons do not have that behavior so we can still show the tooltip over those.
- [ ] Git initialize repository confirmation flow?
- [x] Preview activity single item zoom toggle and double click for Lightbox Portal
- [x] 5️⃣ ~Hover preview thumbnail~ hold space to open a hover preview of any kind including text files
  - [x] Directory preview to look at child folders and files
- [x] Preview text and markdown files in tabs, images and videos and audio in tabs
- [x] Debug preview panel filter does not actually show dropdown with toggle butons to choose when levels are show, it seems to cycle through them one at a time
- [x] 4️⃣ Preview markdown as formatted markdown document
- [x] 6️⃣ Real-time updating for directories while being processed (loading spinner and slight opacity pulse to show that it's in progress and the value is not final) - this will be in the status bar, details panel, directory layout info widget, but not in the tooltip in directory layout
- [ ] Adjustments to floating menus
  - [ ] Composable floating menu
  - [ ] floating menu siblings - while menu active hover over sibling menu open targets to swithc to that menu instead
  - [ ] Bounding box margins  for hover
- [ ] Spawn another window instance when dragging a tab out of a window; move tab into windoiw (potentially closing empty window instance)

- [x] MacOS: .app bundles — kind: "app", launch with OS, "Browse Contents" in context menu
- [x] Archive exploration (.zip, .rar, .tar, .gz, .7z) — virtual directory browsing with :: path encoding, nested layout expand
- [ ] 


- [ ] Truly break up into separate `files-workbench-core` project which has `files-workbench-core-linux`, `files-workbench-core-windows`, `files-workbench-core-darwin` and a separate `files-workbench` (UI) which should be able to connect to any of the core processes using the same standardized methods even if the core has different code for each platform (Windows has NTFS file table, MacOS has journal, Linux...doesn't)
- [ ] Launch Electron app with `--read-only` flag which disables renaming, deleting, moving, creating (pasting) files. The user can only view and copy files.
- [~] Background file indexing and search optimization — Phase 1 done (2026-07-20): a
  standalone `fw-indexer` service (in `@files-workbench/core`, SQLite FTS5) with
  instant name/path substring search, live incremental updates (fsnotify) + SSE feed,
  core spawn/supervise + proxy, and the real Search panel. See
  `../files-workbench-core/docs/INDEX.md`. Remaining: content full-text (Phase 2),
  native USN/Spotlight backends (Phase 3), roots-as-preference. (Also unblocks the
  command palette's Go-to-File mode and can back dir-size/recents later.)

- [ ] PowerRename(TM) + Macros

- [ ] System file open handler
- [ ] Sync service: Proton Drive, Google Drive, Dropbox, OneDrive, NextCloud
- [ ] MCP server
- [ ] LLM chat (Ollama, LMStudio)
- [ ] Disk operations: format and create partitions, mount drives (`gparted`)

- [ ] Aggressive pre-fetching feature: hovering over an item will prefetch the preview API endpoint to warm it up and potentially get the server to cache to repsonse
- [ ] Some sort of preload so that the UI in windows can load faster from running in the background even when the window gets closed
- [x] Electron first paint: killed the blank white screen shown before the app layout appears (2026-07-20). `electron/main.js` creates the window with `show: false` + a theme-matched `backgroundColor` (read from the saved theme, with a 10s force-show safety net) and reveals it on `ready-to-show`; `index.html` carries an inline CSS-only chrome skeleton whose background comes from `localStorage['fw:theme-bg']` (persisted by `usePreferences` on load/save) so a light/black theme never flashes; `main.js` fades it out after first paint, with a hard 10s removal fallback in the HTML itself. SSR was considered and rejected — prerender+hydration is real complexity for a local SPA with no network latency to hide.
  - [ ] Follow-up: themes are still not actually applied at runtime — `workbench.css` hardcodes the dark palette on `:root` and nothing consumes `config/themes/*.json` (so the `theme` preference only selects the boot background today). Wire real theme switching, then drop the duplicated `THEME_BG` tables in `electron/main.js` + `usePreferences.js`.
