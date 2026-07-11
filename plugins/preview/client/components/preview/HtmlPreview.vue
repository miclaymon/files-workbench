<template>
  <div class="html-preview-container">
    <div class="html-toolbar">
      <button class="html-tab" :class="{ active: view !== 'source' }" @click="view = 'rendered'">Preview</button>
      <button class="html-tab" :class="{ active: view === 'source' }" @click="view = 'source'">Source</button>
    </div>
    <div v-if="view === 'source'" class="text-preview-container">
      <MonacoEditor :modelValue="text" language="html" :fontSize="fontSize" />
    </div>
    <iframe
      v-else
      :src="src"
      class="html-frame"
      sandbox="allow-scripts allow-same-origin"
    />
  </div>
</template>

<script setup>
import { ref } from 'vue'
import { MonacoEditor } from '@fw/sdk'

defineProps({
  text: { type: String, default: '' },
  src: { type: String, required: true },
  fontSize: { type: Number, default: 13 },
})

const view = ref('rendered')
</script>

<style scoped>
.html-preview-container { display: flex; flex-direction: column; }

.html-toolbar {
  display: flex;
  gap: 2px;
  padding: 6px 8px;
  background: var(--hover-background);
  border-bottom: 1px solid var(--border);
}

.html-tab {
  background: none;
  border: 1px solid transparent;
  border-radius: 4px;
  color: var(--text-muted);
  cursor: pointer;
  font-size: 12px;
  padding: 3px 10px;
  transition: color 0.15s, background 0.15s;
}
.html-tab:hover { color: var(--text); background: var(--background); }
.html-tab.active { color: var(--text); border-color: var(--border); background: var(--background); }

.text-preview-container {
  height: 300px;
  user-select: text;
}

.html-frame {
  width: 100%;
  height: 400px;
  border: none;
  background: white;
  user-select: text;
}
</style>
