<template>
  <div class="split-section" :class="{ 'is-collapsed': showHeading && collapsed }">
    <div
      v-if="showHeading"
      class="split-section-heading"
      :draggable="draggable"
      @click="$emit('toggle', !collapsed)"
      @dragstart.stop="draggable && $emit('header-drag-start', $event)"
      @dragend.stop="draggable && $emit('header-drag-end', $event)"
    >
      <svg class="ss-chevron" viewBox="0 0 24 24" width="16" height="16" fill="currentColor">
        <path :d="collapsed ? mdiChevronRight : mdiChevronDown" />
      </svg>
      <span class="ss-title">{{ title }}</span>
      <div v-if="$slots.actions" class="ss-actions" @click.stop>
        <slot name="actions" />
      </div>
    </div>
    <div v-if="!showHeading || !collapsed" class="ss-body">
      <slot />
    </div>
  </div>
</template>

<script setup>
import { mdiChevronRight, mdiChevronDown } from '@mdi/js'

// A UI group within one View (e.g. Explorer's Places / Open Editors). The
// heading is hidden when the View has only this one section, so a single-section
// View renders as plain content. Distinct from SplitView, which is a whole View
// context with its own (lighter) heading.
defineProps({
  title:       { type: String,  required: true },
  collapsed:   { type: Boolean, default: false },
  showHeading: { type: Boolean, default: true },
  draggable:   { type: Boolean, default: false },   // section reorder / cross-context move
})
defineEmits(['toggle', 'header-drag-start', 'header-drag-end'])
</script>

<style scoped>
.split-section {
  display: flex;
  flex-direction: column;
  flex: 1;
  min-height: 0;
  overflow: hidden;
}

.split-section-heading {
  height: 22px;
  min-height: 22px;
  display: flex;
  align-items: center;
  padding: 0 4px 0 8px;
  cursor: pointer;
  user-select: none;
  color: var(--text);
  flex-shrink: 0;
}
.split-section-heading:hover { background: var(--hover); }
.split-section-heading[draggable="true"]        { cursor: grab; }
.split-section-heading[draggable="true"]:active { cursor: grabbing; }

.ss-chevron {
  width: 16px;
  height: 16px;
  flex-shrink: 0;
  color: var(--text-muted);
  margin-right: 2px;
}

.ss-title {
  flex: 1;
  font-size: 11px;
  font-weight: 700;
  letter-spacing: 0.06em;
  text-transform: uppercase;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.ss-actions {
  display: flex;
  align-items: center;
  gap: 2px;
  opacity: 0;
  flex-shrink: 0;
}
.split-section-heading:hover .ss-actions,
.split-section-heading:focus-within .ss-actions { opacity: 1; }

.ss-body {
  flex: 1;
  min-height: 0;
  overflow: hidden;
  display: flex;
  flex-direction: column;
}
</style>
