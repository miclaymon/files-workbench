import { registerActivity } from '@workbench/framework'
import WorkbenchActivity from './Workbench.js'

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
// Explorer, Preview, Details, Debug, Chat, Search, Storage, and Converter are no
// longer here — they load through the plugin host as first-party plugins
// (client/builtin-plugins/), contributing their surfaces the same way a third-party
// plugin would. See BUILTIN_PLUGINS. Only the core Workbench shell remains a
// compiled-in activity.
export const ACTIVITIES = [WorkbenchActivity]

export const ACTIVITY_MAP = Object.fromEntries(ACTIVITIES.map(a => [a.id, a]))

// Register the first-party surfaces at import (the framework registry carries no
// app bootstrap of its own) — the same registerActivity() path plugin activities
// use at runtime. Their runtime APIs are instantiated by useActivityHost, which
// receives this list as its `activities` parameter (see Workbench.vue).
for (const act of ACTIVITIES) registerActivity(act)

// Tab-kind ⇄ activity/view resolution (activityOfTabKind / tabViewIdForKind) and
// all surface lookups live in the dynamic registry (@workbench/framework), which
// also accepts plugin activities at runtime through the same registerActivity() path.
