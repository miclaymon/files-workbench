<template>
  <div class="panel">
    <div class="panel-header">
      <div
        class="panel-activity-bar"
        :role="props.maxActivities > 1 ? 'tablist' : undefined"
        @dragover="onDragOver"
        @dragleave="onDragLeave"
        @drop="onDrop"
      >
        <button
          v-for="activity in activities"
          :key="activity.id"
          class="panel-activity-tab"
          :class="{
            active:       modelValue === activity.id,
            'is-dragging': draggedId === activity.id,
            'drop-before': dropTargetId === activity.id && dropBefore,
            'drop-after':  dropTargetId === activity.id && !dropBefore,
          }"
          :data-id="activity.id"
          role="tab"
          :aria-selected="modelValue === activity.id"
          :title="activity.label"
          draggable="true"
          @click="emit('update:modelValue', activity.id)"
          @dragstart="onDragStart(activity, $event)"
          @dragend="onDragEnd"
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
import { ref } from 'vue'

const props = defineProps({
  activities: { type: Array, required: true },
  modelValue: { type: String, required: true },
  maxActivities: { type: Number, default: Infinity },
})

const emit = defineEmits(['update:modelValue', 'add-activity', 'reorder'])

const draggedId    = ref(null)
const dropTargetId = ref(null)
const dropBefore   = ref(true)

const MIME = 'application/x-panel-activity'

function onDragStart(activity, event) {
  draggedId.value = activity.id
  event.dataTransfer.setData(MIME, JSON.stringify({ activityId: activity.id }))
  event.dataTransfer.effectAllowed = 'move'
}

function onDragEnd() {
  draggedId.value    = null
  dropTargetId.value = null
}

function onDragOver(event) {
  if (!event.dataTransfer.types.includes(MIME)) return
  event.preventDefault()
  event.dataTransfer.dropEffect = 'move'

  // Determine which tab (if any) the cursor is over and whether it's left or right half
  const tabEl = event.target.closest('.panel-activity-tab')
  if (tabEl) {
    const id = tabEl.dataset.id
    if (id && id !== draggedId.value) {
      const rect = tabEl.getBoundingClientRect()
      dropBefore.value   = event.clientX < rect.left + rect.width / 2
      dropTargetId.value = id
      return
    }
  }
  dropTargetId.value = null
}

function onDragLeave(event) {
  if (!event.currentTarget.contains(event.relatedTarget)) {
    dropTargetId.value = null
  }
}

function onDrop(event) {
  const raw = event.dataTransfer.getData(MIME)
  if (!raw) return
  event.preventDefault()
  try {
    const { activityId } = JSON.parse(raw)
    if (dropTargetId.value && activityId !== dropTargetId.value) {
      emit('reorder', { activityId, targetId: dropTargetId.value, before: dropBefore.value })
    }
  } catch {}
  draggedId.value    = null
  dropTargetId.value = null
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

.panel-activity-tab.is-dragging { opacity: 0.3; }
.panel-activity-tab.drop-before { box-shadow: -2px 0 0 var(--accent); }
.panel-activity-tab.drop-after  { box-shadow:  2px 0 0 var(--accent); }

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
