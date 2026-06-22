import { markRaw } from 'vue'
import { mdiBug, mdiNotificationClearAll } from '@mdi/js'

import DebugPanel from '../components/workbench/views/DebugPanel.vue'
import { useDebugLog } from '../composables/useDebugLog.js'

// ── Debug activity ──────────────────────────────────────────────────────────
//
// A provider activity: it exposes a logging API that any other activity can call
// through `host.log(...)` (which delegates to `api('debug').log`). The Debug
// panel renders the shared in-memory log. This is the canonical example of one
// activity offering a service to the rest of the app over the internal API.
export default {
  id: 'debug',
  label: 'Debug',
  icon: mdiBug,
  builtin: true,

  setup({ api }) {
    const { entries, log, clear } = useDebugLog()
    // Activity-owned command, contributed through the same facade a plugin would
    // use — proving registration isn't special-cased for first-party activities.
    api.commands.register({ id: 'debug.clearLog', title: 'Clear Debug Log', category: 'Debug', run: () => clear() })
    return { entries, log, clear }
  },

  panelViews: {
    debug: {
      label: 'Debug',
      icon: mdiBug,
      component: markRaw(DebugPanel),
      actions: [
        { id: 'clear', title: 'Clear', icon: mdiNotificationClearAll, run: ctx => ctx.api('debug')?.clear?.() },
      ],
    },
  },
}
