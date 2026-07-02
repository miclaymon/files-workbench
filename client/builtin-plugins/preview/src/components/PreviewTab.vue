<template>
  <div class="preview-tab">
    <div v-if="!item" class="empty-state">No item to preview.</div>
    <PreviewItem
      v-else
      :item="item"
      :preview="preview"
      :metadata="metadata"
      :loading="loading"
      :fontSize="fontSize"
      :index="0"
      :mode="'single'"
      :allowLightbox="allowLightbox"
      :renderMarkdown="rendered"
      @force-load="forceLoad"
      @request-lightbox="openLightbox"
    />
  </div>
</template>

<script setup>
import { inject } from 'vue'
import PreviewItem from './preview/PreviewItem.vue'
import PreviewLightbox from './PreviewLightbox.vue'
import { usePreviewData } from './preview/usePreviewData.js'

// The Preview editor tab: a full-pane, single-item preview. Opened via the Preview
// section's "Open in Editor Tab" action, which passes the focused item as the tab's
// params; the plugin binds it here through props(tab, ctx). It reuses the same
// loader (usePreviewData) and renderer (PreviewItem, single mode) as the side-bar
// panel, so every preview kind — text, html, image, video, audio — renders alike.
// Double-clicking the media opens it in the lightbox (allowLightbox); the lightbox
// reuses this same renderer with allowLightbox:false to avoid re-triggering itself.
const props = defineProps({
  item:          { type: Object, default: null },  // { path, name, kind, size }
  fontSize:      { type: Number, default: 13 },
  allowLightbox: { type: Boolean, default: true },
  // Render markdown as a formatted document instead of markup (set by the
  // "Open as Preview" action via the tab's params).
  rendered:      { type: Boolean, default: false },
})

// force: bypass the server's size cap. The editor tab was opened with the intent of
// previewing this file, so it loads the full content instead of showing the
// "too large" warning (the side Preview panel keeps the cap + warning).
const { preview, metadata, loading, forceLoad } = usePreviewData(() => props.item, { force: true })

const viewCtx = inject('viewCtx', null)

function openLightbox(item) {
  viewCtx?.facade?.lightbox?.open({
    component: PreviewLightbox,
    props: { item, fontSize: props.fontSize },
  })
}
</script>

<style scoped>
.preview-tab { height: 100%; min-height: 0; overflow: hidden; user-select: none; }
.empty-state {
  height: 100%;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 20px;
  color: var(--text-muted);
  font-size: 13px;
}
</style>
