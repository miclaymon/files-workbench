<template>
  <div class="preview-header">
    <div class="preview-title-group">
      <div class="preview-file-icon">
        <img
          v-if="item.thumbnail && !failedThumbnail"
          :src="item.thumbnail"
          class="preview-thumbnail"
          @error="failedThumbnail = true"
        />
        <svg v-else viewBox="0 0 24 24" fill="currentColor" width="14" height="14">
          <path :d="item.kind === 'shortcut' ? mdiLinkVariant : mdiFile" />
        </svg>
      </div>
      <span class="preview-title">{{ item.name }}</span>
      <button class="copy-name-btn" title="Copy filename" @click="$emit('copy-name', item.name)">
        <svg viewBox="0 0 24 24" fill="currentColor" width="13" height="13">
          <path :d="mdiContentCopy" />
        </svg>
      </button>
    </div>
    <span class="preview-index">#{{ index + 1 }}</span>
  </div>
</template>

<script setup>
import { ref } from 'vue'
import { mdiFile, mdiLinkVariant, mdiContentCopy } from '@mdi/js'

defineProps({
  item: { type: Object, required: true },
  index: { type: Number, required: true },
})

defineEmits(['copy-name'])

const failedThumbnail = ref(false)
</script>

<style scoped>
.preview-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 8px 12px;
  background: var(--hover-background);
  border-bottom: 1px solid var(--border);
  font-size: 12px;
}

.preview-title-group {
  display: flex;
  align-items: center;
  flex: 1;
  min-width: 0;
  overflow: hidden;
}

.preview-file-icon {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 16px;
  height: 16px;
  flex-shrink: 0;
  margin-right: 6px;
  color: var(--text-muted);
}

.preview-thumbnail {
  width: 16px;
  height: 16px;
  object-fit: cover;
  border-radius: 2px;
}

.preview-title {
  font-weight: 500;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  min-width: 0;
}

.copy-name-btn {
  opacity: 0;
  flex-shrink: 0;
  display: flex;
  align-items: center;
  justify-content: center;
  background: none;
  border: none;
  padding: 2px 4px;
  margin-left: 4px;
  border-radius: 3px;
  color: var(--text-muted);
  cursor: pointer;
  transition: opacity 0.15s, color 0.15s, background 0.15s;
}
.preview-title-group:hover .copy-name-btn { opacity: 1; }
.copy-name-btn:hover { color: var(--text); background: rgba(255,255,255,0.08); }

.preview-index {
  background: var(--accent);
  color: white;
  padding: 2px 6px;
  border-radius: 10px;
  font-size: 11px;
  font-weight: 500;
  flex-shrink: 0;
}
</style>
