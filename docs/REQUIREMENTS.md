# Requirements

## Core

- Browse the local filesystem in a tabbed interface with multiple tabs open simultaneously
- Navigate directories via double-click, breadcrumb path bar, and keyboard shortcuts
- Support forward/back navigation history per tab
- Display files and folders in multiple layouts: grid, list, table (more layouts planned)
- Show file thumbnails (images, video frames) in directory views
- Explorer sidebar with a collapsible/expandable folder tree

## File operations

- Select single and multiple items (click, Shift+click, Ctrl+click, checkboxes)
- Copy, cut, and paste files and folders
- Rename files and folders inline (double-click on name, F2) with optimistic update and rollback
- Move items via drag-and-drop to a target folder or cut/paste
- Trash items (Del) and permanently delete (Shift+Del)
- Create new folder
- Undo / redo for rename, move, and copy operations (Ctrl+Z / Ctrl+Y)
- Elevation prompt for operations on system-protected paths (sudo/admin password)
- Compress selections to ZIP, TAR, TAR.GZ, or 7Z
- Extract archives; detect and report missing system tools with install instructions
- Browse archives as virtual directories (ZIP, TAR, 7Z, RAR) — navigate in-place with `::` path encoding
- Context menu with common operations on items and empty space

## Preview panel

- Preview the most recently selected file(s) in a side panel
- Images: full-resolution with blurred thumbnail placeholder while loading
- Video: playback via Video.js with transport controls and playback rate
- Audio: waveform via Wavesurfer.js, embedded album art, transport controls
- Code and text files: syntax-highlighted read-only Monaco Editor view
- HTML files: rendered iframe preview with toggle to source view
- Show file dimensions, format, size, and duration metadata below media previews

## Explorer tree

- Show directory hierarchy lazily (children loaded on first expand)
- Persist expanded state across sessions (localStorage)
- Display indent guides on hover
- Support drag-and-drop to move items into folders (drop targets: directories only)
- Show files optionally (configurable; default: directories only)

## Preferences

- Choose app theme (dark, light, black)
- Set accent color
- Toggle: always show checkboxes, show hidden files, show files in explorer
- Choose default directory layout
- Adjust drag activation delay
- All preferences persisted and merged from `config/preferences/`

## Keyboard shortcuts

- Standard file manager shortcuts: Ctrl+C, Ctrl+X, Ctrl+V, Delete, F2 (rename), Enter (open)
- Navigation: Alt+Left/Right (history), Alt+Up (parent), Ctrl+T (new tab), Ctrl+W (close tab)
- Editor layout: Ctrl+\ split right, Ctrl+1–9 focus editor group by index
- Customizable via `config/keybindings/user-keybindings.json`

## Theming

- Built-in themes: dark, light, black (OLED)
- All colors defined as CSS custom properties
- User-defined themes via `config/themes/`

## Extensibility (activities)

- The workbench is composed of **activities** — self-contained feature modules that declare the surfaces they contribute (editor **tab views**, sidebar/panel **views + sections**, and **status-bar widgets**) and an optional runtime **API**
- Activities collaborate only through an internal API, never by reaching into each other directly:
  - **Query** another activity's API (`host.api(id)`)
  - **Capabilities** — read the active activity's published context (e.g. the `selection` capability that Preview and Details consume) without knowing which activity produced it
  - **Pub/sub** — subscribe to app-level events (`active-tab-change`) and per-activity events (Explorer's `selection-change`); a provider activity (Debug) can expose a service (logging) others call
- Activities also **contribute** through the same internal facade (`host.facade`): **commands** (the single source of truth for invokable behaviour — menus, keybindings, and the command palette all reference commands by id), **keybindings**, **menu items** (appended into app-level menus by menu id, while an activity controls its own menus directly), **hooks** (a synchronous ordered transform/veto chain the menu API is built on), **modal editors**, **editor tabs**, and **preference sections** (merged into the Settings panel)
- The command, view, panel, status, and modal registries are **dynamic** — contributions (including whole activities, via `facade.activities.register`) can be added or removed at runtime, the basis for runtime plugin load/unload
- Selection / directory-stats context lives in the activity that owns it (Explorer), shared via its API rather than held globally
- First-party activities use the same internal API a plugin does

## Extensibility (plugins)

- A **plugin** is an out-of-core activity loaded at runtime through a *permission-scoped* view of the Workbench API — the same contribution path as a first-party activity, narrowed by declared permissions
- Each plugin ships a `manifest.json` (id, version, entry, declared `permissions` + `host_permissions`, dependencies) and a `src/plugin.js` entry exporting `activate(api)` / optional `deactivate(api)`; `activate` contributes through `api` and returns a disposer that unwinds everything
- Permissions are two-tier: **front-end** capabilities gate facade slices (`activities`, `commands`, `keybindings`, `menus`, `hooks`, `modals`, `editor`, `preferences`, `events`, `selection`, `query`); **host** permissions gate brokered backend services (`scm:read`/`scm:write`, …) — plugins never touch the filesystem or control server directly
- Plugins are loaded as `{ manifest, module }` pairs with dependency ordering and lifecycle; built-ins ship in-tree today, the archive/sandbox runtime is planned (see Roadmap → Plugin system)
- A first-party **Source Control** plugin (git changes panel, commit graph, branch status) is built entirely through this API as the reference implementation; authoring is documented in `docs/PLUGINS.md`

## Non-functional

- Fast directory listing for large directories (thousands of files)
- Thumbnail caching (server-side SQLite, planned)
- Runs as a native Electron app on Linux, macOS, and Windows
- Also usable as a web app in a browser (limited by browser sandboxing)
