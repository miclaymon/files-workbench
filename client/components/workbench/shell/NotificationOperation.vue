<template>
  <div class="ntf-op" :class="`is-${operation.status}`">
    <button class="ntf-op-row" @click="expanded = !expanded">
      <span class="ntf-twisty" :class="{ open: expanded }">
        <svg viewBox="0 0 24 24" width="11" height="11" fill="currentColor"><path d="M8.6 5.6 7.2 7l5 5-5 5 1.4 1.4L15 12z" /></svg>
      </span>
      <span class="ntf-op-dot" />
      <span class="ntf-op-label" :title="label">{{ label }}</span>
      <span class="ntf-op-meta">{{ metaText }}</span>
    </button>

    <dl v-if="expanded" class="ntf-op-details">
      <template v-if="operation.from"><dt>Original</dt><dd :title="operation.from">{{ operation.from }}</dd></template>
      <template v-if="operation.to"><dt>New</dt><dd :title="operation.to">{{ operation.to }}</dd></template>
      <template v-if="started.label"><dt>Started</dt><dd><time :datetime="started.iso">{{ started.label }}</time></dd></template>
      <template v-if="finished.label">
        <dt>{{ operation.status === 'failed' ? 'Failed' : 'Finished' }}</dt>
        <dd><time :datetime="finished.iso">{{ finished.label }}</time></dd>
      </template>
      <template v-if="operation.durationMs != null">
        <dt>Duration</dt>
        <dd><time :datetime="isoDurationMs(operation.durationMs)">{{ humanDurationMs(operation.durationMs) }}</time></dd>
      </template>
      <template v-if="operation.error"><dt>Error</dt><dd class="ntf-op-err">{{ operation.error }}</dd></template>
    </dl>
  </div>
</template>

<script setup>
import { ref, computed } from 'vue'
import { isoDurationMs, humanDurationMs, clockTime } from '~/lib/time.js'

const props = defineProps({
  operation: { type: Object, required: true },
})

const expanded = ref(false)

const label = computed(() => {
  const o = props.operation
  if (o.from && o.to) return `${o.from} → ${o.to}`
  return o.label ?? o.from ?? o.to ?? 'Operation'
})

const metaText = computed(() => {
  const o = props.operation
  if (o.status === 'running' || o.status === 'pending') return 'running…'
  return humanDurationMs(o.durationMs)
})

const started = computed(() => clockTime(props.operation.startedAt))
const finished = computed(() => clockTime(props.operation.finishedAt))
</script>

<style scoped>
.ntf-op { font-size: 12px; }

.ntf-op-row {
  display: flex;
  align-items: center;
  gap: 6px;
  width: 100%;
  padding: 2px 0;
  border: none;
  background: transparent;
  color: var(--text-muted);
  cursor: pointer;
  text-align: left;

  &:hover { color: var(--text); }
}

.ntf-twisty {
  flex-shrink: 0;
  display: flex;
  color: var(--text-muted);
  transition: transform 0.12s;

  &.open { transform: rotate(90deg); }
}

.ntf-op-dot {
  width: 6px;
  height: 6px;
  border-radius: 50%;
  flex-shrink: 0;
  background: var(--text-muted);

  .is-completed & { background: #4caf50; }
  .is-failed    & { background: var(--danger, #f14c4c); }
  .is-running &, .is-pending & { background: #f9a825; }
}

.ntf-op-label { flex: 1; min-width: 0; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.ntf-op-meta { flex-shrink: 0; font-size: 11px; color: var(--text-muted); }

.ntf-op-details {
  display: grid;
  grid-template-columns: auto 1fr;
  gap: 1px 10px;
  margin: 2px 0 6px 23px;
  padding: 6px 8px;
  background: color-mix(in srgb, var(--text) 4%, transparent);
  border-radius: 4px;

  dt { color: var(--text-muted); font-size: 11px; }
  dd { margin: 0; color: var(--text); overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
}
.ntf-op-err { color: var(--danger, #f14c4c) !important; white-space: normal !important; }
</style>
