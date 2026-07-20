<template>
  <DetailsRows
    :selected="!!selectedPath"
    :applies="supportsXMP"
    na-message="XMP data is only available for image, video, and audio files."
    :rows="rows"
    :loading="loading"
    :error="error"
    empty-message="No XMP metadata found in this file."
  />
</template>

<script setup>
import { ref, computed, watch } from 'vue'
import DetailsRows from './DetailsRows.vue'
import { API_BASE, API_V } from '@workbench/plugin-sdk'

const IMAGE_EXTS = new Set(['jpg','jpeg','png','tif','tiff','webp','heic','heif','avif','bmp','gif','svg'])
const VIDEO_EXTS = new Set(['mp4','webm','mkv','avi','mov','m4v','flv','wmv','ts','mpeg','mpg','m2ts'])
const AUDIO_EXTS = new Set(['mp3','m4a','flac','ogg','opus','aac','wav','aiff','wma'])

const props = defineProps({
  selectedPath: { type: String, default: '' },
})

const xmp     = ref(null)
const loading = ref(false)
const error   = ref(false)

const ext         = computed(() => props.selectedPath?.split('.').pop()?.toLowerCase() ?? '')
const supportsXMP = computed(() =>
  IMAGE_EXTS.has(ext.value) || VIDEO_EXTS.has(ext.value) || AUDIO_EXTS.has(ext.value)
)

const FIELDS = [
  { key: 'Title',       label: 'Title' },
  { key: 'Creator',     label: 'Creator' },
  { key: 'Description', label: 'Description' },
  { key: 'Subject',     label: 'Keywords' },
  { key: 'Rights',      label: 'Rights' },
  { key: 'Rating',      label: 'Rating' },
  { key: 'Label',       label: 'Label' },
  { key: 'Marked',      label: 'Marked' },
  { key: 'CreateDate',  label: 'Created' },
  { key: 'ModifyDate',  label: 'Modified' },
  { key: 'Credit',      label: 'Credit' },
  { key: 'Source',      label: 'Source' },
]

const rows = computed(() => {
  const d = xmp.value
  if (!d) return []
  return FIELDS.map(f => ({ key: f.key, label: f.label, value: d[f.key] ?? null }))
})

watch(() => [props.selectedPath, supportsXMP.value], async ([path, supported]) => {
  xmp.value   = null
  error.value = false
  if (!path || !supported) return

  loading.value = true
  try {
    const r = await fetch(`${API_BASE}/_api/${API_V}/media/exif?path=${encodeURIComponent(path)}`)
    if (r.ok) xmp.value = await r.json()
    else      error.value = true
  } catch { error.value = true }
  finally   { loading.value = false }
}, { immediate: true })
</script>
