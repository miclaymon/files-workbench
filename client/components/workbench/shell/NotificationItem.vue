<template>
  <div class="ntf-item" :class="`ntf-item--${notification.type}`">
    <div class="ntf-row">
      <button v-if="expandable" class="ntf-twisty" :class="{ open: expanded }" @click="expanded = !expanded">
        <svg viewBox="0 0 24 24" width="12" height="12" fill="currentColor"><path d="M8.6 5.6 7.2 7l5 5-5 5 1.4 1.4L15 12z" /></svg>
      </button>
      <span v-else class="ntf-twisty-spacer" />

      <span class="ntf-status">
        <svg viewBox="0 0 24 24" width="16" height="16" fill="currentColor">
          <path v-if="notification.type === 'success'" d="M12 2a10 10 0 1 0 0 20 10 10 0 0 0 0-20zm-1.2 14.4-4.2-4.2 1.4-1.4 2.8 2.8 5.6-5.6 1.4 1.4-7 7z" />
          <path v-else-if="notification.type === 'error'" d="M12 2a10 10 0 1 0 0 20 10 10 0 0 0 0-20zm3.5 12.1-1.4 1.4L12 13.4l-2.1 2.1-1.4-1.4L10.6 12 8.5 9.9l1.4-1.4L12 10.6l2.1-2.1 1.4 1.4L13.4 12l2.1 2.1z" />
          <path v-else-if="notification.type === 'warning'" d="M1 21h22L12 2 1 21zm12-3h-2v-2h2v2zm0-4h-2v-4h2v4z" />
          <path v-else-if="notification.type === 'progress'" class="ntf-spin" d="M12 4V2A10 10 0 0 0 2 12h2a8 8 0 0 1 8-8z" />
          <path v-else d="M12 2a10 10 0 1 0 0 20 10 10 0 0 0 0-20zm1 15h-2v-6h2v6zm0-8h-2V7h2v2z" />
        </svg>
      </span>

      <div class="ntf-main">
        <div class="ntf-head">
          <span class="ntf-title">{{ notification.title }}</span>
          <time class="ntf-time" :datetime="rel.iso">{{ rel.label }}</time>
        </div>
        <div v-if="notification.message" class="ntf-msg">{{ notification.message }}</div>
        <div v-if="notification.progress && notification.type === 'progress'" class="ntf-bar">
          <div class="ntf-bar-fill" :style="{ width: pct + '%' }" />
        </div>
      </div>

      <button v-if="notification.dismissible" class="ntf-x" title="Dismiss" @click.stop="$emit('dismiss')">
        <svg viewBox="0 0 24 24" width="14" height="14" fill="currentColor"><path d="M19 6.4 17.6 5 12 10.6 6.4 5 5 6.4 10.6 12 5 17.6 6.4 19 12 13.4 17.6 19 19 17.6 13.4 12z" /></svg>
      </button>
    </div>

    <div v-if="expanded" class="ntf-body">
      <!-- Rich job view: In progress / Failed / Completed subgroups -->
      <template v-if="notification.job">
        <NotificationJobGroup
          v-for="b in buckets"
          :key="b.key"
          :title="b.title"
          :status="b.status"
          :operations="b.ops"
          :defaultOpen="b.status !== 'completed'"
        />
      </template>

      <!-- Simple flat breakdown (single-call multi-item ops) -->
      <template v-else-if="notification.items">
        <div v-for="(g, i) in notification.items" :key="i" class="ntf-simple" :class="`is-${g.status}`">
          <span class="ntf-simple-dot" />
          <span class="ntf-simple-label" :title="g.label">{{ g.label }}</span>
          <span v-if="g.detail" class="ntf-simple-detail" :title="g.detail">{{ g.detail }}</span>
        </div>
      </template>
    </div>

    <div v-if="notification.actions?.length" class="ntf-actions">
      <button
        v-for="a in notification.actions"
        :key="a.id"
        class="ntf-action"
        :class="{ 'ntf-action--primary': a.primary }"
        @click="a.handler?.()"
      >{{ a.label }}</button>
    </div>
  </div>
</template>

<script setup>
import NotificationJobGroup from './NotificationJobGroup.vue'
import { ref, computed } from 'vue'
import { isoDuration, humanAgo } from '~/lib/time.js'

const props = defineProps({
  notification: { type: Object, required: true },
})
defineEmits(['dismiss'])

const expanded = ref(false)

const expandable = computed(() =>
  props.notification.job?.operations?.length > 0 || props.notification.items?.length > 0
)

const buckets = computed(() => {
  const ops = props.notification.job?.operations ?? []
  return [
    { key: 'running',   title: 'In progress', status: 'running',   ops: ops.filter(o => o.status === 'running' || o.status === 'pending') },
    { key: 'failed',    title: 'Failed',      status: 'failed',    ops: ops.filter(o => o.status === 'failed') },
    { key: 'completed', title: 'Completed',   status: 'completed', ops: ops.filter(o => o.status === 'completed') },
  ].filter(b => b.ops.length > 0)
})

const pct = computed(() => {
  const p = props.notification.progress
  if (!p?.total) return 0
  return Math.min(100, Math.round((100 * p.done) / p.total))
})

const rel = computed(() => {
  const elapsed = Date.now() - props.notification.timestamp
  return { iso: isoDuration(elapsed), label: humanAgo(elapsed) }
})
</script>

<style scoped>
.ntf-item {
  border-bottom: 1px solid var(--border);
  padding: 8px 10px;

  &:last-child { border-bottom: none; }
}

.ntf-row {
  display: flex;
  align-items: flex-start;
  gap: 6px;
}

.ntf-twisty {
  flex-shrink: 0;
  margin-top: 2px;
  display: flex;
  padding: 0;
  border: none;
  background: transparent;
  color: var(--text-muted);
  cursor: pointer;
  transition: transform 0.12s;

  &.open { transform: rotate(90deg); }
  &:hover { color: var(--text); }
}
.ntf-twisty-spacer { width: 12px; flex-shrink: 0; }

.ntf-status {
  flex-shrink: 0;
  margin-top: 1px;
  display: flex;

  .ntf-item--success & { color: #4caf50; }
  .ntf-item--error   & { color: var(--danger, #f14c4c); }
  .ntf-item--warning & { color: #f9a825; }
  .ntf-item--progress & { color: var(--accent); }
  .ntf-item--info    & { color: var(--accent); }
}

.ntf-spin { transform-origin: 12px 12px; animation: ntf-spin 0.8s linear infinite; }
@keyframes ntf-spin { to { transform: rotate(360deg); } }

.ntf-main { flex: 1; min-width: 0; }

.ntf-head { display: flex; align-items: baseline; gap: 8px; }
.ntf-title {
  font-size: 13px;
  font-weight: 600;
  color: var(--text);
  flex: 1;
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.ntf-time { font-size: 11px; color: var(--text-muted); flex-shrink: 0; }
.ntf-msg { font-size: 12px; color: var(--text-muted); margin-top: 2px; }

.ntf-bar {
  margin-top: 6px;
  height: 4px;
  border-radius: 2px;
  background: var(--border);
  overflow: hidden;
}
.ntf-bar-fill { height: 100%; background: var(--accent); transition: width 0.2s; }

.ntf-x {
  flex-shrink: 0;
  display: flex;
  padding: 2px;
  border: none;
  background: transparent;
  border-radius: 3px;
  color: var(--text-muted);
  cursor: pointer;

  &:hover { background: var(--hover-background, rgba(255,255,255,0.08)); color: var(--text); }
}

.ntf-body { margin-top: 6px; }

.ntf-simple {
  display: flex;
  align-items: center;
  gap: 6px;
  font-size: 12px;
  padding: 2px 0 2px 22px;
  color: var(--text-muted);
}
.ntf-simple-dot {
  width: 6px;
  height: 6px;
  border-radius: 50%;
  flex-shrink: 0;
  background: var(--text-muted);

  .is-success & { background: #4caf50; }
  .is-error   & { background: var(--danger, #f14c4c); }
  .is-pending & { background: #f9a825; }
}
.ntf-simple-label { overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.ntf-simple-detail {
  margin-left: auto;
  flex-shrink: 0;
  color: var(--danger, #f14c4c);
  font-size: 11px;
  max-width: 45%;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.ntf-actions {
  display: flex;
  gap: 6px;
  margin: 8px 0 2px 22px;
}
.ntf-action {
  font: inherit;
  font-size: 12px;
  padding: 3px 10px;
  border-radius: 4px;
  border: 1px solid var(--border);
  background: transparent;
  color: var(--text);
  cursor: pointer;

  &:hover { background: var(--hover-background, rgba(255,255,255,0.08)); }
  &--primary {
    border-color: var(--accent);
    background: var(--accent);
    color: #fff;
    &:hover { background: color-mix(in srgb, var(--accent) 88%, #000); }
  }
}
</style>
