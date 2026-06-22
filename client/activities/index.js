import WorkbenchActivity from './Workbench.js'
import ExplorerActivity  from './Explorer.js'
import PreviewActivity   from './Preview.js'
import DetailsActivity   from './Details.js'
import DebugActivity     from './Debug.js'
import ChatActivity      from './Chat.js'

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
export const ACTIVITIES = [WorkbenchActivity, ExplorerActivity, PreviewActivity, DetailsActivity, DebugActivity, ChatActivity]

export const ACTIVITY_MAP = Object.fromEntries(ACTIVITIES.map(a => [a.id, a]))

// Tab-kind ⇄ activity/view resolution (activityOfTabKind / tabViewIdForKind) and
// all surface lookups live in the dynamic registry (useViewRegistry.js), which
// bootstraps from this ACTIVITIES list and also accepts plugin activities at
// runtime through the same registerActivity() path.
