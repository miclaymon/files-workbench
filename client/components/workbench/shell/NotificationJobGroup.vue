<template>
  <div class="ntf-jg" :class="`is-${status}`">
    <button class="ntf-jg-row" @click="expanded = !expanded">
      <span class="ntf-twisty" :class="{ open: expanded }">
        <svg viewBox="0 0 24 24" width="12" height="12" fill="currentColor"><path d="M8.6 5.6 7.2 7l5 5-5 5 1.4 1.4L15 12z" /></svg>
      </span>
      <span class="ntf-jg-dot" />
      <span class="ntf-jg-title">{{ title }}</span>
      <span class="ntf-jg-count">{{ operations.length }}</span>
    </button>

    <div v-if="expanded" class="ntf-jg-body">
      <NotificationOperation v-for="op in operations" :key="op.id" :operation="op" />
    </div>
  </div>
</template>

<script setup>
import { ref } from 'vue'

const props = defineProps({
  title:      { type: String, required: true },
  status:     { type: String, required: true },  // running | failed | completed
  operations: { type: Array,  default: () => [] },
  defaultOpen: { type: Boolean, default: false },
})

const expanded = ref(props.defaultOpen)
</script>

<style scoped>
.ntf-jg { margin-left: 22px; }

.ntf-jg-row {
  display: flex;
  align-items: center;
  gap: 6px;
  width: 100%;
  padding: 3px 0;
  border: none;
  background: transparent;
  color: var(--text);
  cursor: pointer;
  text-align: left;
  font-size: 12px;
  font-weight: 600;
}

.ntf-twisty {
  flex-shrink: 0;
  display: flex;
  color: var(--text-muted);
  transition: transform 0.12s;

  &.open { transform: rotate(90deg); }
}

.ntf-jg-dot {
  width: 7px;
  height: 7px;
  border-radius: 50%;
  flex-shrink: 0;

  .is-completed & { background: #4caf50; }
  .is-failed    & { background: var(--danger, #f14c4c); }
  .is-running & { background: #f9a825; }
}

.ntf-jg-title { flex: 1; }
.ntf-jg-count {
  flex-shrink: 0;
  font-size: 11px;
  font-weight: 500;
  color: var(--text-muted);
  background: color-mix(in srgb, var(--text) 8%, transparent);
  padding: 0 6px;
  border-radius: 8px;
}

.ntf-jg-body { margin-left: 17px; }
</style>
