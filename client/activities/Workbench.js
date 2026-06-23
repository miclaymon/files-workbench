import { markRaw } from 'vue'
import { mdiViewDashboard, mdiCog, mdiKeyboardOutline, mdiCodeJson } from '@mdi/js'

import HomePage              from '../components/workbench/editor/HomePage.vue'
import TransientStatusWidget from '../components/workbench/shell/status/TransientStatusWidget.vue'
import JobStatusWidget       from '../components/workbench/shell/status/JobStatusWidget.vue'
import ConnectionWidget      from '../components/workbench/shell/status/ConnectionWidget.vue'
import NotificationsWidget   from '../components/workbench/shell/status/NotificationsWidget.vue'
import SettingsModal           from '../components/workbench/ui/SettingsModal.vue'
import KeyboardShortcutsModal  from '../components/workbench/ui/KeyboardShortcutsModal.vue'

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

  // Modal editors, opened by id via host.facade.modals.open(...). ModalHost renders
  // the active one in the ModalEditor shell; props/on bind it to the host the same
  // way panel/section views bind through ViewContentHost.
  modals: {
    settings: {
      kind: 'settings',
      label: 'Settings',
      icon: mdiCog,
      component: markRaw(SettingsModal),
      width: 'min(960px, 90vw)',
      height: 'min(700px, 88vh)',
      props: ctx => ({ prefs: ctx.prefs }),
      on:    ctx => ({ save: (p) => ctx.savePreferences?.(p) }),
    },
    keyboardShortcuts: {
      kind: 'keyboardShortcuts',
      label: 'Keyboard Shortcuts',
      icon: mdiKeyboardOutline,
      component: markRaw(KeyboardShortcutsModal),
      props: ctx => ({ host: ctx }),
      // TODO: enable once keybindings are file-backed + a code-editor tab kind
      // exists (see TODO.md) — opening a JSON that doesn't drive the registry
      // would mislead.
      actions: [
        { key: 'json', icon: mdiCodeJson, title: 'Open Keyboard Shortcuts (JSON) — available once keybindings are file-backed', disabled: true, run: () => {} },
      ],
    },
  },
}
