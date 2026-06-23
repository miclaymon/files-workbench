import { markRaw } from 'vue'
import { mdiImage } from '@mdi/js'

import ChatPanel from '../components/workbench/views/ChatPanel.vue'

// ── Advanced Image Tools activity ─────────────────────────────────────────────────────────
//
// Placeholder activity (LLM chat, WIP). Declares only a single-section panel view
// that opts out of accepting docked sections.
export default {
  id: 'advancedImageTools',
  label: 'Advanced Image Tools',
  icon: mdiImage,
  builtin: true,

  panelViews: {
    advancedImageTools: {
      label: 'Advanced Image Tools',
      icon: mdiImage,
      component: markRaw(ChatPanel),
      acceptsSections: false,
    },
  },
}
