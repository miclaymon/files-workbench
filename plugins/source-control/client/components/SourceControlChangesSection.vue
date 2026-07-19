<template>
  <div class="changes">
    <div v-if="!repo" class="changes-hint">Select a repository to see its changes.</div>

    <template v-else>
      <div class="changes-commit">
        <textarea
          v-model="message"
          class="changes-message"
          rows="1"
          :placeholder="`Message (Ctrl+Enter to commit on &quot;${repo.branch}&quot;)`"
          @keydown.ctrl.enter.prevent="commit"
        />
        <button class="changes-commit-btn" :disabled="!repo.staged.length" @click="commit">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor"><path :d="mdiCheck" /></svg>
          Commit
        </button>
      </div>

      <div v-if="repo.staged.length" class="changes-group">
        <button class="changes-group-head" @click="stagedCollapsed = !stagedCollapsed">
          <span class="changes-twist" :class="{ open: !stagedCollapsed }">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor"><path d="M8.59 16.59L13.17 12 8.59 7.41 10 6l6 6-6 6-1.41-1.41z" /></svg>
          </span>
          <span class="changes-group-label">Staged Changes</span>
          <span class="changes-count">{{ repo.staged.length }}</span>
        </button>
        <SourceControlFileTree v-show="!stagedCollapsed" :nodes="stagedNodes" :expanded="stagedExpanded" :indentScale="indentScale" @toggleExpand="stagedToggle" />
      </div>

      <div v-if="repo.changes.length" class="changes-group">
        <button class="changes-group-head" @click="changesCollapsed = !changesCollapsed">
          <span class="changes-twist" :class="{ open: !changesCollapsed }">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor"><path d="M8.59 16.59L13.17 12 8.59 7.41 10 6l6 6-6 6-1.41-1.41z" /></svg>
          </span>
          <span class="changes-group-label">Changes</span>
          <span class="changes-count">{{ repo.changes.length }}</span>
        </button>
        <SourceControlFileTree v-show="!changesCollapsed" :nodes="changesNodes" :expanded="changesExpanded" :indentScale="indentScale" @toggleExpand="changesToggle" />
      </div>

      <div v-if="!repo.staged.length && !repo.changes.length" class="changes-hint">No changes.</div>
    </template>
  </div>
</template>

<script setup>
import { ref, computed, inject } from 'vue'
import { mdiCheck } from '@mdi/js'
import { useGitData } from '../git-data.js'
import { useDirectoryFileTree } from '@fw/sdk'
import SourceControlFileTree from './SourceControlFileTree.vue'

// Working tree of the selected repo: commit box + collapsible Staged/Changes
// groups. Each group renders the changed files as a tree or a flat list (toggled
// by the "Changes" section's view-mode action, shared via git-data), reusing the
// generic useDirectoryFileTree builder + the icon pack.
const { selectedRepo: repo, commitSelected, changesViewMode } = useGitData()
const message = ref('')

// Match the Explorer tree's indentation by using the same preference.
const ctx = inject('viewCtx', null)
const indentScale = computed(() => ctx?.prefs?.explorer?.indentScale ?? 1.0)
const stagedCollapsed = ref(false)
const changesCollapsed = ref(false)

const { nodes: stagedNodes, expanded: stagedExpanded, toggleExpand: stagedToggle } =
  useDirectoryFileTree({ items: () => repo.value?.staged ?? [], mode: changesViewMode })
const { nodes: changesNodes, expanded: changesExpanded, toggleExpand: changesToggle } =
  useDirectoryFileTree({ items: () => repo.value?.changes ?? [], mode: changesViewMode })

async function commit() {
  if (!repo.value?.staged.length) return
  await commitSelected(message.value)   // → backend commit (control server), then re-detect
  message.value = ''
}
</script>

<style scoped>
.changes { display: flex; flex-direction: column; padding: 4px 0; user-select: none; }
.changes-hint { padding: 10px 12px; font-size: 12px; color: var(--text-muted, #8c8c8c); }

.changes-commit { padding: 0 8px 8px; display: flex; flex-direction: column; gap: 6px; }
.changes-message {
  background: var(--input-background, #3c3c3c);
  border: 1px solid var(--border, #454545);
  color: var(--text, #ccc);
  font: inherit; font-size: 12px; padding: 5px 8px; resize: vertical; outline: none; min-height: 28px;
}
.changes-message:focus { border-color: var(--accent, #0078d4); }
.changes-commit-btn {
  display: flex; align-items: center; justify-content: center; gap: 6px;
  background: var(--accent, #0e639c); color: #fff; border: none; padding: 5px 10px; font-size: 12px; cursor: pointer;
}
.changes-commit-btn:hover:not(:disabled) { background: var(--accent-hover, #1177bb); }
.changes-commit-btn:disabled { opacity: 0.5; cursor: default; }

.changes-group { display: flex; flex-direction: column; }
.changes-group-head {
  display: flex; align-items: center; gap: 4px;
  width: 100%; border: none; background: transparent; cursor: pointer;
  padding: 4px 8px; font-size: 11px; font-weight: 600; text-transform: uppercase;
  letter-spacing: 0.04em; color: var(--text-muted, #8c8c8c); text-align: left;
}
.changes-group-head:hover { color: var(--text, #ccc); }
.changes-group-label { flex: 1; }
.changes-twist {
  display: inline-flex; align-items: center; justify-content: center;
  width: 16px; flex-shrink: 0; opacity: 0.7;
  transition: transform 0.12s ease;
}
.changes-twist.open { transform: rotate(90deg); }
.changes-count {
  background: var(--badge-bg, rgba(255,255,255,0.12)); color: var(--text, #ccc);
  border-radius: 9px; padding: 0 6px; font-size: 10px; font-weight: 600;
}

/* Indent guides reveal on hover, like the Explorer tree. */
.changes-group:hover :deep(.ig) { background: rgba(255, 255, 255, 0.1); }
.changes-group:hover :deep(.sft-item:hover .ig:last-of-type) { background: rgba(255, 255, 255, 0.32); }
</style>
