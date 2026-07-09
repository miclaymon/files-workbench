import { grantedPermissions } from '~/models/plugin/index.js'
import { Activity, View, EditorView, ModalView, PanelView, ViewSection, StatusView } from '~/models/ui/index.js'
import * as scm from '~/lib/scm-api.js'

// ── Plugin API (the WorkbenchAPI a plugin imports) ────────────────────────────
//
// Given a validated manifest and the live activity host, build the frozen,
// permission-scoped surface handed to a plugin's activate(api). The workbench
// facade is the full contribution/query API; this exposes ONLY the slices the
// manifest's permissions grant. A plugin that declares "activities" + "commands"
// gets `api.activities` and `api.commands` and nothing else — the same shape a
// first-party activity's setup() receives, narrowed by permission.
//
// Always available (independent of permissions): the UI model classes a plugin
// constructs its surfaces from (Activity/PanelView/…) — inert until registered —
// plus `log` and a frozen copy of `manifest`.
const UI_MODEL = Object.freeze({ Activity, View, EditorView, ModalView, PanelView, ViewSection, StatusView })

// Each permission → a function that picks its slice from the facade.
const FACADE_SLICE = {
  activities:  (f) => ({ activities: f.activities }),
  commands:    (f) => ({ commands: f.commands }),
  keybindings: (f) => ({ keybindings: f.keybindings }),
  menus:       (f) => ({ menus: f.menus }),
  hooks:       (f) => ({ hooks: f.hooks }),
  modals:      (f) => ({ modals: f.modals }),
  editor:      (f) => ({ editor: f.editor }),
  preferences: (f) => ({ preferences: f.preferences }),
  events:      (f) => ({ events: f.events }),
  selection:   (f) => ({ selection: f.selection }),
  query:       (f) => ({ query: f.query, peer: f.peer }),
  icons:       (f) => ({ icons: f.icons }),
  lightbox:    (f) => ({ lightbox: f.lightbox }),
  peek:        (f) => ({ peek: f.peek }),
}

export function createPluginApi(manifest, host) {
  const facade = host.facade
  const api = {
    ...UI_MODEL,
    manifest: Object.freeze({ ...manifest }),
    log: (...args) => host.log?.(`plugin:${manifest.id}`, ...args),
  }
  for (const perm of grantedPermissions(manifest)) {
    const pick = FACADE_SLICE[perm]
    if (pick) Object.assign(api, pick(facade))
  }

  // Host-permission-gated brokered services. The plugin reaches git only through
  // these vetted methods — never the filesystem or control server directly — and
  // only the methods its declared host_permissions grant.
  const hostPerms = manifest.host_permissions ?? []
  if (hostPerms.includes('scm:read') || hostPerms.includes('scm:write')) {
    api.scm = {}
    if (hostPerms.includes('scm:read'))  Object.assign(api.scm, { detectRepos: scm.detectRepos, repoInfo: scm.repoInfo })
    if (hostPerms.includes('scm:write')) Object.assign(api.scm, { commit: scm.commit, init: scm.init })
    Object.freeze(api.scm)
  }

  return Object.freeze(api)
}
