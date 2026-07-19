# Files Workbench

A desktop file manager built with Electron + Vue 3 (Vite) on the front end and a Go HTTP server on the back end. It runs as a native Electron app in production and as a browser SPA in development.

> **Refactor in progress** — this branch (`refactor/multi-package`) is splitting the
> monolith into reusable packages (`@workbench/framework`, `@workbench/vue`,
> `@files-workbench/core`, `@workbench/plugin-sdk`). See [`PLAN.md`](PLAN.md) for the
> package map, decisions, and milestone status.

## Features

- Split-pane editor grid: split any group up/down/left/right via drag-drop, View ▸ Editor Layout menu, or `Ctrl+\`; five layout presets (Single, Two Columns, Two Rows, Three Columns, Grid 2×2); per-group lock and maximize; tab previews toggle
- Multi-tab directory browsing with navigation history and breadcrumbs (overflow-collapsing with expandable `···` chip)
- Multiple directory view layouts: grid (XS through XXL), list, details, gallery grid, gallery mosaic, and feed
- Client-side sort (name, size, type, date modified/created/accessed) and filter (by file type, size, date) with a contextual active-state bar showing removable chips
- Explorer sidebar tree with expandable folders, indent guides, and drag-and-drop
- File preview panel: images, video (Video.js), audio (Wavesurfer.js + embedded album art), code/text (Monaco Editor), HTML (rendered iframe + source toggle), Markdown (formatted document via markdown-it); single-item previews support click-to-zoom (contain ↔ cover) and double-click to open a near-fullscreen **lightbox**, and can be promoted to a dedicated **editor tab**
- Editor-tab actions: the active tab contributes actions to the editor toolbar (like sidebar/panel view actions) — e.g. a Markdown tab offers **Open as Preview** and **Open Preview to the Side** (rendered document in the same or a split group)
- Hover preview overlay: hovering a grid item shows a floating media preview centered on the thumbnail
- Media thumbnails: images resized server-side; video frame extraction and audio artwork via ffmpeg; disk-based thumbnail cache
- Icon pack plugin system: a first-party **Material Icon Theme** plugin registers a `getIcon` handler through the Workbench API (the `icons` permission) and resolves file/folder icons (VS Code `vscode-material-icon-theme` assets, served by the Go backend) — shown in directory views, the explorer tree, source control, and details; the active pack is selectable and falls back cleanly to built-in MDI glyphs
- Folder customization: per-folder name, icon (absolute/relative image path or Dolphin `folder-<color>`), and comment read from `.directory` / `desktop.ini`, with a lossless read/write API storing app-specific keys under an `[X-Files-Workbench]` group
- Pinned items: pin files or folders (item context menu) to keep them grouped first in a directory; stored with the folder in its `.directory`
- File operations: rename (F2, optimistic), move (drag-and-drop, cut/paste), copy/cut/paste, trash (Del), permanent delete (Shift+Del), create folder — with undo/redo
- System path protection: critical paths (root, /etc, /sys, …) are blocked; operations on protected paths trigger a sudo/admin elevation prompt
- Compression and extraction: compress to ZIP/TAR/TAR.GZ/7Z; extract with missing-tool detection and per-platform install instructions
- Archive browsing: ZIP, TAR, 7Z, and RAR archives open as virtual directories in-place; archives expand in Nested layout like directories
- Windows .exe metadata: icon and version info (name, publisher) extracted from PE resources and shown in directory views
- macOS .app bundles: open with OS on double-click; "Browse Contents" option available in context menu
- Service worker operations queue: file-write ops are enqueued as serializable descriptors, executed concurrently by a service worker, and resolved back to the UI as Promises
- Inline file renaming in tree and directory views
- Custom drag-and-drop with ghost element and 200 ms activation delay
- Context menus, clipboard (cut/copy/paste), multi-select with Shift and Ctrl/Cmd
- Preferences panel (theme, accent color, layout defaults, explorer options) assembled dynamically from a base schema plus activity/plugin-contributed sections; modal editors (Settings, Keyboard Shortcuts) with a shared titlebar (maximize / open-in-main-window)
- Command palette with mode prefixes (`>` commands, `?` mode list, Go-to-File), per-row key chords, and recently-used; live Keyboard Shortcuts viewer driven by the command + keybinding registries
- Activity architecture: the UI is composed of self-contained **activities** (Explorer, Preview, Details, Debug, …) that contribute editor-tab / sidebar-panel / status-bar / modal surfaces plus **commands, keybindings, and menu items**, and collaborate through a frozen internal facade (query, capabilities, pub/sub, hooks). Commands are the single source of truth; the registries are dynamic (runtime register/unregister)
- Plugin system: out-of-core features authored against a permission-scoped Workbench API and loaded at runtime (manifest + permissions, Chrome-style). A first-party **Source Control** plugin (git changes panel, commit graph, branch status) is built entirely through it as the reference — see [`docs/PLUGINS.md`](docs/PLUGINS.md)

## Tech stack

| Layer | Technology |
|---|---|
| Desktop shell | Electron 34 |
| Frontend framework | Vue 3 + Vite |
| Workbench core | [`@workbench/framework`](https://github.com/miclaymon/files-workbench-framework) (local sibling checkout `../workbench-framework`) |
| Code editor | Monaco Editor |
| Video player | Video.js |
| Audio waveform | Wavesurfer.js |
| Icons | `@mdi/js` (Material Design Icons) |
| API server | Go 1.23 (stdlib `net/http`) |
| Image processing | `golang.org/x/image` |
| Video/audio thumbnails | ffmpeg / ffprobe (external) |

## Prerequisites

- Node.js 20+
- npm 10+
- Go 1.23+
- ffmpeg (for video/audio thumbnail generation)

## Install (pre-alpha)

Prebuilt, self-contained desktop builds bundle the Go server and launch it
automatically. See [`docs/GETTING_STARTED.md`](docs/GETTING_STARTED.md) for details.

```bash
# Linux (downloads the latest AppImage from GitHub Releases)
curl -fsSL https://raw.githubusercontent.com/miclaymon/files-workbench/main/install.sh | bash
```

```powershell
# Windows (downloads + runs the latest installer)
irm https://raw.githubusercontent.com/miclaymon/files-workbench/main/install.ps1 | iex
```

> Pre-alpha builds are unsigned — Windows SmartScreen / macOS Gatekeeper will warn;
> choose "More info → Run anyway". Releases are published manually for now.

## Quick start (development)

```bash
# Install all dependencies
./setup.sh

# Start Vite dev server + Go server + Electron
npm run dev
```

### Running parts separately

```bash
# Frontend only (browser at http://localhost:3000)
npm run dev:web:client

# Frontend + Go server together (browser, no Electron)
npm run dev:web

# Full Electron desktop app (frontend + Go server + window)
npm run dev:electron        # `npm run dev` is an alias

# Go server only (data: http://localhost:8001, control: http://localhost:8002)
npm run dev:server
```

## Build a desktop app

```bash
npm run build:electron      # compiles the Go server, generates the client, packages with electron-builder
```

Output goes to `client/dist-electron/` (`.AppImage` on Linux, `.dmg` on macOS,
`.exe`/NSIS on Windows — for the platform you build on). The Go server binary and
read-only config are bundled into the app and spawned by the Electron main process
at startup (fixed ports 8001/8002).

## Project structure

```
files-workbench/
├── client/                   Vue 3 SPA (Vite) + Electron shell
│   ├── index.html            Vite entry page
│   ├── main.js               App entry: mounts Workbench, registers the service worker
│   ├── vite.config.js        Vite config (aliases, dev server)
│   ├── assets/css/           Global CSS variables and base styles
│   ├── activities/           First-party activity modules — each declares its tab/panel/status surfaces + runtime API (Workbench shell only; the rest are plugins)
│   ├── builtin-plugins/      Explorer only — the one core-bundled plugin (owns the selection capability, read synchronously at startup); every other first-party plugin loads at runtime from the root-level /plugins tree
│   ├── plugin-sdk/           @fw/sdk — the host SDK surface (Vue, UI models, safe composables/components) that plugin clients import, externalized to the app at build
│   ├── components/workbench/ All UI components
│   ├── composables/          Vue composables, grouped:
│   │   ├── plugins/          Runtime plugin delivery (fetch + hash-verify + import → framework plugin host)
│   │   ├── interaction/      UI-behavior primitives (drag systems, click, hover, resize)
│   │   ├── workbench/        Workbench assembly-root slices (editor grid, view layout, file ops, …)
│   │   └── *.js              Foundational app services (workspaces, preferences, queues, file tree, …)
│   │                         (the activity host, registries, plugin system, UI models, and layout
│   │                          engine live in the @workbench/framework package)
│   ├── electron/             Electron main process
│   ├── lib/                  API client helpers (fs-api.js, sw-queue.js, …)
│   └── public/               Static assets served as-is (sw.js — service worker)
├── plugins/                  First-party plugin source tree — one dir per plugin (manifest.json + client/ and/or server/), built to runtime artifacts by npm run build:plugins. material-icon-theme is a thin re-export of the standalone files-workbench-material-icons package (installed as a local file: dependency)
├── plugins.lock.json         Committed content-hash pins for first-party plugin artifacts (the integrity root of trust the loader verifies against)
├── config/                   User configuration and defaults
│   ├── preferences/          App preferences JSON + schema
│   ├── keybindings/          Keyboard shortcut definitions
│   ├── themes/               Theme color definitions
│   └── plugins/              Built server-plugin WASM backends + icon-pack assets the Go server serves (output of npm run build:plugins; installed apps also read third-party plugins from userData/plugins)
├── docs/                     Project documentation
├── server/v1/                Go HTTP backend (data + control servers)
│   └── *.go                  Route handlers, media processing, thumbnail cache
├── install.sh                Linux installer (downloads latest AppImage)
├── install.ps1               Windows installer (downloads latest installer)
├── setup.sh                  One-shot dependency installation
└── start-dev.sh              Start all dev servers together
```

## API servers

The Go process starts two independent HTTP servers:

| Server | Default port | Purpose |
|---|---|---|
| Data | 8001 (`PORT` env) | Read-only GETs — directory listing, stat, media, icons, preferences |
| Control | 8002 (`CONTROL_PORT` env) | Mutating POSTs/PUTs — rename, move, copy, delete, trash, compress, … |

All routes are prefixed with `/_api/v1/`. There is no dev proxy — the client talks to both servers directly with absolute URLs in dev and packaged builds alike (CORS is permissive on the Go side). The defaults live in `client/lib/api-config.js` (`http://127.0.0.1:8001` / `http://localhost:8002`) and can be overridden with `VITE_API_BASE` / `VITE_CONTROL_BASE` in `client/.env` (see `client/.env.example`).

## Configuration

User-editable configuration lives in `config/`. See [`docs/DESIGN.md`](docs/DESIGN.md) for the full schema description.

## Documentation

| File | Contents |
|---|---|
| [`docs/DESIGN.md`](docs/DESIGN.md) | Architecture, component model, key design decisions |
| [`docs/GETTING_STARTED.md`](docs/GETTING_STARTED.md) | Detailed dev environment setup |
| [`docs/REQUIREMENTS.md`](docs/REQUIREMENTS.md) | Feature requirements |
| [`docs/ROADMAP.md`](docs/ROADMAP.md) | Planned features and known issues |
| [`docs/PLUGINS.md`](docs/PLUGINS.md) | Plugin authoring guide: manifest, permissions, API, contribution points |
| [`AGENTS.md`](AGENTS.md) | Guide for AI coding agents working on this repo |
