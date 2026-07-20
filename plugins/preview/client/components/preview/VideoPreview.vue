<template>
  <div class="media-preview-container" :class="{ 'mode-single': mode === 'single' }">
    <div
      ref="wrapperEl"
      class="media-wrapper"
      :class="{ zoomed, zoomable, 'cover-height': zoomed && coverAxis === 'height' }"
      :style="{ '--video-ar': videoAr }"
      @click="onWrapperClick"
    >
      <VideoPlayer :src="src" :mime-type="mimeType" />
    </div>
    <div v-if="duration && mode !== 'single'" class="media-metadata">
      <span>{{ duration }}</span>
    </div>
  </div>
</template>

<script setup>
import { ref, computed } from 'vue'
import { VideoPlayer } from '@workbench/plugin-sdk'
import { useClickDebounce } from '@workbench/plugin-sdk'

const props = defineProps({
  src:      { type: String, required: true },
  mimeType: { type: String, default: '' },
  duration: { type: String, default: null },
  mode:     { type: String, default: 'multi' },
  allowLightbox: { type: Boolean, default: true },
})

const emit = defineEmits(['request-lightbox'])

// ── Click-to-zoom (single mode only) ───────────────────────────────────────────
// The video element itself is click-to-play, so the *surrounding* wrapper (the
// letterbox area around the player) is the zoom target: only clicks landing on the
// wrapper background toggle zoom; clicks on the player pass through to play/pause.
// Zoom switches the player from "contain" (fit, letterboxed) to "cover" (fills the
// shorter axis; the longer axis overflows and the wrapper scrolls). The cover axis
// comes from the video's intrinsic aspect vs the container's at toggle time.
const wrapperEl = ref(null)
const zoomed    = ref(false)
const coverAxis = ref('width')
const videoAr   = ref(1)   // intrinsic width/height, drives the cover-height sizing

const zoomable = computed(() => props.mode === 'single')

function toggleZoom() {
  if (!zoomed.value) {
    const video = wrapperEl.value.querySelector('video')
    const cw = wrapperEl.value.clientWidth
    const ch = wrapperEl.value.clientHeight
    if (video?.videoWidth && video?.videoHeight && cw && ch) {
      videoAr.value = video.videoWidth / video.videoHeight
      coverAxis.value = videoAr.value > cw / ch ? 'height' : 'width'
    }
  }
  zoomed.value = !zoomed.value
}

// Single click on the wrapper background toggles zoom; double click opens the
// lightbox. Clicks on the player itself are ignored here so they reach Video.js
// (play/pause). Inside the lightbox (allowLightbox:false) click zooms immediately.
const { handleClick } = useClickDebounce({ delay: 220 })
function onWrapperClick(e) {
  if (!zoomable.value) return
  if (e.target !== wrapperEl.value) return
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
}

.media-wrapper {
  position: relative;
  display: flex;
  justify-content: center;
  align-items: center;
  width: 100%;
  overflow: hidden;
}
/* Single-mode wrapper background is the click-to-zoom target. */
.media-wrapper.zoomable { cursor: zoom-in; }
.media-wrapper.zoomed {
  overflow: auto;
  cursor: zoom-out;
  justify-content: safe center;
  align-items: safe center;
}

/* Cover the container's height (wide video) → fill height, width overflows. The
   fluid player keys off its wrapper width, so sizing the wrapper by aspect-ratio
   makes the player exactly container-height tall without touching Video.js layout.
   The cover-width case (tall video) needs nothing: the player already fills width
   and the now-scrollable wrapper lets its height overflow. */
.media-wrapper.zoomed.cover-height :deep(.video-player-wrapper) {
  width: auto;
  height: 100%;
  aspect-ratio: var(--video-ar);
}

.media-metadata {
  font-size: 12px;
  color: var(--text-muted);
  display: flex;
  gap: 12px;
  justify-content: center;
  flex-wrap: wrap;
}
</style>
