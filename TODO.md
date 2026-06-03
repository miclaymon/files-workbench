# TODO

- [x] Critical: fix bug with /list_dir requests
- [x] Server generates lower resolution thumbnails to be rendered in directory lists. The layout will adjust a `size` URL parameter depending on the view/layout it will be rendered in. Obviously, `grid-xxl` layout will use much high resolution thumbnails (about size=256) versus regular `grid` (about size=64) and more than `details` layout (about size=32). We will cache the generated images shortly after implemented this. When a thumbnail is requested from the server which is a cache hit, we can maybe do a 3XX redirect to the cached resource in the tmp directory instead. And we can also try to serve the image with cache headers so that we can hint that the browser should cache it.
  - [ ] ~~I think Nuxt has image modules that might allof for optimizations -- let's consider that and see if it's worth it for what we need.~~
- [x] Explorer Tree Items: change dropdown icon from the triangle to use a chevron like the breadcrumb paths do in DirectoryTab views
- [x] Remember last folder tree state and restore
  - TODO: later, remember tabs and sidebar and panel states - but important consideration since we may want to make it so that we can easily save/load the app state, not just one component
- [x] Fix/update preview endpoint so that it actually works
- [] Fix: add debounce for single-click, double-click handling (applies the explorer tree view nodes, directory view items, etc.)
- [x] Fix: make images in file items `user-select: none` but allow the file item to be custom draggable and handled by other drop areas depending on the allow contexts (well add the drop-targets and behavior later)
  - When dragging the item it should not change the flow of surrounding items: instead when dragging an item, a new floating copy of the dragging item is created that can move with the mouse and be dropped on a target. the original item simply reduces its opacity. There should be maybe a 200ms delay before a drag is actually trigger to avoid accidental activation on clicks and that timing can be adjusted in the user preferences.
  - [ ] How do Electron apps like Notion and VS Code handle dragging tabs? You can drag to reorder tabs in a tablist or you can drag the tab our and it spawns a new Electron window with that tab in it. Is it just checking if the drag target is still within the drag list or using an IntersectionObserver?
- ~~Fix: Explorer panel: for direcotires in the tree which do not have any children leave the collapse/expand icon not rendered and don't allow it to be toggled since there is nothing inside it (only when showing directories only)~~
- [x] Update documentation: README.md, AGENTS.md, ./docs/*
- [x] Create a folder for user configuration which has preferences/user-preferences.json, preferences/default-preferences.json, preferences/preferences.schema.json, keybindings/user-keybindings.json, keybindings/default-keybindings.json, keybindings/keybindings.schema.json, themes/dark.json, themes/light.json, themes/black.json, plugins/ (empty).
- [x] Update exlcusion rules for system files to be loaded server side from file instead of using URL parameter.
- [x] Server-side SQLite DB for caching FastAPI request/responses, lower resolution thumbnails for images, videos, audio files cached in OS temp directory in folder for this app. Cache quota can be adjusted in perferences.json (which can be edited in the preferences section of the UI)
- [x] Break up parts of preview panel into different components
- [x] Make more usable generic panel that has a small header with a panel title heading on the left and some action buttons on the right.
- [x] Adjust layout structure so that preview panel is not inside of workspace-body, but is instead a sibling of the other sidebar  editor-area inline
- [x] Footer status bar should show "Directory: #,### items | ## GB" and (if num selected items > 0) "Selected:" ## items selected | ## GB" on the left side (where "Ready" is now). We can still show Connected in the bottom right, but it should indicate that acutal connection status to the server.
- [ ] Explorer panel: new root nodes: Favorites, Recently accessed, Network (SMB, FTP, SFTP), Cloud (to be implemented later: Google Drive, OneDrive, Proton Drive)
- [x] Directory View: other layouts: `grid-xs`, `grid-sm`, `grid-md` (current), `grid-lg`, `grid-xl`, `grid-xxl`, `details`, `list`, `gallery-grid`, `gallery-mosaic`, `feed`, `content`
- [x] Grid item hover to show a hovering preview of media
- [ ] Support for directory customizations and custom thumbnails (.directory and desktop.ini files, with custom extension to .directory under `[Files Workbench]`)
- [ ] Other improvements to tabs and tab views
- [ ] Keybinds to toggle side bars and panel; keybind customization; kyebind custom events hooks (events are dispatched and bubble up through DOM like normal events but can be hook into or captured on the way up by some components)
- [ ] Improvements to Home page
  - [ ] Working storage space indicators
- [x] Intergration with `vscode-material-icon-theme` (https://github.com/material-extensions/vscode-material-icon-theme/releases) to automatically apply custom folder icons based on the same rules and icons from that extension
- [ ] Service worker to help with handling networking
  - [ ] Service worker has a WebSocket connection to the server for more realtime data transfer (listing directories, fetching metadata, sending commands to perform file operations, etc.)
- [ ] Improvements to themes (adjustments to dark and black themes)
- [ ] Directory Tab address bar history and autocomplete
- [ ] Command pallete: search, recents, actions, queries
- [ ] Aggressive pre-fetching feature: hovering over an item will prefetch the preview API endpoint to warm it up and potentially get the server to cache to repsonse
- [x] Breadcrumbs: if longer than about 80% of the container (we could use container queries?) for the path, show ellipses ('...') instead of some of the middle items (always show the first 2 breadcrumb items and the last 2 breadcrumb items, any in between those can be condensed to the overlow breadcrumb denoted with ellipses). Clicking on the overflow breadcrumb will is somehwat similar to how the carets between them trigger a dropdown, but the dropdown will represent the nested directories. Each option in the dropdown for the overflow breadcrumb will have the following indent icon to denote that it's a sub-item, and clicking the options does that same thing as it would do for the other breadcrumbs and navigate to that path.
  - If the breadcrumbs are still too longs after these changes then it can overflow-x within the box, but hopefully the overflow breadcrumb will make that unlikely (unless the folder names are very very long)
- [ ] Pinned items in directories
- [ ] Storage side menu option

- [ ] File operations functionality: rename, delete, move, copy/cut/paste

- [ ] MacOS: .app archive -> .plist (metadata)
- [ ] Archive exploration (.zip, .rar, .tar, .gz, .7z)
- [ ] 
- [ ] .git plugin/features
- [ ] Background file indexing and search optimization

- [ ] PowerRename(TM)
- [ ] LLM chat

- [ ] Launch Electron app with `--read-only` flag which disables renaming, deleting, moving, creating (pasting) files. The user can only view and copy files.

- [ ] MCP
- [ ] System file open handler
- [ ] Disk operations: format and create partitions, mount drives (`gparted`)
