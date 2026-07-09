<template>
  <div class="dir-preview">
    <div v-if="loading" class="dp-state">Loading…</div>
    <div v-else-if="error" class="dp-state">{{ error }}</div>
    <div v-else-if="!total" class="dp-state">Empty folder</div>
    <template v-else>
      <div class="dp-header">{{ total }} item{{ total === 1 ? '' : 's' }}</div>
      <ul class="dp-list">
        <li v-for="it in items" :key="it.path" class="dp-row" :class="{ 'dp-row--dir': isDir(it) }">
          <svg class="dp-icon" viewBox="0 0 24 24" fill="currentColor"><path :d="iconFor(it)" /></svg>
          <span class="dp-name">{{ it.name }}</span>
        </li>
      </ul>
      <div v-if="total > items.length" class="dp-more">+{{ total - items.length }} more…</div>
    </template>
  </div>
</template>

<script setup>
import { ref, watch } from 'vue'
import { mdiFolder, mdiFileOutline, mdiZipBox } from '@mdi/js'
import { fsListDir } from '~/lib/fs-api.js'

// A directory's peek: a compact listing of its children (folders first, then files —
// server order), shown when the hold-Space peek targets a directory. Fetches a single
// capped page (the peek only shows the top; `total` gives the real count for "+N more").
const props = defineProps({ item: { type: Object, default: null } })

const MAX = 500

const items   = ref([])
const total   = ref(0)
const loading = ref(false)
const error   = ref('')

const isDir = (it) => it.kind === 'dir' || it.kind === 'drive'
function iconFor(it) {
  if (isDir(it)) return mdiFolder
  if (it.kind === 'archive') return mdiZipBox
  return mdiFileOutline
}

let _gen = 0
async function load(path) {
  const gen = ++_gen
  if (!path) { items.value = []; total.value = 0; return }
  loading.value = true; error.value = ''
  try {
    const res = await fsListDir(path, { includeMetadata: false, showHidden: false, limit: MAX })
    if (gen !== _gen) return
    items.value = res.items ?? []
    total.value = res.total ?? items.value.length
  } catch {
    if (gen !== _gen) return
    error.value = 'Could not read folder'
    items.value = []; total.value = 0
  } finally {
    if (gen === _gen) loading.value = false
  }
}

watch(() => props.item?.path, (p) => load(p), { immediate: true })
</script>

<style scoped>
.dir-preview { height: 100%; display: flex; flex-direction: column; overflow: hidden; }
.dp-state { padding: 24px; text-align: center; color: var(--text-muted); font-size: 13px; }
.dp-header {
  padding: 8px 14px;
  font-size: 12px;
  color: var(--text-muted);
  border-bottom: 1px solid var(--border);
  flex-shrink: 0;
}
.dp-list { list-style: none; margin: 0; padding: 4px 0; overflow: auto; flex: 1; min-height: 0; }
.dp-row {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 3px 14px;
  font-size: 13px;
  color: var(--text);
  white-space: nowrap;
}
.dp-icon { width: 16px; height: 16px; flex-shrink: 0; color: var(--text-muted); }
.dp-row--dir .dp-icon { color: var(--accent, #4aa3ff); }
.dp-name { overflow: hidden; text-overflow: ellipsis; }
.dp-more {
  padding: 6px 14px;
  font-size: 12px;
  color: var(--text-muted);
  border-top: 1px solid var(--border);
  flex-shrink: 0;
}
</style>
