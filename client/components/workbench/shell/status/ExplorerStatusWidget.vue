<template>
  <template v-if="isDir">
    <div class="status-bar-item">Directory: {{ fmtCount(stats.count) }} item{{ stats.count === 1 ? '' : 's' }} | {{ fmtBytes(stats.totalSize) }}</div>
    <div v-if="selItems.length > 0" class="status-bar-item">Selected: {{ fmtCount(selItems.length) }} item{{ selItems.length === 1 ? '' : 's' }} | {{ fmtBytes(selSize) }}</div>
    <div v-if="clip.count > 0" class="status-bar-item status-bar-item--clipboard">{{ clip.mode }}: {{ fmtCount(clip.count) }} item{{ clip.count === 1 ? '' : 's' }} | {{ fmtBytes(clipSize) }}</div>
  </template>
</template>

<script setup>
// Explorer activity's status widget: directory totals, current selection, and the
// clipboard pill. Self-gates to the active directory tab, reading dir stats from
// the Explorer API and the selection from the host's selection capability.
import { computed, inject } from 'vue'

const ctx = inject('viewCtx', null)

const activeTab = computed(() => ctx?.activeTab?.value ?? null)
const isDir     = computed(() => activeTab.value?.kind === 'dir')
const stats     = computed(() => ctx?.api?.('explorer')?.dirStats?.value ?? { count: 0, totalSize: 0 })
const selItems  = computed(() => ctx?.selection?.value?.selectedItems ?? [])
const selSize   = computed(() => selItems.value.reduce((s, i) => s + (i.size ?? 0), 0))
const clip      = computed(() => ctx?.clipboard?.value ?? { mode: 'Copy', count: 0, items: [] })
const clipSize  = computed(() => (clip.value.items ?? []).reduce((s, i) => s + (i.size ?? 0), 0))

function fmtBytes(b) { return ctx?.formatBytes ? ctx.formatBytes(b) : `${b ?? 0} B` }
function fmtCount(n) { return Number(n ?? 0).toLocaleString() }
</script>

<style scoped>
.status-bar-item { white-space: nowrap; overflow: hidden; text-overflow: ellipsis; padding: 0 6px; border-radius: 3px; }
.status-bar-item:hover { background: rgba(255,255,255,0.12); }
.status-bar-item--clipboard { color: color-mix(in srgb, var(--accent, #007acc) 90%, var(--text)); }
</style>
