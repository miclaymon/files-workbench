import { markRaw } from 'vue'
import { mdiBug, mdiNotificationClearAll, mdiFilter, mdiFilterOutline } from '@mdi/js'

import DebugPanel from './components/DebugPanel.vue'
import { useDebugLog, LOG_LEVELS } from '@fw/sdk'

// Display label per log level, shown in the filter dropdown.
const LEVEL_LABEL = {
  debug:   'Debug',
  info:    'Info',
  warning: 'Warning',
  error:   'Error',
}

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
  const { entries, visibleEntries, log, clear, allLevelsEnabled, isLevelEnabled, toggleLevel } = useDebugLog()

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
    setup: () => ({ entries, visibleEntries, log, clear, allLevelsEnabled, isLevelEnabled, toggleLevel }),
  })
    .addView(new PanelView({
      id: 'debug',
      label: 'Debug',
      icon: mdiBug,
      location: 'BottomPanel',
      component: markRaw(DebugPanel),
      actions: [
        {
          id: 'filterLevel',
          // Funnel fills in once any level is hidden. Clicking opens a dropdown of
          // per-level toggles (multi-select) instead of cycling a single setting.
          icon:  ctx => ctx.api('debug')?.allLevelsEnabled?.value ? mdiFilterOutline : mdiFilter,
          title: 'Filter log levels',
          menu:  ctx => {
            const dbg = ctx.api('debug')
            return LOG_LEVELS.map(level => ({
              key:      `level-${level}`,
              label:    LEVEL_LABEL[level] ?? level,
              type:     'toggle',
              keepOpen: true,   // let users flip several levels without reopening
              checked:  () => dbg?.isLevelEnabled?.(level) ?? true,
              action:   () => dbg?.toggleLevel?.(level),
            }))
          },
        },
        { id: 'clear', title: 'Clear', icon: mdiNotificationClearAll, run: ctx => ctx.api('debug')?.clear?.() },
      ],
    }))

  const offActivity = api.activities.register(activity)
  return () => { offCommand(); offActivity() }
}

export function deactivate() {}
