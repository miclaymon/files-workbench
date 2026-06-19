<template>
  <div class="media-preview-container" :class="{ 'mode-single': mode === 'single' }">
    <div class="media-wrapper" :style="wrapperStyle">
      <template v-if="!loaded">
        <img v-if="thumbnailSrc" :src="thumbnailSrc" class="image-placeholder" />
        <div class="shimmer-overlay" />
      </template>
      <img
        :src="src"
        class="responsive-image"
        :class="{ visible: loaded }"
        @load="loaded = true"
        @error="loaded = true"
      />
    </div>
    <div v-if="mode !== 'single' && (width || format || fileSize)" class="media-metadata">
      <span v-if="width && height">{{ width }} × {{ height }}</span>
      <span v-if="format">{{ format.toUpperCase() }}</span>
      <span v-if="fileSize">{{ formatBytes(fileSize) }}</span>
    </div>
  </div>
</template>

<script setup>
import { ref, computed } from 'vue'
import { formatBytes } from './utils.js'

const props = defineProps({
  src:          { type: String, required: true },
  thumbnailSrc: { type: String, default: null },
  width:        { type: Number, default: null },
  height:       { type: Number, default: null },
  format:       { type: String, default: null },
  fileSize:     { type: Number, default: null },
  mode:         { type: String, default: 'multi' },
})

const loaded = ref(false)

const wrapperStyle = computed(() => {
  if (props.mode === 'single') return {}
  if (props.width && props.height) return { aspectRatio: `${props.width} / ${props.height}` }
  return { minHeight: '120px' }
})
</script>

<style scoped>
.media-preview-container { display: flex; flex-direction: column; gap: 8px; padding: 12px; }
.media-preview-container.mode-single { padding: 0; gap: 0; }
.media-preview-container.mode-single .media-wrapper {
  flex: 1;
  min-height: 0;
  border: none;
  border-radius: 0;
}
.media-preview-container.mode-single .responsive-image { max-height: 100%; }

.media-wrapper {
  position: relative;
  display: flex;
  justify-content: center;
  align-items: center;
  width: 100%;
  overflow: hidden;
  border-radius: 4px;
  border: 1px solid var(--border);
  background: var(--hover-background);
  background: var(--input-background, #1e1e1e);
  padding: 8px;
}

.image-placeholder {
  position: absolute;
  inset: 0;
  width: 100%;
  height: 100%;
  object-fit: cover;
  filter: blur(12px);
  transform: scale(1.05);
}

.shimmer-overlay {
  position: absolute;
  inset: 0;
  background: linear-gradient(
    90deg,
    transparent 0%,
    color-mix(in srgb, var(--background) 30%, transparent) 50%,
    transparent 100%
  );
  background-size: 200% 100%;
  animation: shimmer 1.4s ease-in-out infinite;
}

@keyframes shimmer {
  0% { background-position: 200% 0; }
  100% { background-position: -200% 0; }
}

.responsive-image {
  position: relative;
  max-width: 100%;
  max-height: 600px;
  object-fit: contain;
  opacity: 0;
  transition: opacity 0.25s ease;
}
.responsive-image.visible { opacity: 1; }

.media-metadata {
  font-size: 12px;
  color: var(--text-muted);
  display: flex;
  gap: 12px;
  justify-content: center;
  flex-wrap: wrap;
}
</style>
