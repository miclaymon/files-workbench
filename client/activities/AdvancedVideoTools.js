import { markRaw } from 'vue'
import { mdiVideo } from '@mdi/js'

import ChatPanel from '../components/workbench/views/ChatPanel.vue'

// ── Advanced Video Tools activity ─────────────────────────────────────────────────────────
//
// Placeholder activity (LLM chat, WIP). Declares only a single-section panel view
// that opts out of accepting docked sections.
export default {
  id: 'advancedVideoTools',
  label: 'Advanced Video Tools',
  icon: mdiVideo,
  builtin: true,

  panelViews: {
    advancedVideoTools: {
      label: 'Advanced Video Tools',
      icon: mdiVideo,
      component: markRaw(ChatPanel),
      acceptsSections: false,
    },
  },
}
