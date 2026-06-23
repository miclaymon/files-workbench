<template>
  <div class="gg">
    <div class="gg-head">
      <div class="gg-col-graph">Graph</div>
      <div class="gg-col-desc">Description</div>
      <div class="gg-col-date">Date</div>
      <div class="gg-col-author">Author</div>
      <div class="gg-col-hash">Commit</div>
    </div>
    <div v-if="!repo" class="gg-empty">This repository is no longer available.</div>
    <div v-else class="gg-body">
      <div class="gg-repo-line">{{ repo.name }} · {{ repo.branch }}</div>
      <div v-for="(c, i) in log" :key="c.hash" class="gg-row">
        <div class="gg-col-graph">
          <svg class="gg-graph" width="16" :height="rowHeight" viewBox="0 0 16 32" preserveAspectRatio="none">
            <line v-if="i > 0" x1="8" y1="0" x2="8" y2="16" stroke="var(--accent, #0e639c)" stroke-width="2" />
            <line v-if="i < log.length - 1" x1="8" y1="16" x2="8" y2="32" stroke="var(--accent, #0e639c)" stroke-width="2" />
            <circle cx="8" cy="16" r="4" fill="var(--accent, #0e639c)" stroke="var(--panel, #1e1e1e)" stroke-width="2" />
          </svg>
        </div>
        <div class="gg-col-desc">
          <span v-for="r in c.refs" :key="r" class="gg-ref">{{ r }}</span>
          <span class="gg-subject">{{ c.subject }}</span>
        </div>
        <div class="gg-col-date">{{ c.date }}</div>
        <div class="gg-col-author">{{ c.author }}</div>
        <div class="gg-col-hash">{{ c.hash.slice(0, 7) }}</div>
      </div>
    </div>
  </div>
</template>

<script setup>
import { computed } from 'vue'
import { useGitData } from '../git-data.js'

// The Git Graph editor tab: the commit log as a table with a simple single-lane
// graph gutter. Its repo is PINNED at open time (passed as the tab's `repoId`),
// independent of the sidebar's selected repo — so two repos open two tabs that
// each keep their own context for the tab's lifetime.
const props = defineProps({
  repoId: { type: String, default: null },
})

const { repoById, repos } = useGitData()
const repo = computed(() => (props.repoId ? repoById(props.repoId) : repos.value[0] ?? null))
const log  = computed(() => repo.value?.log ?? [])
const rowHeight = 32
</script>

<style scoped>
.gg {
  display: flex;
  flex-direction: column;
  height: 100%;
  background: var(--panel, #1e1e1e);
  color: var(--text, #ccc);
  font-size: 13px;
  overflow: hidden;
}

.gg-head, .gg-row {
  display: grid;
  grid-template-columns: 60px 1fr 120px 160px 90px;
  align-items: center;
}

.gg-head {
  height: 28px;
  border-bottom: 1px solid var(--border, #454545);
  flex-shrink: 0;
  font-size: 11px;
  font-weight: 600;
  text-transform: uppercase;
  letter-spacing: 0.04em;
  color: var(--text-muted, #888);
}
.gg-head > div { padding: 0 10px; }

.gg-empty { padding: 24px; color: var(--text-muted, #888); font-size: 13px; }
.gg-body { flex: 1; overflow-y: auto; }
.gg-repo-line {
  padding: 6px 12px;
  font-size: 12px;
  color: var(--text-muted, #8c8c8c);
  border-bottom: 1px solid var(--border, #454545);
}

.gg-row { height: 32px; }
.gg-row:hover { background: var(--hover, rgba(255,255,255,0.05)); }
.gg-row > div { padding: 0 10px; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }

.gg-col-graph { display: flex; align-items: center; justify-content: center; padding: 0 !important; }
.gg-graph { display: block; }

.gg-col-desc { display: flex; align-items: center; gap: 6px; min-width: 0; }
.gg-subject { overflow: hidden; text-overflow: ellipsis; }
.gg-ref {
  flex-shrink: 0;
  background: var(--accent, #0e639c);
  color: #fff;
  font-size: 11px;
  border-radius: 9px;
  padding: 0 8px;
  line-height: 16px;
}

.gg-col-date, .gg-col-author { color: var(--text-muted, #aaa); font-size: 12px; }
.gg-col-hash { font-family: monospace; color: var(--text-muted, #aaa); font-size: 12px; }
</style>
