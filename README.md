# Files Workbench 2

A desktop file manager built with Electron + Nuxt 3 (Vue 3) on the front end and a Go HTTP server on the back end. It runs as a native Electron app in production and as a browser SPA in development.

## Features

- Split-pane editor grid: split any group up/down/left/right via drag-drop, View ▸ Editor Layout menu, or `Ctrl+\`; five layout presets (Single, Two Columns, Two Rows, Three Columns, Grid 2×2); per-group lock and maximize; tab previews toggle
- Multi-tab directory browsing with navigation history and breadcrumbs (overflow-collapsing with expandable `···` chip)
- Multiple directory view layouts: grid (XS through XXL), list, details, gallery grid, gallery mosaic, and feed
- Client-side sort (name, size, type, date modified/created/accessed) and filter (by file type, size, date) with a contextual active-state bar showing removable chips
- Explorer sidebar tree with expandable folders, indent guides, and drag-and-drop
- File preview panel: images, video (Video.js), audio (Wavesurfer.js + embedded album art), code/text (Monaco Editor), HTML (rendered iframe + source toggle)
- Hover preview overlay: hovering a grid item shows a floating media preview centered on the thumbnail
- Media thumbnails: images resized server-side; video frame extraction and audio artwork via ffmpeg; disk-based thumbnail cache
- Icon pack plugin system: a first-party **Material Icon Theme** plugin registers a `getIcon` handler through the Workbench API (the `icons` permission) and resolves file/folder icons (VS Code `vscode-material-icon-theme` assets, served by the Go backend) — shown in directory views, the explorer tree, source control, and details; the active pack is selectable and falls back cleanly to built-in MDI glyphs
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
| Frontend framework | Nuxt 3 / Vue 3 |
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

## Quick start

```bash
# Install all dependencies
./setup.sh

# Start Nuxt dev server + Go server + Electron
./start-dev.sh
```

### Running parts separately

```bash
# Frontend only (browser at http://localhost:3000)
npm run dev:client

# Electron desktop app (opens window automatically)
npm run dev:client:electron

# Go server only (data: http://localhost:8001, control: http://localhost:8002)
npm run dev:server:v2

# Frontend + Go server together (no Electron)
npm run dev:v2
```

## Project structure

```
files-workbench2/
├── client/                   Nuxt 3 SPA + Electron shell
│   ├── assets/css/           Global CSS variables and base styles
│   ├── activities/           First-party activity modules — each declares its tab/panel/status surfaces + runtime API (Workbench shell only; the rest are plugins)
│   ├── builtin-plugins/      First-party plugins loaded through the plugin host (Explorer, Source Control, Preview, Details, Debug, Material Icon Theme, Chat, Search, Storage, Converter)
│   ├── models/               UI model classes (ui/: Activity, View, …) + plugin model (plugin/: manifest, permissions)
│   ├── components/workbench/ All UI components
│   ├── composables/          Vue composables, grouped:
│   │   ├── activity/         Inter-activity API: event emitter + activity host (broker) + contribution registries
│   │   ├── plugins/          Plugin loader: permission-scoped API factory + plugin host (load/unload, lifecycle)
│   │   ├── interaction/      UI-behavior primitives (drag systems, click, hover, resize)
│   │   ├── workbench/        Workbench assembly-root slices (editor grid, view layout, file ops, …)
│   │   └── *.js              Foundational services (workspaces, preferences, queues, registries, …)
│   ├── electron/             Electron main process
│   ├── lib/                  API client helpers (fs-api.js, sw-queue.js, …)
│   ├── pages/                Nuxt pages (single page: index)
│   ├── plugins/              Nuxt plugins (sw.client.js — service worker registration)
│   ├── public/               Static assets served as-is (sw.js — service worker)
│   └── server/routes/        Nitro server routes (dev proxy workaround for large/binary responses)
├── config/                   User configuration and defaults
│   ├── preferences/          App preferences JSON + schema
│   ├── keybindings/          Keyboard shortcut definitions
│   ├── themes/               Theme color definitions
│   └── plugins/              Third-party plugins (e.g. material-icon-theme)
├── docs/                     Project documentation
├── server/v2/                Go HTTP backend (active)
│   └── *.go                  Route handlers, media processing, thumbnail cache
├── server/v1/                FastAPI/Python backend (legacy, superseded by v2)
├── setup.sh                  One-shot dependency installation
└── start-dev.sh              Start all dev servers together
```

## API servers

The Go process starts two independent HTTP servers:

| Server | Default port | Purpose |
|---|---|---|
| Data | 8001 (`PORT` env) | Read-only GETs — directory listing, stat, media, icons, preferences |
| Control | 8002 (`CONTROL_PORT` env) | Mutating POSTs/PUTs — rename, move, copy, delete, trash, compress, … |

All routes are prefixed with `/_api/v2/`. In development, Nuxt proxies `/_api/v2/*` to port 8001 (data). The control server is contacted directly at `http://localhost:8002` (CORS is permissive on the Go side).

> **Dev proxy size limit**: Vite's dev proxy silently drops large binary responses. File content for previews (images, video, audio, text) is served through Nitro server routes at `/media-preview` and `/text-preview`, which run in Node.js and bypass the proxy entirely. Thumbnails and JSON API responses are small enough to pass through the proxy fine.

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
