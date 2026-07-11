<template>
  <div class="media-preview-container" :class="{ 'mode-single': mode === 'single' }">
    <div
      ref="wrapperEl"
      class="media-wrapper"
      :class="{ zoomed, zoomable }"
      :style="wrapperStyle"
      @click="onClick"
    >
      <template v-if="!loaded">
        <img v-if="thumbnailSrc" :src="thumbnailSrc" class="image-placeholder" />
        <div class="shimmer-overlay" />
      </template>
      <img
        ref="imgEl"
        :src="src"
        class="responsive-image"
        :class="{ visible: loaded }"
        :style="imageStyle"
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
import { useClickDebounce } from '@fw/sdk'

const props = defineProps({
  src:          { type: String, required: true },
  thumbnailSrc: { type: String, default: null },
  width:        { type: Number, default: null },
  height:       { type: Number, default: null },
  format:       { type: String, default: null },
  fileSize:     { type: Number, default: null },
  mode:         { type: String, default: 'multi' },
  allowLightbox:{ type: Boolean, default: true },
})

const emit = defineEmits(['request-lightbox'])

const loaded = ref(false)

const wrapperStyle = computed(() => {
  if (props.mode === 'single') return {}
  if (props.width && props.height) return { aspectRatio: `${props.width} / ${props.height}` }
  return { minHeight: '120px' }
})

// ── Click-to-zoom (single mode only) ───────────────────────────────────────────
// Toggles the image between "contain" (whole image fit) and "cover" (fills the
// container's shorter axis; the longer axis overflows and the wrapper scrolls).
// The cover axis is chosen from the image's aspect vs the container's at toggle
// time, so the right axis is filled regardless of orientation.
const wrapperEl = ref(null)
const imgEl     = ref(null)
const zoomed    = ref(false)
const coverAxis = ref('width')   // axis pinned to 100% when zoomed

const zoomable = computed(() => props.mode === 'single')

const imageStyle = computed(() => {
  if (!zoomed.value) return {}
  return coverAxis.value === 'height'
    ? { width: 'auto', height: '100%', maxWidth: 'none', maxHeight: 'none' }
    : { width: '100%', height: 'auto', maxWidth: 'none', maxHeight: 'none' }
})

function toggleZoom() {
  if (!zoomable.value) return
  if (!zoomed.value) {
    // Pin the axis that makes the image cover: a wide image fills height (width
    // overflows); a tall image fills width (height overflows). Falls back to
    // width-fill if the sizes aren't measurable yet.
    const w = wrapperEl.value
    const img = imgEl.value
    if (w?.clientWidth && w?.clientHeight && img?.naturalWidth && img?.naturalHeight) {
      const containerAspect = w.clientWidth / w.clientHeight
      const imageAspect = img.naturalWidth / img.naturalHeight
      coverAxis.value = imageAspect > containerAspect ? 'height' : 'width'
    }
  }
  zoomed.value = !zoomed.value
}

// Single click toggles zoom; double click opens the lightbox. The debounce keeps a
// double-click from flickering zoom on/off first. Inside the lightbox
// (allowLightbox:false) there's no double action, so click zooms immediately.
const { handleClick } = useClickDebounce({ delay: 220 })
function onClick() {
  if (!zoomable.value) return
  if (!props.allowLightbox) { toggleZoom(); return }
  handleClick('media', toggleZoom, () => emit('request-lightbox'))
}
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
/* Single-mode wrapper is the click-to-zoom target. */
.media-wrapper.zoomable { cursor: zoom-in; }
.media-wrapper.zoomed {
  overflow: auto;
  cursor: zoom-out;
  /* `safe` keeps the filled axis centered but pins to the start once the content
     overflows, so the leading edge is never clipped out of reach. */
  justify-content: safe center;
  align-items: safe center;
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
