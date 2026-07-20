import { markRaw, ref } from 'vue'
import { mdiEye, mdiImage, mdiViewGrid, mdiOpenInNew, mdiBookOpenVariant, mdiViewSplitVertical } from '@mdi/js'
import { resolveIcon } from '@workbench/plugin-sdk'

import PreviewPanel from './components/PreviewPanel.vue'
import PreviewTab from './components/PreviewTab.vue'
import PreviewPeek from './components/PreviewPeek.vue'
import { singlePreviewable, isPreviewTabbable, thumbnailIconUrl, isMarkdown } from './components/preview/utils.js'

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

  // Open the rendered-markdown view of an item as a Preview tab. The `rendered`
  // param distinguishes it from the source (code) tab, so both can be open at once
  // and re-invoking focuses the existing rendered tab (openTab matches kind+params).
  function openRenderedPreview(item, toSide = false) {
    if (!item?.name) return
    api.editor.openTab('preview', {
      title:  `Preview: ${item.name}`,
      params: { item, rendered: true },
      toSide,
    })
  }

  const activity = new Activity({
    id: api.manifest.id,
    label: 'Preview',
    icon: mdiEye,
    // Local view state + the peek capability, exposed on the activity API (api('preview')).
    // `peek(item, rect)` opens a positioned rich-preview popup (the directory view's
    // hold-Space peek); `unpeek()` closes it. Reuses the shared PreviewItem renderer.
    setup: () => ({
      mode: ref('multi'),
      peek: (item, triggerRect) => api.peek?.open({ component: markRaw(PreviewPeek), props: { item }, triggerRect }),
      unpeek: () => api.peek?.close(),
    }),
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
        rendered: tab.params?.rendered ?? false,
      }),
      // Editor-area actions for the active tab (rendered by EditorGroup). Shown only
      // on a markdown *source* preview tab: open the rendered document in place or to
      // the side. `when` gates visibility; the rendered tab itself shows neither.
      actions: [
        {
          id:    'openAsPreview',
          icon:  mdiBookOpenVariant,
          title: 'Open as Preview',
          when:  ctx => isMarkdown(ctx.tab?.params?.item) && !ctx.tab?.params?.rendered,
          run:   ctx => openRenderedPreview(ctx.tab?.params?.item, false),
        },
        {
          id:    'openPreviewToSide',
          icon:  mdiViewSplitVertical,
          title: 'Open Preview to the Side',
          when:  ctx => isMarkdown(ctx.tab?.params?.item) && !ctx.tab?.params?.rendered,
          run:   ctx => openRenderedPreview(ctx.tab?.params?.item, true),
        },
      ],
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
