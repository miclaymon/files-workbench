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
      />
    </div>
  </div>

  <Transition name="toast">
    <div v-if="toastMessage" class="toast">{{ toastMessage }}</div>
  </Transition>
</template>

<script setup>
import { ref, computed, watch } from 'vue'
import { EXT_LANGUAGE, TEXT_APP_MIMES } from './preview/utils.js'
import { MEDIA_BASE as API_BASE } from '~/lib/api-config.js'
import PreviewItem from './preview/PreviewItem.vue'

const props = defineProps({
  selectedItems:  { type: Array, required: true },
  focusedItem:    { type: Object, default: null },
  mode:           { type: String, default: 'multi' },
  editorFontSize: { type: Number, default: 13 },
})

const validItems = computed(() =>
  props.selectedItems.filter(item => item?.path && item?.name && item?.kind !== 'dir' && item?.kind !== 'directory')
)

const displayItems = computed(() => {
  if (props.mode === 'single') {
    const fi = props.focusedItem
    const item = (fi?.path && fi?.kind !== 'dir' && fi?.kind !== 'directory')
      ? fi
      : (validItems.value.at(-1) ?? null)
    return item ? [item] : []
  }
  return validItems.value
})

const previews = ref({})
const metadata = ref({})
const loadingStates = ref({})
const previewCache = new Map()
const selectedPaths = ref(new Set())

async function fetchTextContent(path, force = false) {
  const base = import.meta.env.DEV ? '/text-preview' : `${API_BASE}/fs/preview`
  const params = new URLSearchParams({ path })
  if (force) params.set('force', 'true')
  const res = await fetch(`${base}?${params}`)
  return res.ok ? res.json() : null
}

async function forceLoadPreview(item) {
  loadingStates.value[item.path] = true
  try {
    const data = await fetchTextContent(item.path, true)
    if (!data || data.kind === 'tooLarge') return
    const ext = item.name.split('.').pop()?.toLowerCase() ?? ''
    const lang = EXT_LANGUAGE[ext] ?? previews.value[item.path]?.language ?? 'plaintext'
    const previewData = { kind: 'text', text: data.text, language: lang }
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
    const response = await fetch(`${API_BASE}/metadata?path=${encodeURIComponent(item.path)}`)
    if (!response.ok) { previews.value[item.path] = { kind: 'error' }; return }

    const itemMetadata = await response.json()
    metadata.value[item.path] = itemMetadata

    const mime = itemMetadata.mime_type ?? ''
    const ext = item.name.split('.').pop()?.toLowerCase() ?? ''
    const language = EXT_LANGUAGE[ext]
    const isHtmlPage = ext === 'html' || ext === 'htm' || ext === 'xhtml'

    let previewData

    if (isHtmlPage) {
      const textData = await fetchTextContent(item.path)
      if (textData?.kind === 'tooLarge') {
        previewData = { ...textData, language: 'html' }
      } else {
        previewData = { kind: 'html', text: textData?.text ?? '', language: 'html' }
      }
    } else if (language) {
      const textData = await fetchTextContent(item.path)
      if (textData?.kind === 'tooLarge') {
        previewData = { ...textData, language }
      } else {
        previewData = textData ? { kind: 'text', text: textData.text, language } : { kind: 'binary' }
      }
    } else if (mime.startsWith('image/')) {
      previewData = { kind: 'image' }
    } else if (mime.startsWith('video/')) {
      previewData = { kind: 'video' }
    } else if (mime.startsWith('audio/')) {
      previewData = { kind: 'audio' }
    } else if (mime.startsWith('text/') || TEXT_APP_MIMES.has(mime)) {
      const lang = mime.split('/')[1]?.replace(/^x-/, '') || 'plaintext'
      const textData = await fetchTextContent(item.path)
      if (textData?.kind === 'tooLarge') {
        previewData = { ...textData, language: lang }
      } else {
        previewData = textData ? { kind: 'text', text: textData.text, language: lang } : { kind: 'binary' }
      }
    } else {
      previewData = { kind: 'binary' }
    }

    // Don't cache tooLarge — allow re-check if user changes the limit
    if (previewData.kind !== 'tooLarge') {
      previewCache.set(item.path, { preview: previewData, metadata: itemMetadata })
    }
    previews.value[item.path] = previewData
  } catch {
    previews.value[item.path] = { kind: 'error' }
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
