import { markRaw, ref } from 'vue'
import { mdiEye, mdiImage, mdiViewGrid } from '@mdi/js'

import PreviewPanel from './components/PreviewPanel.vue'

// Preview plugin entry. A first-party plugin loaded through the plugin host (not
// compiled into ACTIVITIES) — it contributes the Preview panel to the Secondary
// Side Bar entirely through the permission-scoped `api`.
//
// A pure consumer of the selection capability: its section reads the active
// activity's published selection through the host context (`ctx.selection`), so
// any activity that publishes a selection can drive it. The plugin owns only its
// local single/multi view mode, exposed on the activity API as `mode`.
export function activate(api) {
  const { Activity, PanelView, ViewSection } = api

  const activity = new Activity({
    id: api.manifest.id,
    label: 'Preview',
    icon: mdiEye,
    // Local view state, shared with the section's props/actions via api('preview').
    setup: () => ({ mode: ref('multi') }),
  })
    .addView(new PanelView({
      id: 'preview',
      label: 'Preview',
      icon: mdiEye,
      location: 'SecondarySideBar',
      sections: ['previewMain'],
      // The preview area is intentionally single-purpose — no docked sections.
      acceptsSections: false,
    }))
    .addView(new ViewSection({
      id: 'previewMain',
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
    }))

  return api.activities.register(activity)
}

export function deactivate() {}
