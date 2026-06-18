<template>
  <div class="details-panel">
    <div v-if="!selectedPath" class="empty-state">Select a file to see details.</div>
    <div v-else class="details-content">
      <div class="details-section">
        <div class="details-row">
          <span class="details-label">Path</span>
          <span class="details-value mono">{{ selectedPath }}</span>
        </div>
        <template v-if="details">
          <div class="details-row" v-if="details.size !== undefined">
            <span class="details-label">Size</span>
            <span class="details-value">{{ formatBytes(details.size) }}</span>
          </div>
          <div class="details-row" v-if="details.modified">
            <span class="details-label">Modified</span>
            <span class="details-value">{{ formatDate(details.modified) }}</span>
          </div>
          <div class="details-row" v-if="details.kind">
            <span class="details-label">Kind</span>
            <span class="details-value">{{ details.kind }}</span>
          </div>
        </template>
      </div>
    </div>
  </div>
</template>

<script setup>
defineProps({
  selectedPath: { type: String, default: '' },
  details: { type: Object, default: null }
})

function formatBytes(bytes) {
  if (!bytes || bytes === 0) return '—'
  const units = ['B','KB','MB','GB']
  let i = 0, b = bytes
  while (b >= 1024 && i < units.length - 1) { b /= 1024; i++ }
  return `${b.toFixed(i === 0 ? 0 : 1)} ${units[i]}`
}

function formatDate(timestamp) {
  return new Date(timestamp * 1000).toLocaleString()
}
</script>

<style scoped>
.details-panel { height: 100%; overflow: auto; }

.empty-state { padding: 20px; color: var(--text-muted); font-size: 13px; text-align: center; }

.details-content { padding: 12px; }

.details-section { display: flex; flex-direction: column; gap: 8px; }

.details-row { display: flex; flex-direction: column; gap: 2px; padding: 8px 0; border-bottom: 1px solid rgba(255,255,255,0.05); }

.details-label { font-size: 11px; text-transform: uppercase; letter-spacing: 0.08em; color: var(--text-muted); }

.details-value { font-size: 13px; color: var(--text); word-break: break-all; }

.mono { font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace; font-size: 12px; }
</style>
