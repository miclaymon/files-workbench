<template>
  <div class="repos">
    <div v-if="!repos.length" class="repos-empty">
      <p class="repos-empty-msg">No Git repository in the open editors.</p>
      <button class="repos-init" @click="initRepo">
        <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor"><path :d="mdiPlus" /></svg>
        Initialize Repository
      </button>
    </div>

    <div
      v-for="r in repos"
      :key="r.id"
      class="repos-item"
      :class="{ 'repos-item--active': r.id === selectedRepoId }"
      :title="r.root"
      @click="selectRepo(r.id)"
    >
      <svg width="15" height="15" viewBox="0 0 24 24" fill="currentColor"><path :d="mdiSourceRepository" /></svg>
      <span class="repos-name">{{ r.name }}</span>
      <span class="repos-branch">
        <svg width="11" height="11" viewBox="0 0 24 24" fill="currentColor"><path :d="mdiSourceBranch" /></svg>{{ r.branch }}
      </span>
    </div>
  </div>
</template>

<script setup>
import { mdiSourceRepository, mdiSourceBranch, mdiPlus } from '@mdi/js'
import { useGitData } from '../git-data.js'

// Lists the git repos found across the open editors. Clicking selects the repo
// that the Changes and Graph sections render. Empty state offers to initialise one.
const { repos, selectedRepoId, selectRepo, initRepoHere } = useGitData()

function initRepo() { initRepoHere() }   // → backend init for the open directory, then re-detect
</script>

<style scoped>
.repos { display: flex; flex-direction: column; padding: 2px 0; user-select: none; }

.repos-empty { padding: 10px 12px; display: flex; flex-direction: column; gap: 8px; align-items: flex-start; }
.repos-empty-msg { margin: 0; font-size: 12px; color: var(--text-muted, #8c8c8c); }
.repos-init {
  display: flex; align-items: center; gap: 6px;
  background: var(--accent, #0e639c); color: #fff; border: none;
  padding: 4px 10px; font-size: 12px; cursor: pointer;
}
.repos-init:hover { background: var(--accent-hover, #1177bb); }

.repos-item {
  display: flex; align-items: center; gap: 6px;
  padding: 3px 12px; font-size: 13px; color: var(--text, #ccc);
  cursor: pointer; white-space: nowrap;
}
.repos-item:hover { background: var(--hover, rgba(255,255,255,0.06)); }
.repos-item--active { background: var(--active-bg, rgba(255,255,255,0.10)); }
.repos-name { flex: 1; overflow: hidden; text-overflow: ellipsis; }
.repos-branch { display: flex; align-items: center; gap: 3px; font-size: 11px; color: var(--text-muted, #8c8c8c); }
</style>
