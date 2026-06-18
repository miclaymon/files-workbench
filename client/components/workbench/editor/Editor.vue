<template>
  <div class="editor-root">
    <GridView :node="viewRoot">
      <template #leaf="{ node }">
        <EditorGroup
          :ref="el => registerGroup(node.id, el)"
          :group="node"
          :isActive="node.id === activeGroupId"
          :isMaximized="node.id === maximizedGroupId"
          :prefs="prefs"
          :excludedCategories="prefs.excludedCategories"
          @select="$emit('select', $event)"
          @open="$emit('open', $event)"
          @navigate="$emit('navigate', $event)"
          @contextmenu="$emit('contextmenu', $event)"
          @background-contextmenu="$emit('background-contextmenu', $event)"
          @right-drag-drop="$emit('right-drag-drop', $event)"
          @rename="$emit('rename', $event)"
          @stats="$emit('stats', $event)"
          @update:layout="$emit('update:layout', $event)"
          @tab-contextmenu="$emit('tab-contextmenu', $event)"
        />
      </template>
    </GridView>
  </div>
</template>

<script setup>
import GridView from './GridView.vue'
import EditorGroup from './EditorGroup.vue'

// The main editor area: a recursive grid of editor groups (see useLayoutGrid.js).
// Purely presentational — the grid tree, active/maximized group, and the
// editorController (provided to EditorGroup via inject) all live in Workbench.
// `registerGroup` is forwarded as the per-leaf ref callback so Workbench keeps
// owning the EditorGroup instance registry it uses for imperative refresh/rename;
// every EditorGroup event is re-emitted up unchanged.
defineProps({
  viewRoot:         { type: Object,   required: true },
  activeGroupId:    { type: String,   default: null },
  maximizedGroupId: { type: String,   default: null },
  prefs:            { type: Object,   required: true },
  registerGroup:    { type: Function, required: true },
})
defineEmits([
  'select', 'open', 'navigate', 'contextmenu', 'background-contextmenu',
  'right-drag-drop', 'rename', 'stats', 'update:layout', 'tab-contextmenu',
])
</script>

<style scoped>
.editor-root {
  display: flex;
  flex-direction: column;
  min-width: 0;
  min-height: 0;
  overflow: hidden;
}
.editor-root > * { flex: 1; min-width: 0; min-height: 0; }
</style>
