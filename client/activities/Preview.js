import { markRaw, ref } from 'vue'
import { mdiEye, mdiImage, mdiViewGrid } from '@mdi/js'

import PreviewPanel from '../components/workbench/views/PreviewPanel.vue'

// ── Preview activity ────────────────────────────────────────────────────────
//
// A pure consumer of the selection capability. It reads `host.selection` (the
// active activity's selection snapshot) rather than knowing about Explorer
// directly, so any future activity that publishes a selection can drive it.
// Owns only its local single/multi view mode.
export default {
  id: 'preview',
  label: 'Preview',
  icon: mdiEye,
  builtin: true,

  setup() {
    const mode = ref('multi')
    return { mode }
  },

  panelViews: {
    preview: {
      label: 'Preview',
      icon: mdiEye,
      sections: ['previewMain'],
      // The preview area is intentionally single-purpose — no docked sections.
      acceptsSections: false,
    },
  },

  sections: {
    previewMain: {
      label: 'Preview',
      homeView: 'preview',
      component: markRaw(PreviewPanel),
      alwaysShowHeading: true,
      actions: [
        {
          id: 'toggleMode',
          icon:  ctx => ctx.api('preview')?.mode?.value === 'single' ? mdiViewGrid : mdiImage,
          title: ctx => ctx.api('preview')?.mode?.value === 'single' ? 'Switch to multi-item preview' : 'Switch to single-item preview',
          run:   ctx => { const m = ctx.api('preview')?.mode; if (m) m.value = m.value === 'single' ? 'multi' : 'single' },
        },
      ],
      props: ctx => ({
        selectedItems:  ctx.selection.value?.selectedItems ?? [],
        focusedItem:    ctx.selection.value?.focusedItem ?? null,
        mode:           ctx.api('preview')?.mode?.value ?? 'multi',
        editorFontSize: ctx.prefs.preview?.editorFontSize ?? 13,
      }),
    },
  },
}
