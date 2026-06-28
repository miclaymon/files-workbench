import { markRaw, ref } from 'vue'
import { mdiEye, mdiImage, mdiViewGrid, mdiOpenInNew } from '@mdi/js'
import { resolveIcon } from '~/composables/useIconRegistry.js'

import PreviewPanel from './components/PreviewPanel.vue'
import PreviewTab from './components/PreviewTab.vue'
import { singlePreviewable, isPreviewTabbable, thumbnailIconUrl } from './components/preview/utils.js'

// Per-tab icon for a Preview editor tab: the item's thumbnail when it's an image
// or video, else its file-type icon from the active icon pack (resolveIcon, layer
// 2 of the icon pipeline). Returns null to fall back to the tab's kind icon (mdiEye)
// — e.g. when no icon pack is active or the item has no params.
function previewTabIcon(tab) {
  const item = tab.params?.item
  if (!item?.name) return null
  const thumb = thumbnailIconUrl(item)
  if (thumb) return { type: 'url', icon: thumb }
  return resolveIcon({
    path: item.path, name: item.name, kind: item.kind,
    isDir: false, expanded: false, hasThumbnail: false, activityName: 'preview',
  })
}

// Preview plugin entry. A first-party plugin loaded through the plugin host (not
// compiled into ACTIVITIES) — it contributes the Preview panel to the Secondary
// Side Bar entirely through the permission-scoped `api`.
//
// A pure consumer of the selection capability: its section reads the active
// activity's published selection through the host context (`ctx.selection`), so
// any activity that publishes a selection can drive it. The plugin owns only its
// local single/multi view mode, exposed on the activity API as `mode`.
export function activate(api) {
  const { Activity, EditorView, PanelView, ViewSection } = api

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
    // The Preview editor tab (kind 'preview'): a single-item preview in the editor
    // grid, opened by the section action below. Its item rides in the tab's params
    // and binds to the component here — the standard editor-tab contribution path.
    .addView(new EditorView({
      id: 'previewTab',
      kind: 'preview',
      label: 'Preview',
      icon: mdiEye,
      tabIcon: previewTabIcon,   // thumbnail (image/video) or file-type icon per tab
      component: markRaw(PreviewTab),
      props: (tab, ctx) => ({
        item:     tab.params?.item ?? null,
        fontSize: ctx.prefs.preview?.editorFontSize ?? 13,
      }),
    }))
    .addView(new ViewSection({
      id: 'previewMain',
      label: 'Preview',
      homeView: 'preview',
      component: markRaw(PreviewPanel),
      alwaysShowHeading: true,
      actions: [
        {
          id: 'openInEditor',
          icon:  mdiOpenInNew,
          // Enabled only in single-item mode AND when that item has a real preview:
          // multi-item mode has no single target, and directories/archives have no
          // inline preview. Otherwise the button shows but is disabled.
          title: ctx => ctx.api('preview')?.mode?.value === 'single'
            ? 'Open in Editor Tab'
            : 'Open in Editor Tab (single-item mode only)',
          disabled: ctx => {
            if (ctx.api('preview')?.mode?.value !== 'single') return true
            const sel = ctx.selection.value
            return !isPreviewTabbable(singlePreviewable(sel?.selectedItems, sel?.focusedItem))
          },
          run: ctx => {
            const sel = ctx.selection.value
            const item = singlePreviewable(sel?.selectedItems, sel?.focusedItem)
            if (!isPreviewTabbable(item)) return
            api.editor.openTab('preview', {
              title:  item.name,
              params: { item },   // matched by openTab so re-opening the same item focuses its tab
            })
          },
        },
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
