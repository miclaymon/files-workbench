<template>
  <DetailsRows
    :selected="!!selectedPath"
    :applies="supportsIPTC"
    na-message="IPTC data is only available for image files."
    :rows="rows"
    :loading="loading"
    :error="error"
    empty-message="No IPTC metadata found in this file."
  />
</template>

<script setup>
import { ref, computed, watch } from 'vue'
import DetailsRows from './DetailsRows.vue'
import { API_BASE, API_V } from '@fw/sdk'

const IMAGE_EXTS = new Set(['jpg','jpeg','tif','tiff','png','webp','psd','eps','ai'])

const props = defineProps({
  selectedPath: { type: String, default: '' },
})

const iptc    = ref(null)
const loading = ref(false)
const error   = ref(false)

const ext          = computed(() => props.selectedPath?.split('.').pop()?.toLowerCase() ?? '')
const supportsIPTC = computed(() => IMAGE_EXTS.has(ext.value))

const FIELDS = [
  { key: 'ObjectName',                  label: 'Headline' },
  { key: 'Caption-Abstract',            label: 'Caption' },
  { key: 'Keywords',                    label: 'Keywords' },
  { key: 'By-line',                     label: 'Creator' },
  { key: 'By-lineTitle',                label: 'Title' },
  { key: 'Credit',                      label: 'Credit' },
  { key: 'Source',                      label: 'Source' },
  { key: 'CopyrightNotice',             label: 'Copyright' },
  { key: 'DateCreated',                 label: 'Date Created' },
  { key: 'TimeCreated',                 label: 'Time Created' },
  { key: 'City',                        label: 'City' },
  { key: 'Province-State',              label: 'State/Province' },
  { key: 'Country-PrimaryLocationName', label: 'Country' },
  { key: 'Contact',                     label: 'Contact' },
  { key: 'SpecialInstructions',         label: 'Instructions' },
  { key: 'Category',                    label: 'Category' },
]

const rows = computed(() => {
  const d = iptc.value
  if (!d) return []
  return FIELDS.map(f => ({ key: f.key, label: f.label, value: d[f.key] ?? null }))
})

watch(() => [props.selectedPath, supportsIPTC.value], async ([path, supported]) => {
  iptc.value  = null
  error.value = false
  if (!path || !supported) return

  loading.value = true
  try {
    const r = await fetch(`${API_BASE}/_api/${API_V}/media/exif?path=${encodeURIComponent(path)}`)
    if (r.ok) iptc.value = await r.json()
    else      error.value = true
  } catch { error.value = true }
  finally   { loading.value = false }
}, { immediate: true })
</script>
