# Plugins

Files Workbench is built around an internal contribution system: every feature
(Preview, Details, Source Control, …) is an **activity** that contributes its UI and
behaviour through a public **Workbench API**. A **plugin** is the same thing, and —
except for Explorer (see below) — every first-party plugin is **loaded at runtime**
from its own compiled artifact through a **permission-scoped** view of that API. The
first-party plugins are loaded through the *exact same path* a third-party plugin
would be; nothing is special-cased.

> **Status.** Client plugins are compiled to a self-contained ES module and loaded at
> runtime (fetched from the server, content-hash-verified, then dynamically imported);
> server plugins are compiled to sandboxed WebAssembly (see [Server plugins](#server-plugins)).
> The one exception is **Explorer**, which stays compiled into the app as the required
> core built-in — it owns the selection capability the rest of the app consumes
> synchronously at startup (see [`client/builtin-plugins/index.js`](../client/builtin-plugins/index.js)).
> Third-party plugins install from a file or a remote registry via
> **Settings → Manage Plugins** — see [Installing third-party plugins](#installing-third-party-plugins).

---

## Anatomy

Every plugin lives in one directory under the top-level [`/plugins/<id>/`](../plugins/),
holding a manifest plus one directory per execution target it uses:

```
plugins/my-plugin/
├── manifest.json         metadata, permissions, and the client/server target entries
├── client/               runs in the app (renderer)
│   ├── plugin.js         entry: exports activate(api) and optional deactivate(api)
│   └── components/…       the plugin's own Vue components
└── server/               (optional) runs sandboxed on the Go server
    └── main.js           compiled to WASM (see Server plugins)
```

The **client** entry exports `activate(api)`, which receives the permission-scoped API
and contributes through it, returning a disposer that undoes everything. Client code
imports Vue and the SDK from bare specifiers — `vue` and `@workbench/plugin-sdk`
(legacy alias `@fw/sdk`) — which the plugin build externalizes to the **host** (so a
plugin shares the app's single Vue instance and live models/components rather than
bundling its own):

```js
import { markRaw } from 'vue'
import { PlaceholderPanel } from '@workbench/plugin-sdk'   // host-provided shared components/composables

export function activate(api) {
  const { Activity, PanelView } = api

  api.commands.register({ id: 'hello.greet', title: 'Hello: Greet', run: () => api.log('hi') })

  const activity = new Activity({ id: api.manifest.id, label: 'Hello', icon: api.manifest.icon })
    .addView(new PanelView({ id: 'hello', label: 'Hello', location: 'PrimarySideBar', component: markRaw(PlaceholderPanel) }))

  return api.activities.register(activity)   // disposer; called on unload
}

export function deactivate() {}
```

`@workbench/plugin-sdk` is the SDK: the *mechanism* (the global publish, build
externalization, capability scan, server-plugin SDK, manifest schema) lives in the
package of that name (sibling checkout `../workbench-framework-plugin-sdk`); the
*surface* a plugin receives — the Vue namespace, the UI model classes, safe
composables/helpers, and shared components — is composed by the app in
[`client/sdk.js`](../client/sdk.js) and published on a global the plugin build wires
those imports to. It exposes only **non-privileged** surface; privileged operations
stay behind the permission-gated `api`.

The production references are the runtime plugins under [`/plugins/`](../plugins/) —
notably **Source Control** ([`plugins/source-control/`](../plugins/source-control/)),
which pairs a client with a WASM **server** backend (`api.server`) and contributed
preferences, and **Preview** ([`plugins/preview/`](../plugins/preview/)), which ships
its own Vue components. **Explorer** ([`client/builtin-plugins/explorer/`](../client/builtin-plugins/explorer/))
is the core-bundled exception.

---

## manifest.json

Modelled on a Chrome extension manifest. Validated by the `@workbench/framework`
manifest model; the JSON Schema (and a documented example plugin) ships in the
`@workbench/plugin-sdk` package (`schema/manifest.schema.json`, `example/`).

| Field | Required | Description |
|---|---|---|
| `manifest_version` | ✓ | Format version. Only `1` is supported. |
| `id` | ✓ | Unique, kebab-case (`a-z`, `0-9`, hyphen). |
| `name` | ✓ | Human display name. |
| `version` | ✓ | Semver (`1.0.0`). |
| `client` | | `{ entry }` — the client target's entry module (e.g. `client/plugin.js`). |
| `server` | | `{ entry, runtime, permissions }` — the sandboxed WASM backend (see [Server plugins](#server-plugins)). |
| `permissions` | | Front-end capabilities — see [Permissions](#permissions). |
| `engines` | | e.g. `{ "sdk": "^1.0.0" }` — the `@workbench/plugin-sdk` contract version the host checks. |
| `description` / `author` / `icon` | | Metadata; `icon` is an MDI path or asset ref. |
| `dependencies` | | `{ pluginId: semverRange }` that must load first. |

A plugin declares whichever targets it uses — `client`, `server`, or both. Validation
errors block loading; **unknown permissions are ignored with a warning** (as Chrome
does), so a manifest stays forward-compatible.

---

## Permissions

A plugin only receives the API slices its manifest declares. There are two tiers,
defined in [`client/models/plugin/permissions.js`](../client/models/plugin/permissions.js):

**`permissions`** — front-end capabilities, each gating a slice of the API:

| Permission | Grants |
|---|---|
| `activities` | `api.activities` — contribute/remove activities (panels, tabs, status widgets, modals). |
| `commands` | `api.commands` — register and execute commands. |
| `keybindings` | `api.keybindings` — bind chords to commands. |
| `menus` | `api.menus` — contribute menu items. |
| `hooks` | `api.hooks` — ordered transform/veto chains. |
| `modals` | `api.modals` — open/close/contribute modal editors. |
| `editor` | `api.editor` — open editor tabs by kind, read open tabs. |
| `preferences` | `api.preferences` — contribute settings + read their values. |
| `events` | `api.events` — app-level pub/sub. |
| `selection` | `api.selection` — the active activity's selection. |
| `query` | `api.query` / `api.peer` — inspect other activities + app state. |
| `icons` | `api.icons` — register an icon theme (a `getIcon` handler) that resolves file/folder icons. |
| `lightbox` | `api.lightbox` — open a near-fullscreen overlay (`open({ component, props })` / `close` / `active`). |
| `peek` | `api.peek` — open a positioned peek popup near a trigger element. |
| `server` | `api.server` — call this plugin's own sandboxed WASM backend (requires a `server` block; see [Server plugins](#server-plugins)). |
| `net` | `api.net.fetch` — outbound requests, limited to the origins declared in the manifest `net.origins`. |
| `storage` | `api.storage` — per-plugin namespaced key/value persistence (`get`/`set`/`remove`/`keys`). |
| `clipboard` | `api.clipboard` — mediated `readText`/`writeText`. |

The last three are **capability** permissions (see [Hardening](#hardening--the-client-trust-model)):
each grants a host-mediated `api` slice so a plugin never needs a raw ambient global.

**`host_permissions`** — backend/host access, each gating a **brokered** service
(the Workbench forwards vetted requests to the Go server; the plugin never touches
the filesystem or control server directly):

| Host permission | Grants |
|---|---|
| `fs:read` / `fs:write` / `control` / `clipboard` | Reserved; enforced as the corresponding brokers land. |

> Git access used to live here (`scm:read` / `scm:write` → `api.scm`). It has moved
> into the Source Control plugin's own [server plugin](#server-plugins) — the pattern
> for adding backend functionality without changing the Go server.

---

## The plugin API

`activate(api)` receives a **frozen** object built by
[`createPluginApi`](../client/composables/plugins/usePluginApi.js). It always
carries:

- The **UI model classes** — `Activity`, `View`, `EditorView`, `ModalView`,
  `PanelView`, `ViewSection`, `StatusView` — for constructing surfaces.
- `api.manifest` — a frozen copy of the plugin's manifest.
- `api.log(...)` — namespaced logging to the Debug panel.

…plus exactly the facade slices and brokered services the declared permissions
grant (and nothing else). This is the same `host.facade` first-party activities
receive as `api` in their `setup(ctx)`, narrowed by permission.

### Contribution points

```js
// Commands are the single source of truth; menus/keybindings reference them by id.
api.commands.register({ id, title, category?, icon?, when?(ctx), toggled?(ctx), run(ctx, …args) })
api.keybindings.register({ key: 'ctrl+alt+h', command: 'hello.greet' })
api.menus.register('directory/item', { command: 'hello.greet' })           // menu contribution
api.hooks.add('before-rename', (value, ctx) => value)                       // transform/veto

api.editor.openTab('git-graph', { title, params, focusExisting, toSide })   // open an editor tab (toSide → split right)
const tabs = api.editor.tabs()                                              // [{ id, kind, title, path }]

api.modals.open('settings'); api.modals.close(); api.modals.promote('settings')

api.preferences.register({ key: 'myPlugin', title: 'My Plugin', properties: { … } })  // Settings section
api.preferences.get('myPlugin.someSetting')

api.events.on('active-tab-change', cb)
const sel = api.selection.value                                            // active selection snapshot
const other = api.peer('explorer')                                         // another activity's API

api.icons.register({ id, label, getIcon })                                 // register an icon theme

api.lightbox.open({ component, props })                                     // near-fullscreen overlay
api.lightbox.close()
```

### Icon themes

The `icons` permission lets a plugin contribute an **icon theme** — layer 2 of the
icon pipeline (custom `.directory`/`desktop.ini` icons resolve first, the built-in
MDI glyphs last). The renderers call the *active* theme's handler per item:

```js
api.icons.register({ id, label, getIcon })   // disposer; only the active theme is consulted
api.icons.setActive(id)                       // choose among several installed themes
api.icons.list()                              // [{ id, label }]

// getIcon(ctx) => result | null
//   ctx:    { path, name, isDir, kind, extension, expanded,
//             mimeType?, hasThumbnail, hasCustomIcon, activityName, activityContext? }
//   result: { type: 'url',       icon }   // image URL
//           { type: 'file.path', icon }   // path resolved relative to the plugin's assets
//           { type: 'component', icon }   // a Vue component
//           { type: 'svg.path',  icon }   // raw MDI-style path 'd' data
//   null  => no theme icon for this item; the renderer falls back to its MDI default.
```

`getIcon` must be a cheap, pure lookup — it runs per item at render time. The
workbench renders the descriptor through `ResolvedIcon.vue` and falls back to the
MDI default on a `null` result or an `<img>` that fails to load. The active theme
follows the `iconTheme` preference (or the first registered, so a single installed
pack lights up with no configuration).

Own backend (the `server` permission): a plugin with a `server` block calls its own
sandboxed WASM backend through `api.server` — bound to its own id, so it can't reach
another plugin's:

```js
const repos = await api.server.call('detect', { paths })         // read (data server)
await api.server.call('commit', { root, message }, { write: true }) // write (control server)
```

### UI model

Surfaces are instances of UI-agnostic classes in
[`client/models/ui/`](../client/models/ui/) — they carry only metadata and a
component reference (no Vue imports), so the model is framework-neutral.

| Class | Surface | Notable fields |
|---|---|---|
| `Activity` | a feature | `id, label, icon`; `.addView(view)` |
| `PanelView` | sidebar/panel | `location` (`PrimarySideBar`/…), `sections[]`, `component`, `actions[]` |
| `ViewSection` | a section in a panel | `homeView`, `component`, `actions[]`, `alwaysShowHeading` |
| `EditorView` | an editor tab | `kind`, `component`, `props(tab, ctx)`, `tabIcon(tab)`, `actions[]` (rendered in the tab bar for the active tab; each may declare `when(ctx)`/`disabled(ctx)`, ctx = `{ ...host, tab }`) |
| `ModalView` | a modal editor | `component`, `width`/`height`, `props`/`on` |
| `StatusView` | a status-bar widget | `region` (`left`/`right`), `order`, `component` |

A `PanelView` with `location: 'PrimarySideBar'` automatically gets an Activity Bar
entry. A view with no saved layout state renders its declared `sections` (or, with
none, its own `component`).

---

## Server plugins

A plugin can ship a **sandboxed backend** — JS compiled to WebAssembly — for work
the client can't do: running a tool (`git`, `ffmpeg`), hashing, reading files. The Go
server runs it in-process with [extism](https://extism.org)/wazero as a **hard
sandbox**: the module has *no* ambient authority. Its only way to touch the OS is
through **permissioned host functions**. This is how a plugin adds backend
functionality **without changing the Go server** — the Source Control plugin's git
backend ([`plugins/source-control/server/`](../plugins/source-control/server/))
replaced the hand-written `scm.go` handlers this way.

### Declare it

Add a `server` block to the manifest and the `server` permission:

```jsonc
{
  "permissions": ["activities", "commands", "server"],
  "server": {
    "entry": "server/git.plugin.js",     // JS source, compiled to WASM at build time
    "runtime": "wasm-js",
    "permissions": ["exec:git", "fs:read"] // the host functions this backend may call
  }
}
```

`server.permissions` (see `SERVER_PERMISSIONS` in
[`permissions.js`](../client/models/plugin/permissions.js)) are the backend's entire
trust surface:

| Permission | Grants the backend |
|---|---|
| `exec:<bin>` | run **only** that binary via `host.exec` (`exec:git` can't run `rm`). |
| `fs:read` | `host.fs.stat` / `readDir` / `readFile` (every path is blacklist-checked host-side). |
| `fs:write` | host-side filesystem writes (blacklist-checked). |
| `net` | outbound network requests. |

### Author it

The backend imports the server SDK from `@workbench/plugin-sdk` (this one is
**bundled** into the WASM, not externalized) and default-nothing — it re-exports three
fixed entry points bound to a `ServerPlugin`. Methods are **synchronous** (the extism
JS PDK's QuickJS has no event loop); side-effects go through the injected `host`:

```js
import { ServerPlugin, host } from '@workbench/plugin-sdk/server/ServerPlugin.js'

const plugin = new ServerPlugin({
  methods: {
    detect({ paths }) { /* uses host.fs.readDir / host.fs.stat */ },
    commit({ root, message }) {
      const r = host.exec('git', ['-C', root, 'commit', '-m', message]) // { stdout, stderr, code }
      if (r.code !== 0) throw new Error(r.stderr.trim())
      return { ok: true }
    },
  },
})

export function handle() { return plugin.handle() }
export function plugin_init() { return plugin.lifecycleInit() }
export function plugin_destroy() { return plugin.lifecycleDestroy() }
```

Keep pure logic in a separate module (e.g. `git-logic.js`) with the side-effect
surface injected, so it unit-tests in plain Node — see
[`git-logic.test.mjs`](../plugins/source-control/server/git-logic.test.mjs).

### Call it

From the plugin's client code, `api.server` bridges to **its own** backend (bound to
the plugin id — it can't call another plugin's):

```js
const repos = await api.server.call('detect', { paths })
await api.server.call('commit', { root, message }, { write: true }) // write → control server
```

Under the hood this POSTs to the one generic endpoint
`/_api/v1/plugins/<id>/rpc`; the Go host forwards `{ method, params }` to the
module's `handle` export and returns its result. No per-plugin Go code.

### Build it

`npm run build:plugins` ([`client/scripts/build-plugins.js`](../client/scripts/build-plugins.js))
bundles each server entry with esbuild (→ CommonJS, since the PDK has no ESM) then
compiles it with `extism-js`, emitting `config/plugins/<id>/{plugin.wasm, plugin.json}`
(the Go server scans there at startup). `build:electron` runs it as a hard step, and
`npm run dev` prebuilds it best-effort (`--soft`: rebuilds only on source change, and
tolerates a missing compiler so dev never breaks). Requires the **`extism-js`**
compiler on `PATH` (see [GETTING_STARTED](./GETTING_STARTED.md#prerequisites)); the
artifacts are gitignored build outputs.

> **Security model.** The WASM module has no syscalls — `exec`/`fs`/`net` are
> reachable only through host functions, each re-checked against the plugin's granted
> `server.permissions` at call time. This is a real boundary (unlike a Node
> subprocess, which could `require('child_process')`). `exec` is allowlisted per
> binary; fs host functions honor the server blacklist. Keep the host-function set
> minimal and never expose a generic "run any command".

---

## Lifecycle

`activate(api)` should return a **disposer** that removes every contribution; the
plugin host calls it on unload. `deactivate(api)` is an optional extra hook. Each
`register(...)` call also returns its own disposer, so compose them:

```js
export function activate(api) {
  const off1 = api.commands.register({ … })
  const off2 = api.activities.register(activity)
  return () => { off1(); off2() }
}
```

---

## Loading

Whatever the delivery, the host consumes a `{ manifest, module }` pair via
[`createPluginHost`](../client/composables/plugins/usePluginHost.js), which validates
the manifest, checks dependencies (topologically ordered), builds the permission-scoped
API, and calls `activate`. Two delivery paths feed it:

- **Runtime (the norm):** the client fetches the plugin manifest from the server
  (`GET /_api/v1/plugins/manifest`), **content-hash-verifies** each client artifact
  against the committed [`plugins.lock.json`](../plugins.lock.json) (prod refuses a
  mismatch; dev warns), then dynamic-imports the verified bytes and hands the module to
  the host — see [`useRuntimePlugins.js`](../client/composables/plugins/useRuntimePlugins.js).
  The Go server discovers and serves artifacts from `FW_PLUGINS_DIR` (first-party) and
  `<dataDir>/plugins` (third-party).
- **Bundled (Explorer only):** Explorer is imported statically in
  [`client/builtin-plugins/index.js`](../client/builtin-plugins/index.js) and loaded
  synchronously, because the app pulls its selection API during setup (see M4 note in
  that file). It is the single required core built-in and can't be uninstalled.

### Building & adding a plugin

1. Create `plugins/<id>/` with a `manifest.json` and a `client/` (and/or `server/`) dir.
   Import Vue/SDK from `vue` and `@workbench/plugin-sdk`; keep app-internal imports to
   what the SDK surface re-exports.
2. Run `npm run build:plugins` (also runs as a soft prebuild in `npm run dev`). It
   esbuild-bundles each client target to a self-contained ESM (`vue`/`@workbench/plugin-sdk`
   externalized to the host), compiles any `server/` target to WASM, content-hashes the
   artifacts, and updates `plugins.lock.json`.
3. Reload — the runtime loader discovers, verifies, and loads it. Surfaces appear
   through the registries exactly like a bundled plugin. No host code changes needed.

---

## Installing third-party plugins

Third-party plugins are delivered as a **package** — a `.zip`/`.vsix` of a *built* plugin
dir (the contents of `.fw/plugins/<id>/`: `client.js` + `plugin.json`, optionally
`server.wasm`). They install into the writable `<dataDir>/plugins/` and load through the
exact same runtime path as first-party plugins. Manage them in **Settings → Manage Plugins**
(command `plugins.manage`):

- **Install from file** — pick a package; the server extracts it (zip-slip/size guarded),
  validates the manifest, **recomputes the `client.js` hash itself** (so the served hash
  always matches the bytes on disk — it can't trust the package's claim), and writes the
  runtime `plugin.json`. Endpoints (control server): `POST /_api/v1/plugins/install`
  (multipart), `DELETE /_api/v1/plugins/{id}`, `POST /_api/v1/plugins/{id}/enabled`.
- **Browse a registry** — set `FW_PLUGIN_REGISTRY` to an index URL
  (`{ plugins: [{ id, name, version, download, hash, … }] }`); the server proxies it
  (`GET /_api/v1/plugins/registry`, short-TTL cached) and installs a chosen entry by
  downloading its package and verifying it against the registry-declared `hash`. The manager
  shows **Update available** when the registry version is newer than the installed one.
- **Enable / disable / uninstall** — disabled plugins are listed but not auto-loaded (state
  in `<dataDir>/plugins/state.json`); toggling hot-loads/unloads via the plugin host with no
  restart. First-party plugins can't be uninstalled.
- **Consent** — before a freshly installed plugin's code is *run*, the manager scans the
  artifact (below) and shows its requested permissions + any undeclared capability use. You
  choose **Enable & run** or keep it disabled.

## Hardening & the client trust model

**State it plainly: client plugins are not sandboxed.** They run in the host's JS realm
because they contribute live Vue components rendered inline (`<component :is>`), which can't
cross a realm boundary. True isolation (an iframe/worker "webview" model) is a future
project. What the app does instead is **raise the bar and make intent auditable**:

- **Content-hash integrity** — every artifact is verified before load (first-party against
  the committed `plugins.lock.json`; third-party against the server-recomputed hash).
- **Capability permissions** — `net` / `storage` / `clipboard` grant *host-mediated* `api`
  slices (`api.net.fetch` origin-allowlisted to `net.origins`, `api.storage` namespaced per
  plugin, `api.clipboard`) so a well-behaved plugin routes those through `api`, never a raw
  global.
- **Capability scan** (`@workbench/plugin-sdk`, `src/capability-scan.js`) —
  a static scan of the built bundle. **Code-execution** primitives (`eval`, the `Function`
  constructor, dynamic `import(`, `Worker`) **fail a first-party build**; network/storage/
  clipboard use is advisory for first-party (trusted + reviewed) and **surfaced at
  third-party install consent**.
- **Prototype hardening** (`@workbench/plugin-sdk`, `src/harden.js`) —
  freezes the well-known intrinsic prototypes so a plugin can't poison shared prototypes.
  **Off by default** (freezing intrinsics can break libraries that patch them — Monaco,
  video.js); enable to verify with `VITE_FW_HARDEN=true` or `localStorage['fw:harden']='1'`,
  and flip the default once the full app is confirmed clean.

None of this is a security boundary — it is defense-in-depth + integrity + auditability.
Install only plugins you trust.

---

## Worked examples

### Explorer

[`client/builtin-plugins/explorer/`](../client/builtin-plugins/explorer/) is the one
**core-bundled** plugin: a `PrimarySideBar` panel with **Places** (composable-driven
lazy file tree via `useDirectoryFileTree`) and **Open Editors** sections, a
**directory editor tab** (kind `dir`), and an **Explorer status widget** (left-aligned
dir-stats / selection). Its `setup` wraps `useSelection`, publishes the `selection`
**capability** that Preview/Details and status widgets consume, and emits
`selection-change`. It stays bundled and loads before Workbench's own slices so those
can pull the selection refs from `host.api('explorer')` synchronously — a dependency a
runtime (async) load can't satisfy, and exposing that privileged state via the SDK
would breach its non-privileged boundary.

### Source Control

[`plugins/source-control/`](../plugins/source-control/)
exercises the whole surface: a `PrimarySideBar` panel with Repositories / Changes /
Graph **view sections**, a Git Graph **editor tab** (repo pinned at open time via
tab params), a branch **status widget**, **commands** + a section **action**, a
**preference** (`sourceControl.changesViewMode`), and — the interesting part — its own
[**server plugin**](#server-plugins). All git access runs in a sandboxed WASM backend
(`server/git.plugin.js`, granted `exec:git` + `fs:read`) reached via
`api.server.call('detect' | 'info' | 'commit' | 'init', …)`. It is the reference for
adding backend functionality without touching the Go server — it replaced the former
hand-written `scm.go` handlers and `scm:*` host permissions.

### Material Icon Theme

[`plugins/material-icon-theme/`](../plugins/material-icon-theme/)
is the reference **icon theme** and the smallest first-party plugin: it declares only
the `icons` permission and, in `activate`, registers one `getIcon` handler. It is also
the first plugin developed as a **standalone package**: the in-repo `client/plugin.js`
is a thin re-export of `files-workbench-material-icons` (a sibling project under
`files-workbench-plugins/`, installed at the repo root as a local `file:` dependency —
a symlink, so edits there are picked up by the next `npm run build:plugins`). It owns
*resolution* but not *assets* — the SVGs and mapping tables are loaded server-side by
the Go config plugin under `config/plugins/material-icon-theme/` and exposed at
`/icons/manifest` + `/icons/svg`. The handler fetches the manifest once, maps a
file/folder name (honouring the open-folder variant via `expanded`) to an
icon-definition name, and returns `{ type: 'url', icon }` pointing at `/icons/svg`
(or `null` so the renderer falls back to MDI). It is the proof that the whole icon
layer is plugin-driven: unregister it and every view cleanly reverts to MDI glyphs.
