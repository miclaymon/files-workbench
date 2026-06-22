import { markRaw } from 'vue'
import { mdiMessage } from '@mdi/js'

import ChatPanel from '../components/workbench/views/ChatPanel.vue'

// ── Chat activity ───────────────────────────────────────────────────────────
//
// Placeholder activity (LLM chat, WIP). Declares only a single-section panel view
// that opts out of accepting docked sections.
export default {
  id: 'chat',
  label: 'Chat',
  icon: mdiMessage,
  builtin: true,

  panelViews: {
    chat: {
      label: 'Chat',
      icon: mdiMessage,
      component: markRaw(ChatPanel),
      acceptsSections: false,
    },
  },
}
