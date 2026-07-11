import { ref, computed } from 'vue'

// Source Control state, fetched through the plugin's own sandboxed WASM backend via
// `api.server.call(method, …)` (see server/git.plugin.js). The plugin never touches
// git or the filesystem directly — the backend runs it behind permissioned host
// functions. Repos are detected from the open editor *directory* tabs; selecting one
// drives the Changes and Graph sections. Module-level singleton so the sections and
// status widget share one source; the plugin wires `api` via initGitData() and
// refreshes when the open tabs change.

const repos = ref([])
const selectedRepoId = ref(null)
const selectedRepo = computed(() => repos.value.find(r => r.id === selectedRepoId.value) ?? null)
// How the Changes section presents files: 'tree' (folders) or 'list' (flat paths).
const changesViewMode = ref('list')
let _api = null

async function refresh() {
  if (!_api?.server) return
  const dirPaths = _api.editor.tabs()
    .filter(t => t.kind === 'dir' && t.path)
    .map(t => t.path)
  try {
    const found = await _api.server.call('detect', { paths: dirPaths })
    repos.value = await Promise.all(
      (found ?? []).map(async r => ({ ...r, ...(await _api.server.call('info', { root: r.root })) })),
    )
  } catch (e) {
    // Backend unavailable (WASM not built, git missing, …) — degrade to no repos.
    _api.log?.('scm refresh failed:', e?.message ?? e)
    repos.value = []
  }
  if (!repos.value.some(r => r.id === selectedRepoId.value)) {
    selectedRepoId.value = repos.value[0]?.id ?? null
  }
}

async function commitSelected(message) {
  const repo = selectedRepo.value
  if (!repo || !_api?.server) return
  await _api.server.call('commit', { root: repo.root, message }, { write: true })
  await refresh()
}

async function initRepoHere() {
  const dir = _api?.editor.tabs().find(t => t.kind === 'dir' && t.path)
  if (!dir || !_api?.server) return
  await _api.server.call('init', { path: dir.path }, { write: true })
  await refresh()
}

export function initGitData(api) {
  _api = api
  // Seed the runtime view mode from the contributed preference (its default until
  // the user changes it); the section action still overrides it per session.
  const pref = api.preferences?.get?.('sourceControl.changesViewMode')
  if (pref === 'tree' || pref === 'list') changesViewMode.value = pref
  refresh()
}

export function useGitData() {
  return {
    repos,
    selectedRepoId,
    selectedRepo,
    changesViewMode,
    selectRepo: (id) => { selectedRepoId.value = id },
    repoById: (id) => repos.value.find(r => r.id === id) ?? null,
    toggleChangesView: () => { changesViewMode.value = changesViewMode.value === 'tree' ? 'list' : 'tree' },
    refresh,
    commitSelected,
    initRepoHere,
  }
}
