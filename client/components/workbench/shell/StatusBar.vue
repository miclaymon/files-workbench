<template>
  <div class="statusbar">
    <div class="status-left">
      <template v-if="activeTab?.kind === 'dir'">
        <div class="status-bar-item">Directory: {{ formatCount(dirStats.count) }} item{{ dirStats.count === 1 ? '' : 's' }} | {{ formatBytes(dirStats.totalSize) }}</div>
        <div v-if="selectedItems.length > 0" class="status-bar-item">Selected: {{ formatCount(selectedItems.length) }} item{{ selectedItems.length === 1 ? '' : 's' }} | {{ formatBytes(selectedItems.reduce((s, i) => s + (i.size ?? 0), 0)) }}</div>
        <div v-if="clipboard.count > 0" class="status-bar-item status-bar-item--clipboard">{{ clipboard.mode }}: {{ formatCount(clipboard.count) }} item{{ clipboard.count === 1 ? '' : 's' }} | {{ formatBytes(clipboard.items.reduce((s, i) => s + (i.size ?? 0), 0)) }}</div>
      </template>
      <div v-else-if="statusText" class="status-bar-item">{{ statusText }}</div>
    </div>
    <span class="spacer"></span>
    <span class="status-connection" :class="{ disconnected: !serverConnected }">
      <span class="connection-dot" />{{ statusRight }}
    </span>
  </div>
</template>

<script setup>
// Bottom status bar. Pure display: the active directory's item/size totals,
// current selection, clipboard pill, a transient status message, and the
// server-connection indicator. All state is owned by Workbench and passed in.
defineProps({
  activeTab:       { type: Object,  default: null },
  dirStats:        { type: Object,  default: () => ({ count: 0, totalSize: 0 }) },
  selectedItems:   { type: Array,   default: () => [] },
  clipboard:       { type: Object,  default: () => ({ mode: 'Copy', count: 0, items: [] }) },
  statusText:      { type: String,  default: '' },
  serverConnected: { type: Boolean, default: true },
  statusRight:     { type: String,  default: '' },
})

function formatBytes(bytes) {
  if (!bytes) return '0 B'
  const units = ['B', 'KB', 'MB', 'GB', 'TB']
  let i = 0
  let val = bytes
  while (val >= 1024 && i < units.length - 1) { val /= 1024; i++ }
  return `${val < 10 ? val.toFixed(1) : Math.round(val)} ${units[i]}`
}

function formatCount(n) {
  return n.toLocaleString()
}
</script>

<style scoped>
.statusbar {
  background: var(--accent);
  color: white;
  display: flex;
  align-items: center;
  padding: 0 10px;
  font-size: 12px;
  gap: 8px;
}
.spacer { flex: 1; }
.status-left { display: flex; align-items: center; gap: 2px; min-width: 0; overflow: hidden; }
.status-bar-item { white-space: nowrap; overflow: hidden; text-overflow: ellipsis; padding: 0 6px; border-radius: 3px; }
.status-bar-item:hover { background: rgba(255,255,255,0.12); }
.status-bar-item--clipboard { color: color-mix(in srgb, var(--accent, #007acc) 90%, var(--text)); }
.status-connection { display: flex; align-items: center; gap: 5px; white-space: nowrap; flex-shrink: 0; opacity: 0.85; }
.status-connection.disconnected { opacity: 1; color: #ffcdd2; }
.connection-dot {
  width: 6px;
  height: 6px;
  border-radius: 50%;
  background: #a5d6a7;
  flex-shrink: 0;
}
.status-connection.disconnected .connection-dot { background: #ef9a9a; }
</style>
