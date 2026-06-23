import { markRaw } from 'vue'
import { mdiHarddisk } from '@mdi/js'

import ChatPanel from '../components/workbench/views/ChatPanel.vue'

// ── Storage activity ─────────────────────────────────────────────────────────
//
// Placeholder activity (LLM chat, WIP). Declares only a single-section panel view
// that opts out of accepting docked sections.
export default {
  id: 'storage',
  label: 'Storage',
  icon: mdiHarddisk,
  builtin: true,

  panelViews: {
    storage: {
      label: 'Storage',
      icon: mdiHarddisk,
      component: markRaw(ChatPanel),
      acceptsSections: false,
    },
  },
}
