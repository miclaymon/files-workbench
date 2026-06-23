import { markRaw } from 'vue'
import { mdiMagnifyScan } from '@mdi/js'

import ChatPanel from '../components/workbench/views/ChatPanel.vue'

// ── Search activity ─────────────────────────────────────────────────────────
//
// Placeholder activity (LLM chat, WIP). Declares only a single-section panel view
// that opts out of accepting docked sections.
export default {
  id: 'search',
  label: 'Search',
  icon: mdiMagnifyScan,
  builtin: true,

  panelViews: {
    search: {
      label: 'Search',
      icon: mdiMagnifyScan,
      component: markRaw(ChatPanel),
      acceptsSections: false,
    },
  },
}
