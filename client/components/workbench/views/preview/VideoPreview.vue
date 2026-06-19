<template>
  <div class="media-preview-container" :class="{ 'mode-single': mode === 'single' }">
    <VideoPlayer :src="src" :mime-type="mimeType" />
    <div v-if="duration && mode !== 'single'" class="media-metadata">
      <span>{{ duration }}</span>
    </div>
  </div>
</template>

<script setup>
import VideoPlayer from '../../directory/VideoPlayer.vue'

defineProps({
  src:      { type: String, required: true },
  mimeType: { type: String, default: '' },
  duration: { type: String, default: null },
  mode:     { type: String, default: 'multi' },
})
</script>

<style scoped>
.media-preview-container { display: flex; flex-direction: column; gap: 8px; padding: 12px; }
.media-preview-container.mode-single { padding: 0; gap: 0; }

.media-metadata {
  font-size: 12px;
  color: var(--text-muted);
  display: flex;
  gap: 12px;
  justify-content: center;
  flex-wrap: wrap;
}
</style>
