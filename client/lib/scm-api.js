import { API_BASE, CONTROL_BASE, API_V } from './api-config.js'

// ── SCM (git) broker ──────────────────────────────────────────────────────────
//
// The Workbench-side broker for source-control data. Plugins never call this
// directly or touch the filesystem — they receive a permission-scoped subset of
// it as `api.scm` (granted only when the manifest declares scm:read / scm:write,
// see usePluginApi.js). Reads go to the data server, writes to the control server.
//
// Until the Go `/scm` endpoints are live, every call falls back to mock data so
// the UI works; the mock is keyed off whether any directory paths were supplied,
// to approximate "repos are found from the open editors".
//
// Go endpoints (to implement in server/v2/scm.go):
//   POST {data}/scm/detect   { paths:[], relations? } → [{ id, name, root }]
//   GET  {data}/scm/info?root=…                       → { branch, ahead, behind, staged[], changes[], log[] }
//   POST {control}/scm/commit { root, message }       → { ok }
//   POST {control}/scm/init   { path }                → { ok, root }

const DATA_SCM    = `${API_BASE}/_api/${API_V}/scm`
const CONTROL_SCM = `${CONTROL_BASE}/_api/${API_V}/scm`

async function req(url, { method = 'GET', body } = {}) {
  const res = await fetch(url, {
    method,
    headers: body ? { 'Content-Type': 'application/json' } : undefined,
    body: body ? JSON.stringify(body) : undefined,
  })
  if (!res.ok) throw new Error(`scm ${method} ${url} → ${res.status}`)
  return res.json()
}

// ── Mock fallback ─────────────────────────────────────────────────────────────
const MOCK_REPOS = [
  {
    id: 'files-workbench2', name: 'files-workbench2', root: '/home/mic/dev/projects/files-workbench2',
    branch: 'feat/activity-api', ahead: 1, behind: 0,
    staged: [
      { path: 'client/components/workbench/Workbench.vue', status: 'M' },
      { path: 'client/components/workbench/ui/ModalHost.vue', status: 'A' },
    ],
    changes: [
      { path: 'client/composables/useViewRegistry.js', status: 'M' },
      { path: 'client/lib/scm-api.js', status: 'U' },
      { path: 'client/builtin-plugins/source-control/plugin.js', status: 'U' },
    ],
    log: [
      { hash: 'fa665326', subject: 'feat: command palette modes + live keyboard-shortcuts viewer + reusable modal chrome', author: 'Michael Laymon', date: '2026-06-22', refs: ['feat/activity-api'] },
      { hash: 'f206217b', subject: 'feat: contribution points + public facade', author: 'Michael Laymon', date: '2026-06-22', refs: [] },
      { hash: 'd819f197', subject: 'feat: Activity API layer with broker, pub/sub, and capability-driven collaboration', author: 'Michael Laymon', date: '2026-06-21', refs: [] },
      { hash: 'a538fb56', subject: 'feat: notification center with job tracking + Explorer show-hidden toggle', author: 'Michael Laymon', date: '2026-06-20', refs: ['development'] },
    ],
  },
  {
    id: 'vscode-material-icon-theme', name: 'vscode-material-icon-theme',
    root: '/home/mic/dev/projects/files-workbench2/config/plugins/material-icon-theme/vscode-material-icon-theme',
    branch: 'main', ahead: 0, behind: 2,
    staged: [],
    changes: [{ path: 'dist/material-icons.json', status: 'M' }],
    log: [
      { hash: '7c1a9f0', subject: 'chore: release v5.27.0', author: 'PKief', date: '2026-06-15', refs: ['main'] },
      { hash: '2b4d8e1', subject: 'feat: add icons for new frameworks', author: 'PKief', date: '2026-06-12', refs: [] },
    ],
  },
]
const mockInfo = (root) => {
  const r = MOCK_REPOS.find(m => m.root === root) ?? MOCK_REPOS[0]
  return { branch: r.branch, ahead: r.ahead, behind: r.behind, staged: r.staged, changes: r.changes, log: r.log }
}

// ── Read (scm:read) ───────────────────────────────────────────────────────────

// Detect git repositories reachable from the given open paths (a repo as a direct
// child, direct sibling, ancestor, or ancestor's direct sibling).
export async function detectRepos(paths = [], opts = {}) {
  try {
    return await req(`${DATA_SCM}/detect`, { method: 'POST', body: { paths, ...opts } })
  } catch {
    return paths.length ? MOCK_REPOS.map(({ id, name, root }) => ({ id, name, root })) : []
  }
}

export async function repoInfo(root) {
  try {
    return await req(`${DATA_SCM}/info?root=${encodeURIComponent(root)}`)
  } catch {
    return mockInfo(root)
  }
}

// ── Write (scm:write) ─────────────────────────────────────────────────────────

export async function commit(root, message) {
  try { return await req(`${CONTROL_SCM}/commit`, { method: 'POST', body: { root, message } }) }
  catch { return { ok: true, mock: true } }
}

export async function init(path) {
  try { return await req(`${CONTROL_SCM}/init`, { method: 'POST', body: { path } }) }
  catch { return { ok: true, mock: true, root: path } }
}
