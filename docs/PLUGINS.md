# Plugins

Files Workbench is built around an internal contribution system: every first-party
feature (Explorer, Preview, Details, …) is an **activity** that contributes its UI
and behaviour through a public **Workbench API**. A **plugin** is the same thing,
authored outside the core and loaded at runtime through a **permission-scoped**
view of that API. Explorer and Source Control are first-party plugins built this way
as reference implementations.

> **Status.** Plugins today are loaded as compiled-in *built-ins*
> (`client/builtin-plugins/`). The archive/sandbox path described under
> [Loading](#loading) — `.zip`/`.vsix` extraction and a sandboxed runtime — is not
> built yet; the loader, manifest, permission model, and API surface it will use
> are. Everything below is real and in use by the Source Control plugin.

---

## Anatomy

A plugin is a directory (eventually an archive) with a manifest at its root and an
entry module:

```
my-plugin/
├── manifest.json        metadata + declared permissions
└── src/
    ├── plugin.js        entry: exports activate(api) and optional deactivate(api)
    └── components/…      the plugin's own Vue components
```

The entry exports an `activate` function that receives the permission-scoped API
and contributes through it, returning a disposer that undoes everything:

```js
export function activate(api) {
  const { Activity, PanelView } = api

  api.commands.register({ id: 'hello.greet', title: 'Hello: Greet', run: () => api.log('hi') })

  const activity = new Activity({ id: api.manifest.id, label: 'Hello', icon: api.manifest.icon })
    .addView(new PanelView({ id: 'hello', label: 'Hello', location: 'PrimarySideBar', component: HelloPanel }))

  return api.activities.register(activity)   // disposer; called on unload
}

export function deactivate() {}
```

A complete, runnable reference lives in [`docs/plugins/example/`](plugins/example/);
the production references are the Explorer plugin (`client/builtin-plugins/explorer/`) —
the most central built-in, contributing the Places tree, Open Editors, directory tab,
and selection capability — and the Source Control plugin
([`client/builtin-plugins/source-control/`](../client/builtin-plugins/source-control/)),
which exercises the brokered backend (`api.scm`) and contributed preferences.

---

## manifest.json

Modelled on a Chrome extension manifest. Validated by
[`client/models/plugin/manifest.js`](../client/models/plugin/manifest.js); the JSON
Schema is [`docs/plugins/manifest.schema.json`](plugins/manifest.schema.json).

| Field | Required | Description |
|---|---|---|
| `manifest_version` | ✓ | Format version. Only `1` is supported. |
| `id` | ✓ | Unique, kebab-case (`a-z`, `0-9`, hyphen). |
| `name` | ✓ | Human display name. |
| `version` | ✓ | Semver (`1.0.0`). |
| `main` | ✓ | Entry module, relative to the plugin root (`src/plugin.js`). |
| `description` / `author` / `icon` | | Metadata; `icon` is an MDI path or asset ref. |
| `permissions` | | Front-end capabilities — see [Permissions](#permissions). |
| `host_permissions` | | Host/backend access — see [Permissions](#permissions). |
| `dependencies` | | `{ pluginId: semverRange }` that must load first. |
| `engines` | | e.g. `{ "workbench": "^2.0.0" }`. |

Validation errors block loading; **unknown permissions are ignored with a
warning** (as Chrome does), so a manifest stays forward-compatible.

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

**`host_permissions`** — backend/host access, each gating a **brokered** service
(the Workbench forwards vetted requests to the Go server; the plugin never touches
the filesystem or control server directly):

| Host permission | Grants |
|---|---|
| `scm:read` | `api.scm.detectRepos` / `api.scm.repoInfo`. |
| `scm:write` | `api.scm.commit` / `api.scm.init`. |
| `fs:read` / `fs:write` / `control` / `clipboard` | Reserved; enforced as the corresponding brokers land. |

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

api.editor.openTab('git-graph', { title, params, focusExisting })           // open an editor tab
const tabs = api.editor.tabs()                                              // [{ id, kind, title, path }]

api.modals.open('settings'); api.modals.close(); api.modals.promote('settings')

api.preferences.register({ key: 'myPlugin', title: 'My Plugin', properties: { … } })  // Settings section
api.preferences.get('myPlugin.someSetting')

api.events.on('active-tab-change', cb)
const sel = api.selection.value                                            // active selection snapshot
const other = api.peer('explorer')                                         // another activity's API
```

Brokered services (host permissions):

```js
const repos = await api.scm.detectRepos(paths)   // scm:read
const info  = await api.scm.repoInfo(root)        // scm:read
await api.scm.commit(root, message)               // scm:write
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
| `EditorView` | an editor tab | `kind`, `component`, `props(tab, ctx)` |
| `ModalView` | a modal editor | `component`, `width`/`height`, `props`/`on` |
| `StatusView` | a status-bar widget | `region` (`left`/`right`), `order`, `component` |

A `PanelView` with `location: 'PrimarySideBar'` automatically gets an Activity Bar
entry. A view with no saved layout state renders its declared `sections` (or, with
none, its own `component`).

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

Plugins are `{ manifest, module }` pairs fed to
[`createPluginHost`](../client/composables/plugins/usePluginHost.js), which
validates the manifest, checks dependencies (topologically ordered), builds the
permission-scoped API, and calls `activate`.

- **Today:** first-party built-ins are listed in
  [`client/builtin-plugins/index.js`](../client/builtin-plugins/index.js) and
  loaded at startup in `Workbench.vue`.
- **Planned:** a runtime path that extracts an archive (`.zip`/`.vsix`), reads
  `manifest.json`, and imports `src/plugin.js` in a sandbox — producing the same
  `{ manifest, module }` pair the host already consumes.

### Adding a built-in plugin

1. Create `client/builtin-plugins/<id>/` with `manifest.json` and `src/plugin.js`.
2. Add `{ manifest, module }` to `BUILTIN_PLUGINS` in
   `client/builtin-plugins/index.js`.
3. The host loads it at startup; surfaces appear through the registries.

---

## Worked examples

### Explorer

[`client/builtin-plugins/explorer/`](../client/builtin-plugins/explorer/) is the
most central built-in: a `PrimarySideBar` panel with **Places** (composable-driven
lazy file tree via `useDirectoryFileTree`) and **Open Editors** sections, a
**directory editor tab** (kind `dir`), and an **Explorer status widget** (left-aligned
dir-stats / selection). Its `setup` wraps `useSelection`, publishes the `selection`
**capability** that Preview/Details and status widgets consume, and emits
`selection-change`. It must load before Workbench's own slices so those can pull the
selection refs from `host.api('explorer')`.

### Source Control

[`client/builtin-plugins/source-control/`](../client/builtin-plugins/source-control/)
exercises the whole surface: a `PrimarySideBar` panel with Repositories / Changes /
Graph **view sections**, a Git Graph **editor tab** (repo pinned at open time via
tab params), a branch **status widget**, **commands** + a section **action**, a
**preference** (`sourceControl.changesViewMode`), and the **`scm:read`/`scm:write`**
brokered git backend. It never touches the filesystem directly — all git access
goes through `api.scm` → the Workbench broker → the Go `/scm` endpoints.
