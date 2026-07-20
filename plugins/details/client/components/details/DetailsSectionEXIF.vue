<template>
  <DetailsRows
    :selected="!!selectedPath"
    :applies="isImage"
    na-message="EXIF data is only available for image files."
    :rows="rows"
    :loading="loading"
    :error="error"
    empty-message="No EXIF data found in this file."
    :shimmer-count="5"
  />
</template>

<script setup>
import { ref, computed, watch } from 'vue'
import DetailsRows from './DetailsRows.vue'
import { API_BASE, API_V } from '@workbench/plugin-sdk'

const IMAGE_EXTS = new Set(['jpg','jpeg','png','tif','tiff','webp','heic','heif','avif','bmp','gif'])

const props = defineProps({
  selectedPath: { type: String, default: '' },
})

const exif    = ref(null)
const loading = ref(false)
const error   = ref(false)

const ext     = computed(() => props.selectedPath?.split('.').pop()?.toLowerCase() ?? '')
const isImage = computed(() => IMAGE_EXTS.has(ext.value))

const FIELDS = [
  { key: 'Make',                    label: 'Make' },
  { key: 'Model',                   label: 'Model' },
  { key: 'LensModel',               label: 'Lens' },
  { key: 'DateTimeOriginal',        label: 'Date Taken' },
  { key: 'ISO',                     label: 'ISO' },
  { key: 'FNumber',                 label: 'Aperture' },
  { key: 'ExposureTime',            label: 'Shutter' },
  { key: 'FocalLength',             label: 'Focal Length' },
  { key: 'FocalLengthIn35mmFormat', label: '35mm Equiv.' },
  { key: 'Flash',                   label: 'Flash' },
  { key: 'WhiteBalance',            label: 'White Balance' },
  { key: 'ExposureProgram',         label: 'Program' },
  { key: 'MeteringMode',            label: 'Metering' },
  { key: 'ColorSpace',              label: 'Color Space' },
  { key: 'GPSLatitude',             label: 'GPS Lat' },
  { key: 'GPSLongitude',            label: 'GPS Lng' },
  { key: 'GPSAltitude',             label: 'GPS Alt' },
]

const rows = computed(() => {
  const d = exif.value
  if (!d) return []
  return FIELDS.map(f => ({ key: f.key, label: f.label, value: d[f.key] ?? null }))
})

watch(() => [props.selectedPath, isImage.value], async ([path, image]) => {
  exif.value  = null
  error.value = false
  if (!path || !image) return

  loading.value = true
  try {
    const r = await fetch(`${API_BASE}/_api/${API_V}/media/exif?path=${encodeURIComponent(path)}`)
    if (r.ok) exif.value = await r.json()
    else      error.value = true
  } catch { error.value = true }
  finally   { loading.value = false }
}, { immediate: true })
</script>
