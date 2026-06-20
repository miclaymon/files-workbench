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
    <span v-if="activeJob" class="sb-progress">
      <span class="sb-progress-text">{{ activeJob.progressLabel || activeJob.title }}</span>
      <meter class="sb-meter" :value="activeJob.progress.done" :max="activeJob.progress.total" />
    </span>
    <span class="status-connection" :class="{ disconnected: !serverConnected }">
      <span class="connection-dot" />{{ statusRight }}
    </span>
    <button
      class="sb-notif-btn"
      :class="{ 'sb-notif-btn--active': notificationsOpen }"
      title="Notifications"
      @click="$emit('toggle-notifications')"
    >
      <svg viewBox="0 0 24 24" width="15" height="15" fill="currentColor"><path d="M12 22a2 2 0 0 0 2-2h-4a2 2 0 0 0 2 2zm6-6v-5a6 6 0 0 0-5-5.9V4a1 1 0 1 0-2 0v1.1A6 6 0 0 0 6 11v5l-2 2v1h16v-1l-2-2z" /></svg>
      <span v-if="hasUnread" class="sb-notif-dot" />
    </button>
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
  hasUnread:        { type: Boolean, default: false },
  notificationsOpen: { type: Boolean, default: false },
  activeJob:        { type: Object,  default: null },
})

defineEmits(['toggle-notifications'])

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

.sb-progress {
  display: flex;
  align-items: center;
  gap: 8px;
  white-space: nowrap;
  flex-shrink: 0;
  margin-right: 4px;
}
.sb-progress-text { overflow: hidden; text-overflow: ellipsis; max-width: 240px; }
.sb-meter {
  -webkit-appearance: none;
  appearance: none;
  width: 90px;
  height: 9px;
  border: 1px solid white;
  border-radius: 5px;
  background: transparent;
  flex-shrink: 0;
}
/* Chromium meter internals — transparent track, white fill. */
.sb-meter::-webkit-meter-bar {
  background: transparent;
  border: none;
  border-radius: 5px;
}
.sb-meter::-webkit-meter-optimum-value,
.sb-meter::-webkit-meter-suboptimum-value,
.sb-meter::-webkit-meter-even-less-good-value {
  background: white;
  border-radius: 4px;
}

.sb-notif-btn {
  position: relative;
  display: flex;
  align-items: center;
  justify-content: center;
  width: 22px;
  height: 18px;
  margin-left: 2px;
  padding: 0;
  border: none;
  border-radius: 3px;
  background: transparent;
  color: white;
  cursor: pointer;
  flex-shrink: 0;
  opacity: 0.85;

  &:hover, &--active { background: rgba(255, 255, 255, 0.18); opacity: 1; }
}
.sb-notif-dot {
  position: absolute;
  top: 1px;
  right: 2px;
  width: 7px;
  height: 7px;
  border-radius: 50%;
  background: #ffc107;
  border: 1.5px solid var(--accent);
}
</style>
