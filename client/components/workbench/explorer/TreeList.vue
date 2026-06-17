<template>
  <ul class="tree">
    <TreeItem
      v-for="item in items"
      :key="item.key || item.path"
      :node="item"
      :level="0"
      :selectedPaths="selectedPaths"
      :expanded="expanded"
      :showIcons="showIcons"
      :indentScale="indentScale"
      @select="$emit('select', $event)"
      @toggleExpand="$emit('toggleExpand', $event)"
      @dblclick="$emit('dblclick', $event)"
      @rename="$emit('rename', $event)"
    />
  </ul>
</template>

<script setup>
import TreeItem from './TreeItem.vue'

defineProps({
  items: { type: Array, required: true },
  selectedPaths: { type: Set, default: () => new Set() },
  expanded: { type: Object, default: () => ({}) },
  showIcons: { type: Boolean, default: true },
  indentScale: { type: Number, default: 1.0 },
})

defineEmits(['select', 'toggleExpand', 'dblclick', 'rename'])
</script>

<style scoped>
.tree { list-style: none; padding: 6px 0; margin: 0; }
</style>
