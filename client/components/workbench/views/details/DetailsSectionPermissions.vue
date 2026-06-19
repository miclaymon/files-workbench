<template>
  <DetailsRows
    :selected="!!selectedPath"
    :rows="rows"
    :loading="loading"
    :error="error"
    empty-message="No permission data available."
    :style="{ '--dr-label-width': '52px' }"
  />
</template>

<script setup>
import { ref, computed, watch } from 'vue'
import DetailsRows from './DetailsRows.vue'
import { API_BASE, API_V } from '~/lib/api-config.js'

const props = defineProps({
  selectedPath: { type: String, default: '' },
  details:      { type: Object, default: null },
})

const perms   = ref(null)
const loading = ref(false)
const error   = ref(false)

const rows = computed(() => {
  const p = perms.value
  if (!p) return []
  const out = [
    { key: 'mode',  label: 'Mode',  value: p.mode  ?? null },
    { key: 'octal', label: 'Octal', value: p.octal ?? null },
  ]
  if (p.owner != null) out.push({ key: 'owner', label: 'Owner', value: p.uid != null ? `${p.owner} (${p.uid})` : p.owner })
  else if (p.uid != null) out.push({ key: 'uid', label: 'UID', value: String(p.uid) })
  if (p.group != null) out.push({ key: 'group', label: 'Group', value: p.gid != null ? `${p.group} (${p.gid})` : p.group })
  else if (p.gid != null) out.push({ key: 'gid', label: 'GID', value: String(p.gid) })
  return out
})

watch(() => props.selectedPath, async (path) => {
  perms.value = null
  error.value = false
  if (!path) return

  loading.value = true
  try {
    const r = await fetch(`${API_BASE}/_api/${API_V}/fs/permissions?path=${encodeURIComponent(path)}`)
    if (r.ok) perms.value = await r.json()
    else      error.value = true
  } catch { error.value = true }
  finally   { loading.value = false }
}, { immediate: true })
</script>
