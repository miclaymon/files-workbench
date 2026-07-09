import { markRaw } from 'vue'
import { mdiSourceBranch } from '@mdi/js'

import ChatPanel from '../components/workbench/views/ChatPanel.vue'

// ── Source Control activity ─────────────────────────────────────────────────────────
//
// Placeholder activity (LLM chat, WIP). Declares only a single-section panel view
// that opts out of accepting docked sections.
export default {
  id: 'sourceControl',
  label: 'Source Control',
  icon: mdiSourceBranch,
  builtin: true,

  panelViews: {
    sourceControl: {
      label: 'Source Control',
      icon: mdiSourceBranch,
      component: markRaw(ChatPanel),
      acceptsSections: false,
    },
  },
}
