<template>
  <div class="preview-too-large">
    <svg viewBox="0 0 24 24" fill="currentColor" width="24" height="24" class="too-large-icon">
      <path d="M13,14H11V10H13M13,18H11V16H13M1,21H23L12,2L1,21Z" />
    </svg>
    <div class="too-large-message">
      File is too large for automatic preview
      ({{ formatBytes(fileSize) }} — limit is {{ formatBytes(maxBytes) }})
    </div>
    <button class="load-preview-btn" @click="$emit('force-load')">Load preview</button>
  </div>
</template>

<script setup>
import { formatBytes } from './utils.js'

defineProps({
  fileSize: { type: Number, required: true },
  maxBytes: { type: Number, required: true },
})

defineEmits(['force-load'])
</script>

<style scoped>
.preview-too-large {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 10px;
  padding: 28px 20px;
  text-align: center;
}
.too-large-icon { color: var(--text-muted); opacity: 0.6; }
.too-large-message { font-size: 12px; color: var(--text-muted); line-height: 1.5; max-width: 280px; }
.load-preview-btn {
  margin-top: 4px;
  padding: 6px 16px;
  border: 1px solid var(--border);
  border-radius: 4px;
  background: var(--surface);
  color: var(--text);
  font-size: 12px;
  cursor: pointer;
}
.load-preview-btn:hover { background: var(--hover-background); border-color: var(--border-hover); }
</style>
