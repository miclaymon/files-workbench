<template>
  <div class="preview-peek">
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
      :allowLightbox="false"
    />
  </div>
</template>

<script setup>
import PreviewItem from './preview/PreviewItem.vue'
import { usePreviewData } from './preview/usePreviewData.js'

// The hold-Space peek body, rendered inside the positioned PeekHost popup. Reuses the
// same loader/renderer as the Preview tab/panel, so every kind — text (Monaco), html,
// image, video, audio — renders identically. force:true loads full content (a peek is
// intentional), so no "too large" card. Markdown shows its source view (panel default).
const props = defineProps({
  item:     { type: Object, default: null },   // { path, name, kind, size }
  fontSize: { type: Number, default: 12 },
})

const { preview, metadata, loading } = usePreviewData(() => props.item, { force: true })
</script>

<style scoped>
.preview-peek { height: 100%; min-height: 0; overflow: hidden; display: flex; flex-direction: column; }
.preview-peek :deep(> *) { flex: 1; min-height: 0; }
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
