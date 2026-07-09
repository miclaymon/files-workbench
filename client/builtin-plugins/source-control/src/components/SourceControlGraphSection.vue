<template>
  <div class="gsec">
    <div v-if="!repo" class="gsec-hint">Select a repository to see its history.</div>
    <div
      v-for="c in (repo?.log ?? [])"
      :key="c.hash"
      class="gsec-row"
      :title="`${c.subject}\n${c.author} · ${c.date}`"
    >
      <span class="gsec-dot" />
      <span class="gsec-subject">
        <span v-for="r in c.refs" :key="r" class="gsec-ref">{{ r }}</span>
        {{ c.subject }}
      </span>
      <span class="gsec-hash">{{ c.hash.slice(0, 7) }}</span>
    </div>
  </div>
</template>

<script setup>
import { useGitData } from '../git-data.js'

// A compact commit list for the selected repo (the in-sidebar counterpart to the
// full Git Graph editor tab).
const { selectedRepo: repo } = useGitData()
</script>

<style scoped>
.gsec { display: flex; flex-direction: column; padding: 2px 0; user-select: none; }
.gsec-hint { padding: 10px 12px; font-size: 12px; color: var(--text-muted, #8c8c8c); }

.gsec-row {
  display: flex; align-items: center; gap: 8px;
  padding: 3px 12px; font-size: 12px; color: var(--text, #ccc); white-space: nowrap;
}
.gsec-row:hover { background: var(--hover, rgba(255,255,255,0.06)); }
.gsec-dot { width: 8px; height: 8px; border-radius: 50%; background: var(--accent, #0e639c); flex-shrink: 0; }
.gsec-subject { flex: 1; min-width: 0; overflow: hidden; text-overflow: ellipsis; display: flex; align-items: center; gap: 5px; }
.gsec-ref { flex-shrink: 0; background: var(--accent, #0e639c); color: #fff; font-size: 10px; border-radius: 8px; padding: 0 6px; line-height: 15px; }
.gsec-hash { font-family: monospace; font-size: 11px; color: var(--text-muted, #8c8c8c); flex-shrink: 0; }
</style>
