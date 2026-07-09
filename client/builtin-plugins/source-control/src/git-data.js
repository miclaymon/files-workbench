import { ref, computed } from 'vue'

// Source Control state, fetched through the plugin's permission-scoped `api.scm`
// (the Workbench broker) — the plugin never touches the filesystem directly. Repos
// are detected from the open editor *directory* tabs; selecting one drives the
// Changes and Graph sections. Module-level singleton so the sections and status
// widget share one source; the plugin wires `api` via initGitData() and refreshes
// when the open tabs change.

const repos = ref([])
const selectedRepoId = ref(null)
const selectedRepo = computed(() => repos.value.find(r => r.id === selectedRepoId.value) ?? null)
// How the Changes section presents files: 'tree' (folders) or 'list' (flat paths).
const changesViewMode = ref('list')
let _api = null

async function refresh() {
  if (!_api?.scm) return
  const dirPaths = _api.editor.tabs()
    .filter(t => t.kind === 'dir' && t.path)
    .map(t => t.path)
  const found = await _api.scm.detectRepos(dirPaths)
  repos.value = await Promise.all(found.map(async r => ({ ...r, ...(await _api.scm.repoInfo(r.root)) })))
  if (!repos.value.some(r => r.id === selectedRepoId.value)) {
    selectedRepoId.value = repos.value[0]?.id ?? null
  }
}

async function commitSelected(message) {
  const repo = selectedRepo.value
  if (!repo || !_api?.scm?.commit) return
  await _api.scm.commit(repo.root, message)
  await refresh()
}

async function initRepoHere() {
  const dir = _api?.editor.tabs().find(t => t.kind === 'dir' && t.path)
  if (!dir || !_api?.scm?.init) return
  await _api.scm.init(dir.path)
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
