// ── Plugin permissions ────────────────────────────────────────────────────────
//
// Chrome-extension-inspired permission model. A plugin's manifest declares the
// `permissions` it needs; the loader hands it a WorkbenchAPI exposing ONLY the
// facade slices those permissions grant (see usePluginApi.js). A plugin that
// never declares "commands" simply has no `api.commands` to call.
//
// Two tiers, mirroring Chrome's `permissions` vs `host_permissions`:
//   PERMISSIONS       — front-end capabilities, each gating a slice of the
//                       workbench facade (UI contribution + app collaboration).
//   HOST_PERMISSIONS  — access to the host/backend (filesystem, control server).
//                       Declared and surfaced now; enforcement lands with the
//                       backend bridge (no fs in the facade yet).

/** Front-end capability permissions → human description. */
export const PERMISSIONS = Object.freeze({
  activities:  'Contribute and remove activities (panels, editor tabs, status widgets, modals).',
  commands:    'Register commands and execute them by id.',
  keybindings: 'Bind keyboard chords to commands.',
  menus:       'Contribute items into application and context menus.',
  hooks:       'Add ordered transform/veto hooks into app data flows.',
  modals:      'Open, close, and contribute modal editors.',
  editor:      'Open registered editor tabs by kind.',
  preferences: 'Contribute settings to the Settings panel and read their values.',
  events:      'Subscribe to and emit app-level events.',
  selection:   "Read the active activity's selection capability.",
  query:       'Query other activities and read app-level state.',
  icons:       'Register an icon theme that resolves file/folder icons.',
  lightbox:    'Open a near-fullscreen lightbox overlay.',
  peek:        'Open a positioned peek popup near a trigger element.',
})

// Host/backend access permissions → human description. Each gates a brokered
// service the Workbench exposes (e.g. `scm:read` → api.scm read methods); the
// plugin never reaches the filesystem or control server directly — the Workbench
// forwards vetted requests to the Go server on its behalf.
export const HOST_PERMISSIONS = Object.freeze({
  'fs:read':      'Read files and directories through the data server.',
  'fs:write':     'Create, rename, move, and delete files through the control server.',
  'scm:read':     'Read source-control (git) state: repo detection, branches, status, and log.',
  'scm:write':    'Mutate source-control (git) repositories: stage, commit, and init.',
  'control':      'Issue arbitrary control-server operations.',
  'clipboard':    'Read and write the workbench clipboard.',
})

export const PERMISSION_NAMES = Object.freeze(Object.keys(PERMISSIONS))
export const HOST_PERMISSION_NAMES = Object.freeze(Object.keys(HOST_PERMISSIONS))

export function isKnownPermission(name) { return Object.hasOwn(PERMISSIONS, name) }
export function isKnownHostPermission(name) { return Object.hasOwn(HOST_PERMISSIONS, name) }
