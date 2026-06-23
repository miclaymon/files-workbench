<template>
  <div v-if="repo" class="scb" :title="`On branch ${repo.branch} (${repo.name})`" @click="openGraph">
    <svg width="13" height="13" viewBox="0 0 24 24" fill="currentColor"><path :d="mdiSourceBranch" /></svg>
    <span class="scb-name">{{ repo.branch }}</span>
    <span v-if="repo.behind" class="scb-sync">↓{{ repo.behind }}</span>
    <span v-if="repo.ahead" class="scb-sync">↑{{ repo.ahead }}</span>
  </div>
</template>

<script setup>
import { inject } from 'vue'
import { mdiSourceBranch } from '@mdi/js'
import { useGitData } from '../git-data.js'

// Status-bar widget: the selected repo's branch + ahead/behind. Self-gates when no
// repo is selected. Clicking opens the Git Graph (via the registered command,
// resolved off the host the status bar provides as viewCtx).
const { selectedRepo: repo } = useGitData()
const ctx = inject('viewCtx', null)

function openGraph() { ctx?.facade?.commands?.execute('sourceControl.viewGitGraph') }
</script>

<style scoped>
.scb {
  display: flex;
  align-items: center;
  gap: 4px;
  cursor: pointer;
  color: var(--text-muted, #ccc);
  font-size: 12px;
  user-select: none;
}
.scb:hover { color: var(--text, #fff); }
.scb-name { white-space: nowrap; }
.scb-sync { opacity: 0.85; }
</style>
