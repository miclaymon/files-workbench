<template>
  <div class="preview-item" :class="{ 'most-recent': isLatest, 'mode-single': mode === 'single' }">
    <PreviewItemHeader v-if="mode !== 'single'" :item="item" :index="index" @copy-name="$emit('copy-name', $event)" />

    <template v-if="!loading">
      <MarkdownPreview
        v-if="preview?.kind === 'text' && renderMarkdown && preview.language === 'markdown'"
        :text="preview.text"
        :item="item"
      />
      <TextPreview
        v-else-if="preview?.kind === 'text'"
        :text="preview.text"
        :language="preview.language"
        :fontSize="fontSize"
      />
      <HtmlPreview
        v-else-if="preview?.kind === 'html'"
        :text="preview.text"
        :src="previewUrl(item.path)"
        :fontSize="fontSize"
      />
      <ImagePreview
        v-else-if="preview?.kind === 'image'"
        :src="previewUrl(item.path)"
        :thumbnailSrc="metadata ? thumbnailUrl(item.path) : null"
        :width="metadata?.width"
        :height="metadata?.height"
        :format="metadata?.format"
        :fileSize="item.size"
        :mode="mode"
        :allowLightbox="allowLightbox"
        @request-lightbox="$emit('request-lightbox', item)"
      />
      <VideoPreview
        v-else-if="preview?.kind === 'video'"
        :src="previewUrl(item.path)"
        :mimeType="metadata?.mime_type ?? ''"
        :duration="metadata?.duration_formatted"
        :mode="mode"
        :allowLightbox="allowLightbox"
        @request-lightbox="$emit('request-lightbox', item)"
      />
      <AudioPreview
        v-else-if="preview?.kind === 'audio'"
        :src="previewUrl(item.path)"
        :filePath="item.path"
      />
      <TooLargePreview
        v-else-if="preview?.kind === 'tooLarge'"
        :fileSize="preview.fileSize"
        :maxBytes="preview.maxBytes"
        @force-load="$emit('force-load', item)"
      />
      <div v-else-if="preview" class="no-preview">No preview available</div>
    </template>
  </div>
</template>

<script setup>
import { previewUrl, thumbnailUrl } from './utils.js'
import PreviewItemHeader from './PreviewItemHeader.vue'
import TextPreview from './TextPreview.vue'
import MarkdownPreview from './MarkdownPreview.vue'
import HtmlPreview from './HtmlPreview.vue'
import ImagePreview from './ImagePreview.vue'
import VideoPreview from './VideoPreview.vue'
import AudioPreview from './AudioPreview.vue'
import TooLargePreview from './TooLargePreview.vue'

defineProps({
  item:     { type: Object, required: true },
  preview:  { type: Object, default: null },
  metadata: { type: Object, default: null },
  loading:  { type: Boolean, default: false },
  fontSize: { type: Number, default: 13 },
  index:    { type: Number, required: true },
  isLatest: { type: Boolean, default: false },
  mode:     { type: String, default: 'multi' },
  allowLightbox: { type: Boolean, default: true },
  // Render markdown text as a formatted document (the editor tab's "Open as
  // Preview"); the side panel leaves this false and shows the markup.
  renderMarkdown: { type: Boolean, default: false },
})

defineEmits(['copy-name', 'force-load', 'request-lightbox'])
</script>

<style scoped>
.preview-item {
  border: 1px solid var(--border);
  border-radius: 6px;
  overflow: hidden;
  background: var(--surface, rgba(255,255,255,0.02));
}
.preview-item.most-recent { border-color: var(--accent); box-shadow: 0 0 0 1px var(--accent); }
.preview-item.mode-single {
  border: none;
  border-radius: 0;
  height: 100%;
  display: flex;
  flex-direction: column;
}
.preview-item.mode-single :deep(> *:last-child) { flex: 1; min-height: 0; }
.no-preview { padding: 20px; text-align: center; color: var(--text-muted); font-size: 13px; }
</style>
