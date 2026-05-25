# Getting Started

## Prerequisites

| Tool | Minimum version | Notes |
|---|---|---|
| Node.js | 20 | Check: `node -v` |
| npm | 10 | Bundled with Node 20 |
| Go | 1.23 | Check: `go version` |
| ffmpeg | any recent | Required for video/audio thumbnail generation. Check: `ffmpeg -version` |

## Installation

Run the setup script once after cloning:

```bash
./setup.sh
```

This installs root npm dependencies (`concurrently`) and client npm dependencies (Nuxt, Electron, Monaco, etc.). The Go server has no separate install step — `go run .` fetches modules automatically on first run.

## Starting the dev environment

### Full stack (recommended)

```bash
npm run dev:v2
```

Starts the Go server on port 8000 and the Nuxt dev server on port 3000. Open http://localhost:3000 in a browser.

To also open an Electron window:

```bash
./start-dev.sh
```

### Web browser only (no Electron window)

```bash
npm run dev:client
# or
cd client && npm run dev:web
```

Open http://localhost:3000 in a browser.

### Go server only

```bash
npm run dev:server:v2
# or
cd server/v2 && PORT=8000 go run .
```

There is no Swagger UI. Refer to `server/v2/main.go` for the full route list or use `curl`/`httpie` against `http://localhost:8000/health` to verify the server is up.

## Project-specific dev notes

### Hot reload

- The Nuxt dev server reloads Vue components instantly on save.
- The Go server does **not** hot-reload; restart `npm run dev:server:v2` after changing any `.go` file.
- Electron does **not** hot-reload automatically; restart `./start-dev.sh` after changing `client/electron/`.

### Vite dev proxy size limit

Vite's HTTP proxy silently drops response bodies larger than ~3–4 KB. File content (images, video, audio, large text) for the preview panel is served through Nitro server routes (`/media-preview`, `/text-preview`) that bypass the proxy. In production these routes are not used; the frontend calls the Go server directly.

### Go module dependencies

After adding a new `import` in a `.go` file:

```bash
cd server/v2 && go mod tidy
```

### Adding a new API endpoint

1. Add the route handler function to the appropriate `.go` file in `server/v2/`.
2. Register it on the mux in `server/v2/main.go` (`registerRoutes` function) with the `/_api/v2/` prefix.
3. Add a matching client helper in `client/lib/` (see `fs-api.js` or `explorer-api.js` as examples).

### Monaco Editor workers

Monaco requires worker scripts to be bundled separately. They are configured in `client/components/workbench/MonacoEditor.vue` via `window.MonacoEnvironment.getWorker()` using `new URL('monaco-editor/esm/vs/...', import.meta.url)`. Vite handles the bundling automatically — do not change this pattern.

## Building for production

### Web (static export)

```bash
cd client && npm run generate
```

Output goes to `client/.output/public/`.

### Electron desktop app

```bash
cd client && npm run build:electron
```

Output goes to `client/dist-electron/`. Targets: `.AppImage` (Linux), `.dmg` (macOS), `.exe` (Windows) depending on the build platform.

## Troubleshooting

**Port 8000 already in use**

```bash
lsof -i :8000
kill <PID>
```

**`node_modules` out of sync after pulling**

```bash
npm install && npm install --prefix client
```

**Go module cache issues**

```bash
cd server/v2 && go clean -modcache && go mod download
```

**Electron window doesn't open**

The `client/scripts/dev.js` script waits for Nuxt to respond on port 3000 before launching Electron. If Nuxt fails to start, check the terminal for Nuxt errors.

**Video/audio thumbnails not generating**

Ensure `ffmpeg` and `ffprobe` are installed and on `$PATH`. The Go server calls them as external processes; if they are missing, thumbnail endpoints return a 404.
