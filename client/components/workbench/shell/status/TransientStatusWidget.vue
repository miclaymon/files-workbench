<template>
  <div v-if="show" class="status-bar-item">{{ text }}</div>
</template>

<script setup>
// Core activity's transient status line (e.g. "Opened file.txt"). Shown only when
// the active tab isn't a directory (the Explorer widget owns that case).
import { computed, inject } from 'vue'

const ctx = inject('viewCtx', null)

const activeTab = computed(() => ctx?.activeTab?.value ?? null)
const text      = computed(() => ctx?.status?.value?.left ?? '')
const show      = computed(() => activeTab.value?.kind !== 'dir' && !!text.value)
</script>

<style scoped>
.status-bar-item { white-space: nowrap; overflow: hidden; text-overflow: ellipsis; padding: 0 6px; border-radius: 3px; }
.status-bar-item:hover { background: rgba(255,255,255,0.12); }
</style>
