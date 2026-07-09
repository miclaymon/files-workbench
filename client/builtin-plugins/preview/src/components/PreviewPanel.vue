<template>
  <div class="preview-panel" :class="{ 'mode-single': mode === 'single' }">
    <div v-if="!displayItems.length" class="empty-state">
      {{ validItems.length ? 'No previewable item focused.' : 'Select files to preview.' }}
    </div>
    <div v-else class="previews-list" :class="{ 'mode-single': mode === 'single' }">
      <PreviewItem
        v-for="(item, index) in displayItems"
        :key="item.path"
        :item="item"
        :preview="previews[item.path]"
        :metadata="metadata[item.path]"
        :loading="!!loadingStates[item.path]"
        :fontSize="editorFontSize"
        :index="index"
        :isLatest="mode !== 'single' && index === validItems.length - 1"
        :mode="mode"
        @copy-name="copyName"
        @force-load="forceLoadPreview"
        @request-lightbox="openLightbox"
      />
    </div>
  </div>

  <Transition name="toast">
    <div v-if="toastMessage" class="toast">{{ toastMessage }}</div>
  </Transition>
</template>

<script setup>
import { ref, computed, watch, inject } from 'vue'
import { isPreviewable, singlePreviewable } from './preview/utils.js'
import { loadPreview, forceLoadText } from './preview/load.js'
import PreviewItem from './preview/PreviewItem.vue'
import PreviewLightbox from './PreviewLightbox.vue'

// Double-clicking a single-item preview opens it in the shared lightbox overlay
// (facade.lightbox), reusing the same single-item renderer.
const viewCtx = inject('viewCtx', null)
function openLightbox(item) {
  viewCtx?.facade?.lightbox?.open({ component: PreviewLightbox, props: { item } })
}

const props = defineProps({
  selectedItems:  { type: Array, required: true },
  focusedItem:    { type: Object, default: null },
  mode:           { type: String, default: 'multi' },
  editorFontSize: { type: Number, default: 13 },
})

const validItems = computed(() => props.selectedItems.filter(isPreviewable))

const displayItems = computed(() => {
  if (props.mode === 'single') {
    const item = singlePreviewable(props.selectedItems, props.focusedItem)
    return item ? [item] : []
  }
  return validItems.value
})

const previews = ref({})
const metadata = ref({})
const loadingStates = ref({})
const previewCache = new Map()
const selectedPaths = ref(new Set())

async function forceLoadPreview(item) {
  loadingStates.value[item.path] = true
  try {
    const previewData = await forceLoadText(item, previews.value[item.path]?.language)
    if (!previewData) return
    previewCache.set(item.path, { preview: previewData, metadata: metadata.value[item.path] })
    previews.value[item.path] = previewData
  } catch {
    previews.value[item.path] = { kind: 'error' }
  } finally {
    loadingStates.value[item.path] = false
  }
}

async function loadPreviewForItem(item) {
  if (previewCache.has(item.path)) {
    const cached = previewCache.get(item.path)
    previews.value[item.path] = cached.preview
    if (cached.metadata) metadata.value[item.path] = cached.metadata
    return
  }

  loadingStates.value[item.path] = true
  try {
    const { preview, metadata: md } = await loadPreview(item)
    if (md) metadata.value[item.path] = md
    // Don't cache tooLarge (allow re-check if the user raises the limit) or errors.
    if (preview.kind !== 'tooLarge' && preview.kind !== 'error') {
      previewCache.set(item.path, { preview, metadata: md })
    }
    previews.value[item.path] = preview
  } finally {
    loadingStates.value[item.path] = false
  }
}

watch(validItems, (newItems) => {
  const newPaths = new Set(newItems.map(i => i.path))
  const oldPaths = selectedPaths.value

  oldPaths.forEach(path => {
    if (!newPaths.has(path)) {
      delete previews.value[path]
      delete metadata.value[path]
      delete loadingStates.value[path]
    }
  })

  newPaths.forEach(path => {
    if (!oldPaths.has(path)) {
      const item = newItems.find(i => i.path === path)
      if (item && !loadingStates.value[path]) loadPreviewForItem(item)
    }
  })

  selectedPaths.value = newPaths
}, { immediate: true, deep: true })

const toastMessage = ref('')
let _toastTimer = null

function showToast(msg) {
  toastMessage.value = msg
  if (_toastTimer) clearTimeout(_toastTimer)
  _toastTimer = setTimeout(() => { toastMessage.value = '' }, 2000)
}

function copyName(name) {
  navigator.clipboard.writeText(name)
    .then(() => showToast('Filename copied'))
    .catch(() => {})
}
</script>

<style scoped>
.preview-panel { min-height: 0; overflow: auto; height: 100%; user-select: none; }
.preview-panel.mode-single { overflow: hidden; }

.empty-state {
  padding: 20px;
  color: var(--text-muted);
  font-size: 13px;
  text-align: center;
}

.previews-list {
  padding: 12px;
  display: flex;
  flex-direction: column;
  gap: 16px;
}
.previews-list.mode-single { height: 100%; padding: 0; gap: 0; }

.toast {
  position: fixed;
  bottom: 28px;
  left: 50%;
  transform: translateX(-50%);
  background: rgba(20, 20, 20, 0.88);
  color: #fff;
  padding: 7px 16px;
  border-radius: 6px;
  font-size: 13px;
  pointer-events: none;
  z-index: 10000;
  white-space: nowrap;
  backdrop-filter: blur(4px);
}
.toast-enter-active, .toast-leave-active { transition: opacity 0.18s ease, transform 0.18s ease; }
.toast-enter-from { opacity: 0; transform: translateX(-50%) translateY(6px); }
.toast-leave-to   { opacity: 0; transform: translateX(-50%) translateY(6px); }
</style>
