<template>
  <div class="preview-lightbox">
    <PreviewItem
      v-if="item"
      :item="item"
      :preview="preview"
      :metadata="metadata"
      :loading="loading"
      :fontSize="fontSize"
      :index="0"
      :mode="'single'"
      :allowLightbox="false"
      @force-load="forceLoad"
    />
  </div>
</template>

<script setup>
import PreviewItem from './preview/PreviewItem.vue'
import { usePreviewData } from './preview/usePreviewData.js'

// The Preview lightbox body: the same single-item renderer as the editor tab, sized
// to fill the lightbox overlay. allowLightbox is false so double-clicking inside the
// lightbox doesn't recursively re-open it (single-click still toggles zoom, which is
// the natural fullscreen-viewer gesture).
const props = defineProps({
  item:     { type: Object, default: null },
  fontSize: { type: Number, default: 13 },
})

const { preview, metadata, loading, forceLoad } = usePreviewData(() => props.item)
</script>

<style scoped>
.preview-lightbox {
  width: 100%;
  height: 100%;
  display: flex;
  align-items: center;
  justify-content: center;
  overflow: hidden;
}
.preview-lightbox > :deep(*) { width: 100%; height: 100%; }
</style>
