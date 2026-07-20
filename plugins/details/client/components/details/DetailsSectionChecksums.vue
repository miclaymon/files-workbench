<template>
  <DetailsRows
    :selected="!!selectedPath"
    :applies="!isDir"
    na-message="Checksums are not available for directories."
    :rows="rows"
    :loading="loading"
    :error="error"
    empty-message="No checksum data available."
    :style="{ '--dr-label-width': '52px' }"
  />
</template>

<script setup>
import { ref, computed, watch } from 'vue'
import DetailsRows from './DetailsRows.vue'
import { API_BASE, API_V } from '@workbench/plugin-sdk'

const props = defineProps({
  selectedPath: { type: String, default: '' },
  details:      { type: Object, default: null },
})

const sums    = ref(null)
const loading = ref(false)
const error   = ref(false)

const isDir = computed(() => props.details?.kind === 'dir')

const rows = computed(() => {
  const s = sums.value
  if (!s) return []
  return [
    { key: 'md5',    label: 'MD5',    value: s.md5    ?? null },
    { key: 'sha256', label: 'SHA-256', value: s.sha256 ?? null },
  ]
})

watch(() => [props.selectedPath, isDir.value], async ([path, dir]) => {
  sums.value  = null
  error.value = false
  if (!path || dir) return

  loading.value = true
  try {
    const r = await fetch(`${API_BASE}/_api/${API_V}/fs/checksums?path=${encodeURIComponent(path)}`)
    if (r.ok) sums.value = await r.json()
    else      error.value = true
  } catch { error.value = true }
  finally   { loading.value = false }
}, { immediate: true })
</script>
