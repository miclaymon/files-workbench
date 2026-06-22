import workbench from './workbench.js'
import explorer  from './explorer.js'
import preview   from './preview.js'
import details   from './details.js'
import debug     from './debug.js'
import chat      from './chat.js'

// ── Activity registry ───────────────────────────────────────────────────────
//
// The ordered list of first-party activities. Each activity is a self-contained
// module declaring the surfaces it contributes (tabViews / panelViews / sections
// / statusViews) and, optionally, a `setup(ctx)` factory that produces its
// runtime API (state + methods + events) for inter-activity collaboration.
//
// Activity definition shape:
//   id          unique id (also the activity namespace)
//   label, icon display metadata
//   core?       true for the built-in Workbench activity
//   setup(ctx)? → API object; ctx = { host, editor, prefs, services, log }
//   tabViews?    { [viewId]: { kind, label, icon, component, props?, on? } }
//   panelViews?  { [viewId]: { label, icon, component?, sections?, actions?, props?, on?, ... } }
//   sections?    { [sectionId]: { label, icon, homeView, component, props?, on?, actions?, ... } }
//   statusViews? { [id]: { region, component, order? } }
export const ACTIVITIES = [workbench, explorer, preview, details, debug, chat]

export const ACTIVITY_MAP = Object.fromEntries(ACTIVITIES.map(a => [a.id, a]))

// ── Tab-kind ⇄ activity/view resolution ─────────────────────────────────────
//
// Editor tabs carry a runtime `kind` (e.g. 'home', 'dir'). Each tab view declares
// the kind it renders, letting us resolve a tab to its owning activity and view.

const _byKind = {}
for (const act of ACTIVITIES) {
  for (const [viewId, def] of Object.entries(act.tabViews ?? {})) {
    if (def.kind) _byKind[def.kind] = { activityId: act.id, viewId }
  }
}

/** The activity id that owns a given tab kind (defaults to the core activity). */
export function activityOfTabKind(kind) {
  return _byKind[kind]?.activityId ?? 'workbench'
}

/** The tab-view id registered for a given tab kind, if any. */
export function tabViewIdForKind(kind) {
  return _byKind[kind]?.viewId ?? null
}
