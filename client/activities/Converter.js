import { markRaw } from 'vue'
import { mdiArrowSplitHorizontal } from '@mdi/js'

import ChatPanel from '../components/workbench/views/ChatPanel.vue'

// ── Converter activity ─────────────────────────────────────────────────────────
//
// Placeholder activity (LLM chat, WIP). Declares only a single-section panel view
// that opts out of accepting docked sections.
export default {
  id: 'converter',
  label: 'Converter',
  icon: mdiArrowSplitHorizontal,
  builtin: true,

  panelViews: {
    converter: {
      label: 'Converter',
      icon: mdiArrowSplitHorizontal,
      component: markRaw(ChatPanel),
      acceptsSections: false,
    },
  },
}
