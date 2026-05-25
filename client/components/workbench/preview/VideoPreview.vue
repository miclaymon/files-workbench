<template>
  <div class="media-preview-container">
    <VideoPlayer :src="src" :mime-type="mimeType" />
    <div v-if="duration" class="media-metadata">
      <span>{{ duration }}</span>
    </div>
  </div>
</template>

<script setup>
import VideoPlayer from '../VideoPlayer.vue'

defineProps({
  src: { type: String, required: true },
  mimeType: { type: String, default: '' },
  duration: { type: String, default: null },
})
</script>

<style scoped>
.media-preview-container { display: flex; flex-direction: column; gap: 8px; padding: 12px; }

.media-metadata {
  font-size: 12px;
  color: var(--text-muted);
  display: flex;
  gap: 12px;
  justify-content: center;
  flex-wrap: wrap;
}
</style>
