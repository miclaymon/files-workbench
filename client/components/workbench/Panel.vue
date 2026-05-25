<template>
  <div class="panel">
    <div class="panel-header">
      <div
        class="panel-activity-bar"
        :role="props.maxActivities > 1 ? 'tablist' : undefined"
        :class="{ 'drop-active': dropActive }"
        @dragover="onDragOver"
        @dragleave="onDragLeave"
        @drop="onDrop"
      >
        <button
          v-for="activity in activities"
          :key="activity.id"
          class="panel-activity-tab"
          :class="{ active: modelValue === activity.id }"
          role="tab"
          :aria-selected="modelValue === activity.id"
          :title="activity.label"
          draggable="true"
          @click="emit('update:modelValue', activity.id)"
          @dragstart="onDragStart(activity, $event)"
        >
          <svg v-if="activity.icon" viewBox="0 0 24 24" width="14" height="14" fill="currentColor" class="activity-icon">
            <path :d="activity.icon" />
          </svg>
          <span v-if="activity.label" class="activity-label">{{ activity.label }}</span>
        </button>
      </div>

      <div v-if="$slots[`${modelValue}-actions`]" class="panel-actions">
        <slot :name="`${modelValue}-actions`" />
      </div>
    </div>

    <div class="panel-body">
      <div
        v-for="activity in activities"
        :key="activity.id"
        v-show="modelValue === activity.id"
        class="panel-activity-content"
      >
        <slot :name="activity.id" />
      </div>
    </div>

    <div v-if="$slots.footer" class="panel-footer">
      <slot name="footer" />
    </div>
  </div>
</template>

<script setup>
import { ref, computed } from 'vue'

const props = defineProps({
  activities: { type: Array, required: true },
  modelValue: { type: String, required: true },
  maxActivities: { type: Number, default: Infinity },
})

const emit = defineEmits(['update:modelValue', 'add-activity', 'activity-drop'])

const dropActive = ref(false)

const canAddActivity = computed(() => props.activities.length < props.maxActivities)

function onDragStart(activity, event) {
  event.dataTransfer.setData('application/x-panel-activity', JSON.stringify({ activityId: activity.id }))
  event.dataTransfer.effectAllowed = 'move'
}

function onDragOver(event) {
  if (!canAddActivity.value) return
  if (!event.dataTransfer.types.includes('application/x-panel-activity')) return
  event.preventDefault()
  event.dataTransfer.dropEffect = 'move'
  dropActive.value = true
}

function onDragLeave(event) {
  if (!event.currentTarget.contains(event.relatedTarget)) {
    dropActive.value = false
  }
}

function onDrop(event) {
  dropActive.value = false
  if (!canAddActivity.value) return
  const raw = event.dataTransfer.getData('application/x-panel-activity')
  if (!raw) return
  event.preventDefault()
  try {
    const { activityId } = JSON.parse(raw)
    emit('activity-drop', activityId)
  } catch {}
}
</script>

<style scoped>
.panel {
  height: 100%;
  display: flex;
  flex-direction: column;
  overflow: hidden;
}

.panel-header {
  display: flex;
  align-items: stretch;
  height: 35px;
  /* border-bottom: 1px solid var(--border); */
  flex-shrink: 0;
}

.panel-activity-bar {
  display: flex;
  flex-flow: row nowrap;
  align-items: center;
  justify-content: flex-start;
  flex: 1;
  min-width: 0;
  overflow: hidden;
  padding-inline: 8px;
  gap: 8px;
  min-height: 32px;

  .panel-activity-tab {
    display: flex;
    align-items: center;
    gap: 4px;
    padding: 2px 4px;
    background: none;
    border: none;
    color: var(--text);
    opacity: 0.8;
    cursor: pointer;
    font-size: 11px;
    font-weight: 500;
    white-space: nowrap;
    flex-shrink: 0;
    letter-spacing: 0.025ch;
    text-transform: uppercase;
    user-select: none;
    transition: opacity 0.12s, border-color 0.12s;
  }

  &[role="tablist"] {
    .panel-activity-tab {
      opacity: 0.45;
      border-bottom: 2px solid transparent;
      &:hover { opacity: 0.8; }
      &.active { opacity: 1; border-bottom-color: var(--accent); }
    }
  }
}

.activity-icon { flex-shrink: 0; }

.panel-activity-add {
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 0 8px;
  background: none;
  border: none;
  border-bottom: 2px solid transparent;
  color: var(--text-muted);
  font-size: 16px;
  line-height: 1;
  cursor: pointer;
  opacity: 0.4;
  transition: opacity 0.12s;
  flex-shrink: 0;
}
.panel-activity-add:hover { opacity: 0.8; }

.panel-activity-bar.drop-active { background: color-mix(in srgb, var(--accent) 10%, transparent); }

.panel-actions {
  display: flex;
  align-items: center;
  gap: 2px;
  padding: 0 6px;
  flex-shrink: 0;
}

.panel-body {
  flex: 1;
  min-height: 0;
  overflow: auto;
}

.panel-activity-content {
  height: 100%;
}

.panel-footer {
  flex-shrink: 0;
  border-top: 1px solid var(--border);
}
</style>
