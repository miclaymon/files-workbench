<template>
  <div class="media-preview-container">
    <AudioPlayer :src="src" :file-path="filePath" />
  </div>
</template>

<script setup>
import AudioPlayer from '../AudioPlayer.vue'

defineProps({
  src: { type: String, required: true },
  filePath: { type: String, required: true },
})
</script>

<style scoped>
.media-preview-container { display: flex; flex-direction: column; gap: 8px; padding: 12px; }
</style>
