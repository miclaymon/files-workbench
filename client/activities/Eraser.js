import { markRaw } from 'vue'
import { mdiNuclear } from '@mdi/js'

import ChatPanel from '../components/workbench/views/ChatPanel.vue'

// ── Eraser activity ─────────────────────────────────────────────────────────
//
// Placeholder activity (LLM chat, WIP). Declares only a single-section panel view
// that opts out of accepting docked sections.
export default {
  id: 'eraser',
  label: 'Eraser',
  icon: mdiNuclear,
  builtin: true,

  // adds a right-click context menu entry for items in the explorer editor tabs to ERASE the corresponding file(s) -- this performs a "secure delete" by overwriting the file content with random data before unlinking it from the filesystem (cannot be undone; confirm with user before performing)
}
