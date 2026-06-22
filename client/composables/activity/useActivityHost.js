import { computed, watch } from 'vue'
import { ACTIVITIES, activityOfTabKind } from '~/activities/index.js'
import { createEmitter } from './useEmitter.js'

// ── Activity host (broker) ──────────────────────────────────────────────────
//
// Instantiates every activity's runtime API and brokers collaboration between
// them. It is the single object handed to view/section/status content as their
// binding context (replacing the old ad-hoc `viewCtx`): registry entries read
// app-level state, query other activities via `api(id)`, and read the active
// activity's published `selection` capability — none of them reach across
// activity boundaries directly.
//
// The same surface is what third-party plugins will eventually target, so it is
// deliberately small: query (`api`), capability resolution (`selection`),
// pub/sub (`on`/`emit`), and a couple of app-level conveniences (`log`).
//
// Params:
//   editor    the editor-grid slice (active tab / group / root)
//   prefs     reactive preferences object
//   services  app services + late-bound handlers shared with activity setups and
//             registry entries (fsStat, uuid, statusbar, …); Workbench assigns
//             slice handlers onto the returned host after its slices initialise
//   log       debug logger passed to activity setups
export function useActivityHost({ editor, prefs, services = {}, log = () => {} }) {
  const apis = new Map()
  const appEvents = createEmitter()

  const activeTab        = editor.activeTab
  const activeGroupId    = editor.activeGroupId
  const editorRoot       = editor.editorRoot
  const activeActivityId = computed(() => activityOfTabKind(activeTab.value?.kind))

  /** The runtime API for an activity, or null if it has none. */
  function api(id) { return apis.get(id) ?? null }
  function requireApi(id) {
    const a = apis.get(id)
    if (!a) throw new Error(`[activity-host] no API registered for activity "${id}"`)
    return a
  }

  // The active activity's published selection snapshot, or null when the active
  // activity publishes none (e.g. the Home tab). Consumers (Preview, Details,
  // status widgets) read this and self-gate when it is null.
  const selection = computed(() => api(activeActivityId.value)?.selection?.value ?? null)

  const host = {
    // app-level reactive context
    activeTab, activeGroupId, editorRoot, activeActivityId,
    prefs,
    // capability resolution
    selection,
    // activity API access
    api, requireApi,
    activities: () => [...apis.keys()],
    // app-level pub/sub
    on:   appEvents.on,
    once: appEvents.once,
    emit: appEvents.emit,
    // convenience: push to the Debug activity's log over its API
    log: (...a) => api('debug')?.log?.(...a),
    // shared services / late-bound slice handlers (Workbench fills these in)
    services,
  }

  // Instantiate each activity's API. setup may read other activities lazily via
  // host.api(); none do so synchronously, so map population order is safe.
  for (const def of ACTIVITIES) {
    apis.set(def.id, def.setup ? def.setup({ host, editor, prefs, services, log }) : {})
  }

  // Re-broadcast active-tab / active-activity changes as app-level events so
  // activities can react without watching the editor grid directly.
  watch(activeTab,        tab => appEvents.emit('active-tab-change', tab))
  watch(activeActivityId, id  => appEvents.emit('active-activity-change', id))

  return host
}
