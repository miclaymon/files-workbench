<template>
  <div class="dbg" ref="containerEl">
    <div v-if="entries.length === 0" class="dbg-empty">No events yet.</div>
    <div
      v-for="entry in entries"
      :key="entry.id"
      class="dbg-row"
    >
      <span class="dbg-time">{{ entry.time }}</span>
      <span class="dbg-cat" :class="`dbg-cat--${entry.category}`">{{ entry.category }}</span>
      <span class="dbg-msg">{{ entry.message }}</span>
      <span v-if="entry.data != null" class="dbg-data">{{ formatData(entry.data) }}</span>
    </div>
  </div>
</template>

<script setup>
import { ref, watch, nextTick } from 'vue'
import { useDebugLog } from '~/composables/useDebugLog.js'

const { entries } = useDebugLog()
const containerEl = ref(null)

function formatData(data) {
  if (typeof data === 'string') return data
  try { return JSON.stringify(data) } catch { return String(data) }
}

// Auto-scroll to bottom when new entries arrive, but only if already near the bottom
watch(entries, async () => {
  await nextTick()
  const el = containerEl.value
  if (!el) return
  const atBottom = el.scrollHeight - el.scrollTop - el.clientHeight < 60
  if (atBottom) el.scrollTop = el.scrollHeight
}, { deep: false })
</script>

<style scoped>
.dbg {
  height: 100%;
  overflow-y: auto;
  font-family: 'Cascadia Code', 'Fira Mono', 'Consolas', monospace;
  font-size: 11.5px;
  line-height: 1.55;
  padding: 4px 0;
  background: var(--panel, #1e1e1e);
  color: var(--text-muted);
}

.dbg-empty {
  padding: 12px 14px;
  color: var(--text-muted);
  font-style: italic;
  opacity: 0.5;
}

.dbg-row {
  display: flex;
  align-items: baseline;
  gap: 8px;
  padding: 1px 14px;
  min-height: 18px;
}
.dbg-row:hover { background: rgba(255,255,255,0.04); }

.dbg-time {
  flex-shrink: 0;
  color: var(--text-muted);
  opacity: 0.45;
  font-size: 10.5px;
  letter-spacing: 0.01em;
  user-select: none;
}

.dbg-cat {
  flex-shrink: 0;
  font-size: 10px;
  font-weight: 600;
  letter-spacing: 0.05em;
  text-transform: uppercase;
  padding: 0px 5px;
  border-radius: 3px;
  width: 60px;
  text-align: center;
  user-select: none;
}

.dbg-cat--nav       { background: rgba(38,198,218,0.18); color: #26c6da; }
.dbg-cat--select    { background: rgba(100,181,246,0.18); color: #64b5f6; }
.dbg-cat--sort      { background: rgba(186,104,200,0.18); color: #ba68c8; }
.dbg-cat--filter    { background: rgba(255,183,77,0.18);  color: #ffb74d; }
.dbg-cat--layout    { background: rgba(129,199,132,0.18); color: #81c784; }
.dbg-cat--tab       { background: rgba(255,241,118,0.18); color: #fff176; }
.dbg-cat--zoom      { background: rgba(144,164,174,0.18); color: #90a4ae; }
.dbg-cat--rename    { background: rgba(239,154,154,0.18); color: #ef9a9a; }
.dbg-cat--clipboard { background: rgba(255,204,128,0.18); color: #ffcc80; }

.dbg-msg {
  flex: 1;
  color: var(--text);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.dbg-data {
  flex-shrink: 0;
  max-width: 45%;
  color: var(--text-muted);
  opacity: 0.65;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  font-size: 10.5px;
}
</style>
