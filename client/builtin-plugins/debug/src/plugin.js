import { markRaw } from 'vue'
import { mdiBug, mdiNotificationClearAll } from '@mdi/js'

import DebugPanel from './components/DebugPanel.vue'
import { useDebugLog } from '~/composables/useDebugLog.js'

// Debug plugin entry. A first-party plugin loaded through the plugin host (not
// compiled into ACTIVITIES) — it contributes the Debug panel to the Bottom Panel.
//
// A provider plugin: it exposes the shared in-memory log as its activity API, so
// the host's `log` capability keeps resolving (host.log → api('debug').log). The
// log itself is the app-wide useDebugLog singleton the rest of the app writes to;
// the panel renders that same buffer. This is the canonical example of a plugin
// offering a service the rest of the app consumes over the internal API.
export function activate(api) {
  const { Activity, PanelView } = api
  const { entries, log, clear } = useDebugLog()

  // Activity-owned command, contributed through the scoped api a plugin uses —
  // proving registration isn't special-cased for first-party activities.
  const offCommand = api.commands.register({
    id: 'debug.clearLog', title: 'Clear Debug Log', category: 'Debug', run: () => clear(),
  })

  const activity = new Activity({
    id: api.manifest.id,
    label: 'Debug',
    icon: mdiBug,
    // The activity API the host's `log` capability delegates to.
    setup: () => ({ entries, log, clear }),
  })
    .addView(new PanelView({
      id: 'debug',
      label: 'Debug',
      icon: mdiBug,
      location: 'BottomPanel',
      component: markRaw(DebugPanel),
      actions: [
        { id: 'clear', title: 'Clear', icon: mdiNotificationClearAll, run: ctx => ctx.api('debug')?.clear?.() },
      ],
    }))

  const offActivity = api.activities.register(activity)
  return () => { offCommand(); offActivity() }
}

export function deactivate() {}
