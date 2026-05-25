<template>
  <div class="video-player-wrapper">
    <video ref="videoEl" class="video-js vjs-big-play-centered vjs-fluid" />
  </div>
</template>

<script setup>
import { ref, onMounted, onUnmounted, watch } from 'vue'
import videojs from 'video.js'
import 'video.js/dist/video-js.css'

const props = defineProps({
  src: { type: String, required: true },
  mimeType: { type: String, default: '' },
})

const videoEl = ref(null)
let player = null

onMounted(() => {
  player = videojs(videoEl.value, {
    controls: true,
    fluid: true,
    preload: 'metadata',
    playbackRates: [0.5, 1, 1.25, 1.5, 2],
    sources: [{ src: props.src, type: props.mimeType }],
  })
})

onUnmounted(() => {
  if (player) {
    player.dispose()
    player = null
  }
})

watch(() => props.src, (src) => {
  if (player) player.src([{ src, type: props.mimeType }])
})
</script>

<style>
.video-player-wrapper {
  width: 100%;
}

/* Override Video.js theme to match workbench dark palette */
.video-js {
  font-family: inherit;
  border-radius: 4px;
  overflow: hidden;
}

.video-js .vjs-control-bar {
  background: rgba(0, 0, 0, 0.75);
  backdrop-filter: blur(4px);
}

.video-js .vjs-play-progress,
.video-js .vjs-volume-level {
  background: var(--accent, #4dabf7);
}

.video-js .vjs-slider {
  background: rgba(255, 255, 255, 0.2);
}

.video-js .vjs-big-play-button {
  border: 2px solid rgba(255, 255, 255, 0.8);
  border-radius: 50%;
  width: 64px;
  height: 64px;
  line-height: 60px;
  top: 50%;
  left: 50%;
  transform: translate(-50%, -50%);
  margin: 0;
  background: rgba(0, 0, 0, 0.5);
  backdrop-filter: blur(4px);
  transition: background 0.15s, border-color 0.15s;
}

.video-js:hover .vjs-big-play-button,
.video-js .vjs-big-play-button:focus {
  background: rgba(0, 0, 0, 0.7);
  border-color: white;
}

.video-js .vjs-load-progress {
  background: rgba(255, 255, 255, 0.15);
}

.video-js .vjs-time-tooltip,
.video-js .vjs-mouse-display:after,
.video-js .vjs-play-progress:after {
  background: var(--accent, #4dabf7);
  color: white;
  border-radius: 3px;
}
</style>
