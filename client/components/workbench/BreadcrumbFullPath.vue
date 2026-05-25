<template>
  <div class="breadcrumb-full-path" @click="handleContainerClick">
    <input
      ref="fullPathInput"
      v-model="fullPathValue"
      class="full-path-input"
      :class="{ visible: isInputFocused }"
      @focus="handleInputFocus"
      @blur="handleInputBlur"
      @keydown.enter="handleInputEnter"
      @keydown.esc="handleInputEscape"
      @click.stop
    />

    <div class="breadcrumb-overlay" :class="{ hidden: isInputFocused }">
      <div class="breadcrumb-container">
        <template v-for="(segment, index) in allSegments" :key="index">
          <div class="breadcrumb-item">
            <div class="breadcrumb-chip" :class="{ 'root-chip': index === 0 }" @click.stop="navigateToSegment(index)">
              <span class="chip-text">{{ segment }}</span>
            </div>
            <div v-if="index < allSegments.length - 1" class="breadcrumb-chevron" @click.stop="showChevronDropdown('segment', index, $event)">
              <svg width="12" height="12" viewBox="0 0 24 24" fill="currentColor">
                <path d="M8.59 16.59L13.17 12 8.59 7.41 10 6l6 6-6 6-1.41-1.41z"/>
              </svg>
            </div>
          </div>
        </template>

        <div class="breadcrumb-item">
          <div class="breadcrumb-chevron final-chevron" title="Show subdirectories" @click.stop="showChevronDropdown('current', -1, $event)">
            <svg width="12" height="12" viewBox="0 0 24 24" fill="currentColor">
              <path d="M8.59 16.59L13.17 12 8.59 7.41 10 6l6 6-6 6-1.41-1.41z"/>
            </svg>
          </div>
        </div>
      </div>
    </div>

    <FloatingMenu
      v-if="activeDropdown"
      :visible="true"
      :x="dropdownPosition.x"
      :y="dropdownPosition.y"
      :items="dropdownItems"
      type="menu"
      @close="hideDropdown"
      @item-click="hideDropdown"
    />
  </div>
</template>

<script setup>
import { ref, computed, watch, nextTick } from 'vue'
import { mdiFolder } from '@mdi/js'
import FloatingMenu from './FloatingMenu.vue'
import { fsListDir } from '~/lib/fs-api.js'

const props = defineProps({
  path: { type: String, required: true },
  changeTabPath: { type: Function, default: null },
})

const emit = defineEmits(['navigate'])

const isInputFocused = ref(false)
const fullPathValue = ref(props.path)
const fullPathInput = ref(null)

const activeDropdown = ref(null)
const dropdownPosition = ref({ x: 0, y: 0 })
const dropdownItems = ref([])

const pathInfo = computed(() => {
  if (!props.path || props.path === '/') return { root: '/', rootType: 'linux', segments: [] }

  const driveRootMatch = props.path.match(/^([A-Za-z]:)[\/\\]?$/)
  if (driveRootMatch) return { root: driveRootMatch[1], rootType: 'windows', segments: [] }

  const windowsMatch = props.path.match(/^([A-Za-z]:)[\/\\]/)
  if (windowsMatch) {
    const drive = windowsMatch[1]
    const rest = props.path.substring(windowsMatch[0].length)
    return { root: drive, rootType: 'windows', segments: rest.split(/[\/\\]/).filter(Boolean) }
  }

  if (props.path.startsWith('/')) {
    const segments = props.path.substring(1).split('/').filter(Boolean)
    return { root: '/', rootType: 'linux', segments }
  }

  return { root: '.', rootType: 'relative', segments: props.path.split(/[\/\\]/).filter(Boolean) }
})

const pathSegments = computed(() => pathInfo.value.segments)

const allSegments = computed(() => [pathInfo.value.root, ...pathInfo.value.segments])

function navigateTo(path) {
  if (props.changeTabPath) props.changeTabPath(path)
  else emit('navigate', path)
}

function navigateToSegment(index) {
  let targetPath
  if (index === 0) {
    targetPath = pathInfo.value.rootType === 'windows' ? pathInfo.value.root + '\\' : '/'
  } else {
    const segments = pathSegments.value.slice(0, index)
    targetPath = buildPath(segments)
  }
  navigateTo(targetPath)
}

function buildPath(segments) {
  if (segments.length === 0) {
    if (pathInfo.value.rootType === 'windows') return pathInfo.value.root + '\\'
    return '/'
  }
  if (pathInfo.value.rootType === 'windows') return pathInfo.value.root + '\\' + segments.join('\\')
  return '/' + segments.join('/')
}

function handleContainerClick(event) {
  const isClickable = event.target.closest('.breadcrumb-chip, .breadcrumb-chevron')
  if (!isClickable && !isInputFocused.value) fullPathInput.value?.focus()
}

function handleInputFocus() {
  isInputFocused.value = true
  fullPathValue.value = props.path
  nextTick(() => fullPathInput.value?.select())
}

function handleInputBlur() {
  isInputFocused.value = false
  const newPath = fullPathValue.value.trim()
  if (newPath && newPath !== props.path) navigateTo(newPath)
}

function handleInputEnter() { fullPathInput.value?.blur() }
function handleInputEscape() { fullPathValue.value = props.path; fullPathInput.value?.blur() }

async function showChevronDropdown(type, index, event) {
  let targetPath = type === 'current' ? props.path : (index === 0 ? pathInfo.value.root : buildPath(pathSegments.value.slice(0, index)))

  const rect = event.target.getBoundingClientRect()
  dropdownPosition.value = { x: rect.left, y: rect.bottom }

  try {
    const result = await fsListDir(targetPath, { includeMetadata: false })
    dropdownItems.value = (result.items ?? [])
      .filter(item => item.kind === 'dir')
      .map(item => ({
        key: item.path,
        label: item.name,
        icon: mdiFolder,
        action: () => navigateTo(item.path)
      }))
  } catch {
    dropdownItems.value = []
  }
  activeDropdown.value = `${type}-${index}`
}

function hideDropdown() { activeDropdown.value = null; dropdownItems.value = [] }

watch(() => props.path, (newPath) => {
  if (!isInputFocused.value) fullPathValue.value = newPath
  hideDropdown()
})
</script>

<style scoped>
.breadcrumb-full-path {
  position: relative;
  display: flex;
  align-items: center;
  padding: 2px 8px;
  min-height: 28px;
  flex: 1;
  background: var(--input-background, #1e1e1e);
  border: 1px solid var(--border, #3e3e42);
  border-radius: 4px;
  font-size: 13px;
  color: var(--text);
  overflow: hidden;
  cursor: text;
  min-width: 0;
}
.breadcrumb-full-path:hover { border-color: var(--border-hover, #5a5a5a); }
.breadcrumb-full-path:focus-within { border-color: var(--accent); outline: 1px solid var(--accent); outline-offset: -1px; }

.full-path-input {
  position: absolute; top: 0; left: 0; right: 0; bottom: 0;
  width: 100%; height: 100%;
  background: transparent; border: none; color: var(--text);
  font-size: 13px; font-family: inherit; padding: 4px 8px;
  outline: none; opacity: 0; pointer-events: none; z-index: 1;
}
.full-path-input.visible { opacity: 1; pointer-events: auto; }

.breadcrumb-overlay {
  position: relative; display: flex; align-items: center;
  width: 100%; z-index: 2; pointer-events: none;
  transition: opacity 0.15s ease;
}
.breadcrumb-overlay.hidden { opacity: 0; pointer-events: none; }

.breadcrumb-container {
  display: flex; align-items: center; gap: 0;
  width: 100%; overflow-x: auto; white-space: nowrap;
  pointer-events: auto;
}

.breadcrumb-item { display: flex; align-items: center; flex-shrink: 0; }

.breadcrumb-chip {
  display: inline-flex; align-items: center; gap: 4px;
  padding: 2px 6px; background: transparent;
  border: 1px solid transparent; border-radius: 3px;
  cursor: pointer; white-space: nowrap; flex-shrink: 0;
  transition: all 0.15s ease;
}
.breadcrumb-chip:hover { background: var(--hover-background); border-color: var(--border); }
.breadcrumb-chip.root-chip { background: var(--accent-transparent); border-color: var(--accent); }
.breadcrumb-chip.root-chip:hover { background: rgba(0,122,204,0.25); }

.chip-text { color: var(--text); font-size: 12px; user-select: none; }

.breadcrumb-chevron {
  display: flex; align-items: center; justify-content: center;
  width: 16px; height: 16px; margin: 0 1px;
  color: var(--text-muted); cursor: pointer; border-radius: 2px;
  transition: all 0.15s ease; flex-shrink: 0;
}
.breadcrumb-chevron:hover { background: var(--hover-background); color: var(--text); }
.final-chevron:hover { background: var(--accent-transparent) !important; }

.breadcrumb-container::-webkit-scrollbar { height: 3px; }
.breadcrumb-container::-webkit-scrollbar-track { background: transparent; }
.breadcrumb-container::-webkit-scrollbar-thumb { background: var(--scrollbar-thumb); border-radius: 2px; }
</style>
