<template>
  <div class="split-view" :class="{ 'is-collapsed': showHeading && isCollapsed }">
    <div
      v-if="showHeading"
      class="split-view-heading"
      draggable="true"
      @click="onHeadingClick"
      @dragstart.stop="$emit('heading-drag-start', $event)"
      @dragend.stop="$emit('heading-drag-end', $event)"
    >
      <svg v-if="direction !== 'row'" class="sv-chevron" viewBox="0 0 24 24" width="16" height="16" fill="currentColor">
        <path :d="isCollapsed ? mdiChevronRight : mdiChevronDown" />
      </svg>
      <svg v-if="icon" class="sv-icon" viewBox="0 0 24 24" width="13" height="13" fill="currentColor">
        <path :d="icon" />
      </svg>
      <span class="sv-title">{{ label }}</span>
      <div v-if="actions.length" class="sv-actions" @click.stop>
        <ViewActions :actions="actions" />
      </div>
    </div>
    <div v-if="!isCollapsed" class="sv-body">
      <SplitSectionArea
        :sections="sections"
        direction="col"
        :viewId="view.id"
        :containerId="containerId"
        @commit="$emit('commit-sections')"
        @section-move="$emit('section-move', $event)"
      />
    </div>
  </div>
</template>

<script setup>
import { computed } from 'vue'
import { mdiChevronRight, mdiChevronDown } from '@mdi/js'
import SplitSectionArea from './SplitSectionArea.vue'
import ViewActions from './ViewActions.vue'
import { resolveViewActions } from '../../composables/useViewRegistry.js'

// A whole View context (Explorer, Debug, Preview…) inside a SplitViewArea. Its
// heading — lighter than a section heading, to read as a context boundary — is
// shown only when more than one View shares the area. Hosts a SplitSectionArea
// for the View's own sections; Views with no declared sections render a single
// implicit section (their own content, no section heading).
const props = defineProps({
  view:        { type: Object,  required: true },   // { id, collapsed, size } (mutated in place for view-level layout)
  sections:    { type: Array,   default: () => [] },// the View's own sections (the SplitSectionArea contents)
  label:       { type: String,  default: '' },
  icon:        { type: String,  default: '' },
  showHeading: { type: Boolean, default: false },
  direction:   { type: String,  default: 'col' },
  containerId: { type: String,  default: '' },
})
const emit = defineEmits(['toggle', 'commit-sections', 'section-move', 'heading-drag-start', 'heading-drag-end'])

// Row layout (bottom panel) never collapses a SplitView.
const isCollapsed = computed(() => props.direction !== 'row' && !!props.view.collapsed)

// View-level actions for the SplitViewHeading: the View's own, plus a lone
// headerless section's actions promoted up.
const actions = computed(() => resolveViewActions(props.view.id, props.sections))

function onHeadingClick() {
  if (props.direction === 'row') return
  emit('toggle', !props.view.collapsed)
}
</script>

<style scoped>
.split-view {
  display: flex;
  flex-direction: column;
  flex: 1;
  min-height: 0;
  min-width: 0;
  overflow: hidden;
}

/* Lighter than a section heading — signals a boundary between different View
   contexts merged into one tab, not a subsection within a View. */
.split-view-heading {
  height: 22px;
  min-height: 22px;
  display: flex;
  align-items: center;
  padding: 0 4px 0 8px;
  cursor: pointer;
  user-select: none;
  color: var(--text);
  flex-shrink: 0;
  background: rgba(255, 255, 255, 0.035);
  border-top: 1px solid var(--border);
}
.split-view-heading:hover  { background: var(--hover); }
.split-view-heading:active { cursor: grabbing; }

.sv-chevron {
  width: 16px;
  height: 16px;
  flex-shrink: 0;
  color: var(--text-muted);
  margin-right: 2px;
}
.sv-icon {
  flex-shrink: 0;
  color: var(--text-muted);
  margin-right: 4px;
}

.sv-title {
  flex: 1;
  font-size: 11px;
  font-weight: 700;
  letter-spacing: 0.06em;
  text-transform: uppercase;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.sv-actions {
  display: flex;
  align-items: center;
  gap: 2px;
  opacity: 0;
  flex-shrink: 0;
}
.split-view-heading:hover .sv-actions,
.split-view-heading:focus-within .sv-actions { opacity: 1; }

.sv-body {
  flex: 1;
  min-height: 0;
  overflow: hidden;
  display: flex;
  flex-direction: column;
}
</style>
