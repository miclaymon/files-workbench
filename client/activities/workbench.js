import { markRaw } from 'vue'
import { mdiViewDashboard } from '@mdi/js'

import HomePage              from '../components/workbench/editor/HomePage.vue'
import TransientStatusWidget from '../components/workbench/shell/status/TransientStatusWidget.vue'
import JobStatusWidget       from '../components/workbench/shell/status/JobStatusWidget.vue'
import ConnectionWidget      from '../components/workbench/shell/status/ConnectionWidget.vue'
import NotificationsWidget   from '../components/workbench/shell/status/NotificationsWidget.vue'

// ── Workbench activity ──────────────────────────────────────────────────────
//
// The first-party "core" activity. It isn't an Activity Bar entry; it owns the
// app's built-in surfaces that aren't tied to a feature activity — currently the
// Home tab. App-level status widgets (connection / job / notifications) will be
// registered here once the status bar becomes activity-driven.
export default {
  id: 'workbench',
  label: 'Workbench',
  icon: mdiViewDashboard,
  builtin: true,
  core: true,

  tabViews: {
    home: {
      kind: 'home',
      label: 'Home',
      icon: mdiViewDashboard,
      component: markRaw(HomePage),
    },
  },

  // App-level status widgets. Each self-gates (renders nothing when it has no
  // relevant context), so the status bar is just an ordered host of these.
  statusViews: {
    transientStatus: { region: 'left',  order: 1, component: markRaw(TransientStatusWidget) },
    job:             { region: 'right', order: 0, component: markRaw(JobStatusWidget) },
    connection:      { region: 'right', order: 1, component: markRaw(ConnectionWidget) },
    notifications:   { region: 'right', order: 2, component: markRaw(NotificationsWidget) },
  },
}
