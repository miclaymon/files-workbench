# Getting Started

## Prerequisites

| Tool | Minimum version | Notes |
|---|---|---|
| Node.js | 20 | Check: `node -v` |
| npm | 10 | Bundled with Node 20 |
| Go | 1.23 | Check: `go version` |
| ffmpeg | any recent | Required for video/audio thumbnail generation. Check: `ffmpeg -version` |
| git | any recent | Backs the Source Control plugin. Check: `git --version` |
| `extism-js` | 1.5+ | **Only to build server plugins** (their WASM backends). The extism JS PDK compiler. Install: `curl -L https://raw.githubusercontent.com/extism/js-pdk/main/install.sh \| bash` (or a release binary from [extism/js-pdk](https://github.com/extism/js-pdk/releases)). Some versions also need binaryen's `wasm-merge` on `PATH`. Not needed to run the app if the artifacts are already built. |

## Installation

This repo consumes sibling checkouts as local `file:` dependencies — clone them
next to this repo first:

```
<parent>/
├── files-workbench-app/            this repo
├── workbench-framework/            @workbench/framework (github: files-workbench-framework)
├── workbench-ui-vue/               @workbench/vue (github: files-workbench-vue)
└── files-workbench-plugins/
    └── files-workbench-material-icons/
```

Run the setup script once after cloning:

```bash
./setup.sh
```

This installs root npm dependencies (`concurrently` and the local `files-workbench-material-icons` plugin package) and client npm dependencies (Vite, Vue, Electron, Monaco, etc.). The Go server has no separate install step — `go run .` fetches modules automatically on first run.

## Starting the dev environment

The Go process runs **two** servers: a data server on port **8001** (`PORT`,
read-only GETs) and a control server on port **8002** (`CONTROL_PORT`, mutating
POST/PUTs). The Vite dev server runs on port 3000.

### Full stack with Electron (recommended)

```bash
npm run dev          # alias for dev:electron — Go server + Vite + Electron window
```

### Full stack in the browser (no Electron window)

```bash
npm run dev:web      # Go server + Vite; open http://localhost:3000
```

### Web (client) only — no Go server

```bash
npm run dev:web:client
```

### Go server only

```bash
npm run dev:server
# or
cd server/v1 && go run .          # PORT/CONTROL_PORT override the 8001/8002 defaults
```

There is no Swagger UI. Refer to `server/v1/main.go` for the full route list or
`curl http://localhost:8001/health` to verify the data server is up.

## Project-specific dev notes

### Hot reload

- Vite hot-reloads Vue components instantly on save.
- The Go server does **not** hot-reload; restart `npm run dev:server` after changing any `.go` file.
- Electron does **not** hot-reload automatically; restart `./start-dev.sh` after changing `client/electron/`.

### API base URLs

There is no dev proxy — the client calls the Go servers directly with absolute URLs
in dev and production alike. Defaults live in `client/lib/api-config.js`
(`http://127.0.0.1:8001` data, `http://localhost:8002` control); override them with
`VITE_API_BASE` / `VITE_CONTROL_BASE` in `client/.env` (copy `client/.env.example`;
restart Vite after changes). If large responses hang while small ones work, see
Troubleshooting below.

### Go module dependencies

After adding a new `import` in a `.go` file:

```bash
cd server/v1 && go mod tidy
```

### Adding a new API endpoint

1. Add the route handler function to the appropriate `.go` file in `server/v1/`.
2. Register it in `server/v1/main.go` — `registerDataRoutes` for read-only GETs (port 8001) or `registerControlRoutes` for mutating POST/PUTs (port 8002) — with the `/_api/v1/` prefix.
3. Add a matching client helper in `client/lib/` (see `fs-api.js` or `explorer-api.js` as examples).

> For plugin-specific backend work, prefer a **server plugin** over a new core endpoint — it runs sandboxed and needs no Go changes. See [PLUGINS.md → Server plugins](./PLUGINS.md#server-plugins).

### Plugins (the `/plugins` tree)

Every feature but Explorer is a plugin whose source lives under the top-level [`/plugins/<id>/`](../plugins/) — a `manifest.json` plus a `client/` (renderer) and/or `server/` (WASM backend) dir. Client code imports Vue and shared host surface from the bare specifiers `vue` and `@fw/sdk`, which the build externalizes to the host so a plugin shares the app's single Vue instance.

`npm run build:plugins` esbuild-bundles each `client/` target to a self-contained ES module, content-hashes it into [`plugins.lock.json`](../plugins.lock.json), and (for `server/` targets) compiles the WASM backend. At runtime the client fetches each plugin's manifest, **verifies its hash** against the lock (prod refuses a mismatch; dev warns), then dynamically imports it — first-party plugins load through the exact same path a third-party one would. `npm run dev` runs a best-effort soft prebuild automatically. Explorer is the one exception: it stays compiled into the app (it owns the selection capability the rest of the workbench reads synchronously at startup).

Third-party plugins install from a file or a remote registry via **Settings → Manage Plugins** (they land in `<dataDir>/plugins/`; in dev that's `config/plugins/`). Point `FW_PLUGIN_REGISTRY` at a JSON index URL to enable the Browse tab. Client plugins run in-process (not sandboxed) — the trust model (content-hash integrity, capability permissions, a build/consent capability scan, and flag-gated prototype hardening via `VITE_FW_HARDEN`) is described in [PLUGINS.md](./PLUGINS.md). Full guide: [PLUGINS.md](./PLUGINS.md).

### Server plugins (WASM backends)

Plugins with a `server` block (e.g. Source Control) ship a WASM backend the Go server runs sandboxed, compiled into `config/plugins/<id>/`. `npm run dev` **prebuilds them automatically** (a best-effort `build:plugins --soft` step in `dev:server`): it rebuilds only when the backend source changed, and if the `extism-js` compiler isn't installed it just warns and continues — the app runs, that plugin degrades to unavailable (an empty Source Control panel). To build explicitly, run `npm run build:plugins`; `build:electron` runs it as a hard step (a broken plugin fails the production build). Needs the `extism-js` compiler (see [Prerequisites](#prerequisites)). Full guide: [PLUGINS.md → Server plugins](./PLUGINS.md#server-plugins).

### Monaco Editor workers

Monaco requires worker scripts to be bundled separately. They are configured in `client/components/workbench/editor/MonacoEditor.vue` via `window.MonacoEnvironment.getWorker()`, instantiating workers imported with Vite's `?worker` query (e.g. `import JsonWorker from 'monaco-editor/esm/vs/language/json/json.worker?worker'`). Use `?worker` rather than `new Worker(new URL('monaco-editor/…', import.meta.url))` — the bare-specifier `new URL` form resolves in the dev server but **fails the production `vite build`** (Rollup can't resolve the package specifier in its worker plugin).

## Building for production

### Web (static export)

```bash
cd client && npm run build:web
```

Output goes to `client/dist/`.

### Electron desktop app (self-contained)

```bash
npm run build:electron        # from the repo root (or: cd client && npm run build:electron)
```

This runs four steps: compiles the Go server (`client/scripts/build-server.js` →
`server/v1/dist/`), builds the plugin artifacts (`build-plugins.js --out .fw/plugins-dist`,
producing prod client bundles + WASM backends), generates the static client
(`vite build` → `client/dist/`), and packages everything with electron-builder.
Output goes to `client/dist-electron/`. Targets depend on the build platform:
`.AppImage` (Linux), `.dmg` (macOS), `.exe`/NSIS (Windows) — electron-builder can only
build each OS's installer on that OS.

The Go server binary, the read-only `config/` tree, `blacklist.yaml`, and the built
first-party plugin artifacts are bundled into the app via electron-builder
`extraResources`. At launch the Electron main process spawns the server (fixed ports
**8001**/**8002**) and points it at the bundled config (`FW_CONFIG_DIR`), the bundled
plugins (`FW_PLUGINS_DIR` → `resources/plugins`, whence they're served + hash-verified),
and a writable user-data dir (`FW_DATA_DIR` = Electron's `userData`, where
`user-preferences.json`, logs, and any third-party `plugins/` go), then waits for
`/health` before opening the window.

> The Material icon-theme assets (`config/plugins/material-icon-theme/vscode-material-icon-theme/`)
> are generated, not committed — run `scripts/install-material-icon-theme.sh` before
> building so they get bundled.

### Installing a release

End users don't build — they run the one-line installer, which downloads the latest
AppImage / installer from GitHub Releases:

```bash
# Linux
curl -fsSL https://raw.githubusercontent.com/miclaymon/files-workbench/main/install.sh | bash
```
```powershell
# Windows
irm https://raw.githubusercontent.com/miclaymon/files-workbench/main/install.ps1 | iex
```

Releases are built and uploaded manually for now; a tag-triggered CI workflow is on
the roadmap (see [`ROADMAP.md`](ROADMAP.md)).

## Troubleshooting

**Port 8001 or 8002 already in use**

```bash
lsof -i :8001   # data server  (or :8002 for the control server)
kill <PID>
```

**`node_modules` out of sync after pulling**

```bash
npm install && npm install --prefix client
```

**Go module cache issues**

```bash
cd server/v1 && go clean -modcache && go mod download
```

**Electron window doesn't open**

The `client/scripts/dev.js` script waits for Vite to respond on port 3000 before launching Electron. If Vite fails to start, check the terminal for errors.

**`Error: Electron failed to install correctly`**

The `electron` package's postinstall (which downloads + extracts the platform binary) can fail silently on very new Node majors, leaving a broken `node_modules/electron/dist`. Fix: use a Node LTS and reinstall, or extract the cached archive manually:

```bash
rm -rf client/node_modules/electron/dist
unzip ~/.cache/electron/electron-v*-linux-x64.zip -d client/node_modules/electron/dist
printf 'electron' > client/node_modules/electron/path.txt
```

**Previews / plugins / media hang forever while directory listings work**

On some machines (kernel/firewall dependent), IPv4 loopback drops TCP response bodies larger than ~3 KB — small JSON succeeds, anything big stalls with no error, and IPv6 loopback is unaffected. Point the client at IPv6 loopback in `client/.env`:

```bash
VITE_API_BASE=http://[::1]:8001
VITE_CONTROL_BASE=http://[::1]:8002
```

**Video/audio thumbnails not generating**

Ensure `ffmpeg` and `ffprobe` are installed and on `$PATH`. The Go server calls them as external processes; if they are missing, thumbnail endpoints return a 404.
