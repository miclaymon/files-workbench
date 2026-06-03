# Files Workbench 2

A desktop file manager built with Electron + Nuxt 3 (Vue 3) on the front end and a Go HTTP server on the back end. It runs as a native Electron app in production and as a browser SPA in development.

## Features

- Multi-tab directory browsing with navigation history and breadcrumbs (overflow-collapsing with expandable `···` chip)
- Multiple directory view layouts: grid (XS through XXL), list, details, gallery grid, gallery mosaic, and feed
- Client-side sort (name, size, type, date modified/created/accessed) and filter (by file type, size, date) with a contextual active-state bar showing removable chips
- Explorer sidebar tree with expandable folders, indent guides, and drag-and-drop
- File preview panel: images, video (Video.js), audio (Wavesurfer.js + embedded album art), code/text (Monaco Editor), HTML (rendered iframe + source toggle)
- Hover preview overlay: hovering a grid item shows a floating media preview centered on the thumbnail
- Media thumbnails: images resized server-side; video frame extraction and audio artwork via ffmpeg; disk-based thumbnail cache
- Icon pack plugin system: VSCode icon theme adapter with `vscode-material-icon-theme` support; icons resolved server-side and shown in directory views and the explorer tree
- Inline file renaming in tree and directory views
- Custom drag-and-drop with ghost element and 200 ms activation delay
- Context menus, clipboard (cut/copy/paste), multi-select with Shift and Ctrl/Cmd
- Preferences panel (theme, accent color, layout defaults, explorer options)
- Command palette (WIP)

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

# Go server only (http://localhost:8000)
npm run dev:server:v2

# Frontend + Go server together (no Electron)
npm run dev:v2
```

## Project structure

```
files-workbench2/
├── client/                   Nuxt 3 SPA + Electron shell
│   ├── assets/css/           Global CSS variables and base styles
│   ├── components/workbench/ All UI components
│   ├── composables/          Shared Vue composables
│   ├── electron/             Electron main process
│   ├── lib/                  API client helpers and utilities
│   ├── pages/                Nuxt pages (single page: index)
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

## API base URL

The Go server listens on `http://localhost:8000`. All routes are prefixed with `/_api/v2/`. In development, the Nuxt dev server proxies `/_api/v2/*` to port 8000. In production the client calls the server directly.

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
| [`AGENTS.md`](AGENTS.md) | Guide for AI coding agents working on this repo |
