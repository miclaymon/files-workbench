<template>
  <div class="audio-player" :class="{ 'has-art': artUrl }">
    <!-- Album art / background -->
    <div class="art-section">
      <div
        v-if="artUrl"
        class="art-bg"
        :style="{ backgroundImage: `url(${artUrl})` }"
      />
      <div class="art-bg-overlay" />
      <img v-if="artUrl" :src="artUrl" class="art-image" />
      <div v-else class="art-placeholder">
        <svg viewBox="0 0 24 24" fill="currentColor" width="48" height="48">
          <path d="M12 3v9.28a4.39 4.39 0 0 0-1.5-.28C8.01 12 6 14.01 6 16.5S8.01 21 10.5 21c2.31 0 4.2-1.75 4.45-4H15V6h3V3h-6z"/>
        </svg>
      </div>
    </div>

    <!-- Waveform + controls -->
    <div class="controls-section">
      <div ref="waveformEl" class="waveform" />

      <div class="transport">
        <button class="transport-btn" @click="skipBy(-10)" title="−10s">
          <svg viewBox="0 0 24 24" fill="currentColor" width="18" height="18">
            <path d="M11.99 5V1l-5 5 5 5V7c3.31 0 6 2.69 6 6s-2.69 6-6 6-6-2.69-6-6h-2c0 4.42 3.58 8 8 8s8-3.58 8-8-3.58-8-8-8z"/>
            <text x="7.5" y="16" font-size="5.5" text-anchor="middle" fill="currentColor">10</text>
          </svg>
        </button>

        <button class="transport-btn play-btn" @click="togglePlay">
          <svg v-if="!playing" viewBox="0 0 24 24" fill="currentColor" width="24" height="24">
            <path d="M8 5v14l11-7z"/>
          </svg>
          <svg v-else viewBox="0 0 24 24" fill="currentColor" width="24" height="24">
            <path d="M6 19h4V5H6v14zm8-14v14h4V5h-4z"/>
          </svg>
        </button>

        <button class="transport-btn" @click="skipBy(10)" title="+10s">
          <svg viewBox="0 0 24 24" fill="currentColor" width="18" height="18">
            <path d="M12 5V1l5 5-5 5V7c-3.31 0-6 2.69-6 6s2.69 6 6 6 6-2.69 6-6h2c0 4.42-3.58 8-8 8s-8-3.58-8-8 3.58-8 8-8z"/>
            <text x="16.5" y="16" font-size="5.5" text-anchor="middle" fill="currentColor">10</text>
          </svg>
        </button>
      </div>

      <div class="time-row">
        <span class="time-label">{{ formatTime(currentTime) }}</span>
        <div class="spacer" />
        <select class="rate-select" :value="rate" @change="setRate($event.target.value)">
          <option value="0.5">0.5×</option>
          <option value="1">1×</option>
          <option value="1.25">1.25×</option>
          <option value="1.5">1.5×</option>
          <option value="2">2×</option>
        </select>
        <span class="time-label">{{ formatTime(duration) }}</span>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, onMounted, onUnmounted, watch } from 'vue'
import WaveSurfer from 'wavesurfer.js'
import { MEDIA_BASE } from '@files-workbench/core'

const props = defineProps({
  src: { type: String, required: true },
  filePath: { type: String, required: true },
})

const waveformEl = ref(null)
const artUrl = ref(null)
const playing = ref(false)
const currentTime = ref(0)
const duration = ref(0)
const rate = ref(1)

let ws = null

async function loadArtwork() {
  try {
    const res = await fetch(`${MEDIA_BASE}/artwork?path=${encodeURIComponent(props.filePath)}`)
    if (res.ok) {
      const blob = await res.blob()
      artUrl.value = URL.createObjectURL(blob)
    }
  } catch {
    // no artwork — that's fine
  }
}

onMounted(async () => {
  await loadArtwork()

  ws = WaveSurfer.create({
    container: waveformEl.value,
    waveColor: 'rgba(255,255,255,0.35)',
    progressColor: 'var(--accent, #4dabf7)',
    cursorColor: 'var(--accent, #4dabf7)',
    height: 64,
    barWidth: 2,
    barGap: 1,
    barRadius: 2,
    normalize: true,
    url: props.src,
  })

  ws.on('ready', () => { duration.value = ws.getDuration() })
  ws.on('audioprocess', (t) => { currentTime.value = t })
  ws.on('seeking', (t) => { currentTime.value = t })
  ws.on('play', () => { playing.value = true })
  ws.on('pause', () => { playing.value = false })
  ws.on('finish', () => { playing.value = false })
})

onUnmounted(() => {
  if (ws) { ws.destroy(); ws = null }
  if (artUrl.value) URL.revokeObjectURL(artUrl.value)
})

watch(() => props.src, async (src) => {
  if (artUrl.value) { URL.revokeObjectURL(artUrl.value); artUrl.value = null }
  await loadArtwork()
  if (ws) ws.load(src)
})

function togglePlay() { ws?.playPause() }

function skipBy(secs) {
  if (!ws) return
  ws.setTime(Math.max(0, Math.min(ws.getCurrentTime() + secs, ws.getDuration())))
}

function setRate(val) {
  rate.value = Number(val)
  if (ws) ws.setPlaybackRate(rate.value)
}

function formatTime(secs) {
  if (!secs || isNaN(secs)) return '0:00'
  const m = Math.floor(secs / 60)
  const s = Math.floor(secs % 60).toString().padStart(2, '0')
  return `${m}:${s}`
}
</script>

<style scoped>
.audio-player {
  display: flex;
  flex-direction: column;
  border-radius: 8px;
  overflow: hidden;
  background: var(--background);
}

.art-section {
  position: relative;
  display: flex;
  justify-content: center;
  align-items: center;
  min-height: 160px;
  overflow: hidden;
}

.art-bg {
  position: absolute;
  inset: -20px;
  background-size: cover;
  background-position: center;
  filter: blur(24px) brightness(0.5);
  transform: scale(1.1);
}

.art-bg-overlay {
  position: absolute;
  inset: 0;
  background: linear-gradient(to bottom, transparent 60%, var(--background));
}

.art-image {
  position: relative;
  width: 140px;
  height: 140px;
  object-fit: cover;
  border-radius: 6px;
  box-shadow: 0 8px 32px rgba(0, 0, 0, 0.5);
  margin: 16px 0 8px;
}

.art-placeholder {
  position: relative;
  display: flex;
  align-items: center;
  justify-content: center;
  width: 120px;
  height: 120px;
  border-radius: 6px;
  background: var(--hover-background);
  border: 1px solid var(--border);
  color: var(--text-muted);
  margin: 16px 0 8px;
}

.controls-section {
  padding: 12px 16px 14px;
  display: flex;
  flex-direction: column;
  gap: 10px;
}

.waveform {
  width: 100%;
  cursor: pointer;
  border-radius: 4px;
  overflow: hidden;
}

.transport {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 16px;
}

.transport-btn {
  display: flex;
  align-items: center;
  justify-content: center;
  background: none;
  border: none;
  color: var(--text);
  cursor: pointer;
  padding: 6px;
  border-radius: 50%;
  opacity: 0.8;
  transition: opacity 0.15s, background 0.15s;
}

.transport-btn:hover { opacity: 1; background: var(--hover-background); }

.play-btn {
  width: 44px;
  height: 44px;
  background: var(--accent, #4dabf7);
  color: white;
  opacity: 1;
}

.play-btn:hover { background: var(--accent, #4dabf7); filter: brightness(1.1); }

.time-row {
  display: flex;
  align-items: center;
  gap: 8px;
  font-size: 12px;
  color: var(--text-muted);
}

.spacer { flex: 1; }

.time-label { font-variant-numeric: tabular-nums; }

.rate-select {
  background: var(--hover-background);
  border: 1px solid var(--border);
  border-radius: 4px;
  color: var(--text-muted);
  font-size: 11px;
  padding: 2px 4px;
  cursor: pointer;
}
</style>
