<template>
  <div class="grid-layout" :style="gridVars" tabindex="0" @keydown="onKeyDown">
    <DirectoryGridLayoutItem
      v-for="item in items"
      :key="item.path"
      :item="item"
      :selectedItems="selectedItems"
      :focusedItem="focusedItem"
      :alwaysShowCheckboxes="alwaysShowCheckboxes"
      :iconSize="gridVars['--icon-size']"
      @select="handleSelect"
      @focus="$emit('focus', $event)"
      @contextmenu="$emit('contextmenu', $event)"
      @navigate="$emit('navigate', $event)"
      @rename="$emit('rename', $event)"
    />
  </div>
</template>

<script setup>
import { computed } from 'vue'
import DirectoryGridLayoutItem from './DirectoryGridLayoutItem.vue'

const props = defineProps({
  items: { type: Array, required: true },
  selectedItems: { type: Array, required: true },
  focusedItem: { type: Object, default: null },
  alwaysShowCheckboxes: { type: Boolean, default: false },
  layout: { type: String, default: 'grid' },
})

const GRID_SIZES = {
  'grid-xs':  { minCell: 72,  iconSize: 36  },
  'grid-sm':  { minCell: 96,  iconSize: 48  },
  'grid':     { minCell: 120, iconSize: 64  },
  'grid-md':  { minCell: 120, iconSize: 64  },
  'grid-lg':  { minCell: 160, iconSize: 88  },
  'grid-xl':  { minCell: 200, iconSize: 112 },
  'grid-xxl': { minCell: 260, iconSize: 148 },
}

const gridVars = computed(() => {
  const s = GRID_SIZES[props.layout] ?? GRID_SIZES['grid']
  return { '--min-cell': s.minCell + 'px', '--icon-size': s.iconSize + 'px' }
})

const emit = defineEmits(['select', 'focus', 'contextmenu', 'navigate', 'rename'])

function handleSelect(payload) {
  if (payload.mode === 'shift' && props.selectedItems.length > 0) {
    const lastSelected = props.selectedItems[props.selectedItems.length - 1]
    const lastIndex = props.items.findIndex(i => i.path === lastSelected.path)
    const currentIndex = props.items.findIndex(i => i.path === payload.item.path)
    const start = Math.min(lastIndex, currentIndex)
    const end = Math.max(lastIndex, currentIndex)
    emit('select', { items: props.items.slice(start, end + 1), mode: 'replace' })
  } else {
    emit('select', payload)
  }
}

function onKeyDown(event) {
  if (event.key === 'Enter' && props.focusedItem) {
    event.preventDefault()
    if (props.focusedItem.kind === 'dir') emit('navigate', props.focusedItem.path)
    else emit('select', { item: props.focusedItem, mode: 'open' })
  }
}
</script>

<style scoped>
.grid-layout {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(var(--min-cell, 120px), 1fr));
  gap: 12px;
  padding: 16px;
  height: 100%;
  overflow-y: auto;
  align-content: start;
  outline: none;
}
.grid-layout:focus { box-shadow: inset 0 0 0 1px var(--accent); }
</style>
