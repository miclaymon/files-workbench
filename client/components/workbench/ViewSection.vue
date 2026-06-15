<template>
  <div class="view-section" :class="{ 'is-collapsed': modelValue }">
    <div
      class="section-header"
      :draggable="draggable"
      @click="$emit('update:modelValue', !modelValue)"
      @dragstart.stop="draggable && $emit('header-drag-start', $event)"
      @dragend.stop="draggable && $emit('header-drag-end', $event)"
    >
      <svg class="section-chevron" viewBox="0 0 24 24" width="16" height="16" fill="currentColor">
        <path :d="modelValue ? mdiChevronRight : mdiChevronDown" />
      </svg>
      <span class="section-title">{{ title }}</span>
      <div v-if="$slots.actions" class="section-actions" @click.stop>
        <slot name="actions" />
      </div>
    </div>
    <div v-if="!modelValue" class="section-body">
      <slot />
    </div>
  </div>
</template>

<script setup>
import { mdiChevronRight, mdiChevronDown } from '@mdi/js'

defineProps({
  title:      { type: String,  required: true },
  modelValue: { type: Boolean, default: false },   // true = collapsed
  draggable:  { type: Boolean, default: false },   // enables header drag for extraction
})
defineEmits(['update:modelValue', 'header-drag-start', 'header-drag-end'])
</script>

<style scoped>
.view-section {
  display: flex;
  flex-direction: column;
  flex: 1;
  min-height: 0;
  overflow: hidden;
}

.section-header {
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
.section-header:hover { background: var(--hover); }
.section-header[draggable="true"] { cursor: grab; }
.section-header[draggable="true"]:active { cursor: grabbing; }

.section-chevron {
  width: 16px;
  height: 16px;
  flex-shrink: 0;
  color: var(--text-muted);
  margin-right: 2px;
}

.section-title {
  flex: 1;
  font-size: 11px;
  font-weight: 700;
  letter-spacing: 0.06em;
  text-transform: uppercase;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.section-actions {
  display: flex;
  align-items: center;
  gap: 2px;
  opacity: 0;
  flex-shrink: 0;
}
.section-header:hover .section-actions { opacity: 1; }

.section-body {
  flex: 1;
  min-height: 0;
  overflow: hidden;
  display: flex;
  flex-direction: column;
}
</style>
