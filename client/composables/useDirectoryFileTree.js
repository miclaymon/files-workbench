import { ref, computed, watch } from 'vue'

// ── Directory file tree ───────────────────────────────────────────────────────
//
// Builds the renderable node tree TreeItem/TreeList (and SourceControlFileTree)
// consume, from either:
//   • EAGER — a flat set of items, all paths known up front (e.g. git changes), or
//   • LAZY  — a set of root items plus a `loadChildren(path)` fetcher (the Explorer
//     tree), where a directory's children are fetched the first time it expands.
//
// Both modes share one model: a `childrenByPath` map and an `expanded` Set of
// `_expandKey`s, with a node's `children` built only while it is expanded — so one
// renderer covers both. Differences are confined to the data source:
//   - eager derives the whole `childrenByPath` from the flat list once and
//     auto-expands everything (a fresh changes view shows its contents);
//   - lazy seeds each root's preloaded children, fetches the rest on expand,
//     prefetches `lazyDepth` levels ahead, KEEPS a directory's children cached when
//     it collapses (re-expand is instant — hide, don't unrender), and on re-expand
//     soft-refreshes in the background, swapping in only what changed.
//
// Params (each may be a ref, getter, or plain value where noted):
//   items        → [{ path, ...meta }]  (flat list · eager) | root nodes (lazy)
//   mode         → 'tree' | 'list'
//   loadChildren → async (path) => items[]   — its presence switches on LAZY mode
//   lazyDepth    → number (default 1) — levels to prefetch when a node first opens
//   initialState → { expandedNodes?: string[], childrenByPath?: object } — restore
//
// Returns { nodes, expanded, toggleExpand, expandAll, collapseAll, expandRoots,
//   reloadDir, reloadAll, replaceNodeChildren, childrenByPath, state }.
//
// In lazy mode the same path can appear under more than one root (e.g. a folder
// reachable from both `/` and `~`), so `_expandKey` is `${root}::${path}` there; in
// eager mode paths are unique (repo-relative) so `_expandKey` is just the path.
const EXPANDABLE = new Set(['directory', 'drive', 'root'])

export function useDirectoryFileTree({ items, mode, loadChildren, lazyDepth = 1, initialState = null } = {}) {
  const lazy      = typeof loadChildren === 'function'
  const flatItems = computed(() => unwrap(items) ?? [])
  const modeVal   = computed(() => unwrap(mode) ?? 'tree')

  const expanded       = ref(new Set(initialState?.expandedNodes ?? []))
  const childrenByPath = ref(initialState?.childrenByPath ? { ...initialState.childrenByPath } : {})
  let _userToggled = false   // eager: stop auto-expanding once the user takes over

  const isExpandable = (node) => EXPANDABLE.has(node.type)
  const expandKeyFor = (root, path) => (lazy ? `${root}::${path}` : path)

  // ── Eager: synthesize the whole hierarchy from the flat path list ─────────────
  // '' keys the roots; each directory's children are directories-first then files,
  // both alphabetical (matching the Explorer tree). Trailing slashes are stripped so
  // a git untracked-dir entry ("?? dir/") still yields a real basename.
  function deriveChildrenByPath(list) {
    const map = {}
    const seenDir = new Set()
    const ensureDir = (dirPath) => {
      if (!dirPath || seenDir.has(dirPath)) return
      const segs = dirPath.split('/')
      const parent = segs.slice(0, -1).join('/')
      ensureDir(parent)
      ;(map[parent] ??= []).push({ name: segs[segs.length - 1], path: dirPath, type: 'directory' })
      seenDir.add(dirPath)
    }
    for (const it of list) {
      const path = String(it.path).replace(/\/+$/, '')
      const segs = path.split('/')
      const parent = segs.slice(0, -1).join('/')
      ensureDir(parent)
      ;(map[parent] ??= []).push({ ...it, path, name: segs[segs.length - 1], type: 'file' })
    }
    for (const key of Object.keys(map)) {
      map[key].sort((a, b) => a.type === b.type ? a.name.localeCompare(b.name) : (a.type === 'directory' ? -1 : 1))
    }
    return map
  }

  // ── Node building ─────────────────────────────────────────────────────────────
  // Spread the source item (customization/status/mdiPath/etc. carry through) and
  // build children only while expanded — exactly the shape TreeItem renders. Icons
  // are resolved at render time by the renderer through the active icon theme
  // (useIconRegistry), so nodes carry no baked icon.
  function buildNode(item, rootKey) {
    const path = item.path ?? item.name
    const effectiveRoot = rootKey ?? path
    const expandKey = expandKeyFor(effectiveRoot, path)
    const node = {
      ...item,
      key: lazy ? expandKey : path,
      _expandKey: expandKey,
    }
    node.children = (isExpandable(node) && expanded.value.has(expandKey))
      ? (childrenByPath.value[item.path] ?? []).map(c => buildNode(c, effectiveRoot))
      : []
    return node
  }

  const rootItems = computed(() => (lazy ? flatItems.value : (childrenByPath.value[''] ?? [])))
  const treeNodes = computed(() => rootItems.value.map(r => buildNode(r, lazy ? (r.path ?? r.name) : null)))

  const listNodes = computed(() => [...flatItems.value]
    .sort((a, b) => a.path.localeCompare(b.path))
    .map((it) => {
      const path = String(it.path).replace(/\/+$/, '')
      const segs = path.split('/')
      return {
        ...it, path, key: path, _expandKey: path, name: segs[segs.length - 1], type: 'file',
        dir: segs.slice(0, -1).join('/'), children: [],
      }
    }))

  const nodes = computed(() => (modeVal.value === 'list' ? listNodes.value : treeNodes.value))

  // ── Lazy fetching ─────────────────────────────────────────────────────────────
  async function fetchChildren(path) {
    try { return (await loadChildren(path)) ?? [] } catch { return [] }
  }

  // Load a directory's children into the cache (and, up to `depth`, its
  // descendants'). A cached directory is skipped unless `force`.
  async function loadInto(path, depth = lazyDepth, force = false) {
    if (!path) return
    if (force || !childrenByPath.value[path]) {
      // Await first, THEN spread — so concurrent loadInto calls don't clobber
      // each other's results (the spread captures childrenByPath at write time).
      const children = await fetchChildren(path)
      childrenByPath.value = { ...childrenByPath.value, [path]: children }
    }
    if (depth > 1) {
      const kids = (childrenByPath.value[path] ?? []).filter(isExpandable)
      await Promise.all(kids.map(k => loadInto(k.path, depth - 1)))
    }
  }

  // Background refresh of an already-cached directory: replace its children only
  // when they actually changed, reusing unchanged child objects (matched by path)
  // so nothing the user is looking at remounts.
  async function softRefresh(path) {
    const fresh = await fetchChildren(path)
    const prev = childrenByPath.value[path] ?? []
    if (sameChildren(prev, fresh)) return
    const byPath = new Map(prev.map(c => [c.path, c]))
    const merged = fresh.map(f => { const e = byPath.get(f.path); return e ? { ...e, ...f } : f })
    childrenByPath.value = { ...childrenByPath.value, [path]: merged }
  }

  // Background-refresh every directory whose children are currently shown — the roots
  // plus any expanded dirs — diff-merging each (via softRefresh) so unchanged nodes keep
  // their identity and only real changes move. Lazy-only: eager trees derive from the
  // `items` prop and refresh through that watch. Used when a kept-alive tree is
  // re-revealed (ExplorerPanel onActivated).
  async function softRefreshAll() {
    if (!lazy) return
    const paths = new Set()
    for (const r of flatItems.value) paths.add(r.path ?? r.name)
    for (const key of expanded.value) {
      const sep = key.indexOf('::')
      paths.add(sep >= 0 ? key.slice(sep + 2) : key)
    }
    await Promise.all([...paths].filter(p => p && childrenByPath.value[p]).map(p => softRefresh(p)))
  }

  // Externally swap a node's children (e.g. after a caller-driven fetch).
  function replaceNodeChildren(path, children) {
    childrenByPath.value = { ...childrenByPath.value, [path]: children ?? [] }
  }

  // ── Expand state ──────────────────────────────────────────────────────────────
  async function toggleExpand({ expandKey, path } = {}) {
    if (!expandKey) return
    _userToggled = true
    const next = new Set(expanded.value)
    if (next.has(expandKey)) {
      next.delete(expandKey)            // collapse — keep the cache (hide, don't unrender)
      expanded.value = next
    } else {
      next.add(expandKey)
      expanded.value = next
      if (lazy && path) {
        if (!childrenByPath.value[path]) await loadInto(path)   // first open → fetch
        else softRefresh(path)                                   // re-open → show cache, soft-update
      }
    }
  }

  function allDirKeys() {
    const keys = []
    const walk = (dir, root) => (childrenByPath.value[dir] ?? []).forEach((n) => {
      if (!isExpandable(n)) return
      const r = lazy ? root : null
      keys.push(expandKeyFor(r, n.path))
      walk(n.path, r)
    })
    if (lazy) flatItems.value.forEach((r) => { const p = r.path ?? r.name; keys.push(expandKeyFor(p, p)); walk(p, p) })
    else walk('', null)
    return keys
  }
  const expandAll   = () => { expanded.value = new Set(allDirKeys()) }
  const collapseAll = () => { expanded.value = new Set() }
  const expandRoots = () => {
    const next = new Set(expanded.value)
    for (const r of rootItems.value) { const p = r.path ?? r.name; next.add(expandKeyFor(p, p)) }
    expanded.value = next
  }

  async function reloadDir(path) { await loadInto(path, 1, true) }
  async function reloadAll() {
    await Promise.all(Object.keys(childrenByPath.value).map(p => loadInto(p, 1, true)))
  }

  // ── Source seeding ────────────────────────────────────────────────────────────
  // Registered last so the immediate callbacks can safely call functions declared
  // above (e.g. expandAll) — otherwise an already-populated `items` at setup time
  // would hit those consts in their temporal dead zone (crashes on activity switch
  // when the data is already cached).
  if (!lazy) {
    watch(flatItems, (list) => { childrenByPath.value = deriveChildrenByPath(list) }, { immediate: true })
    // Auto-expand everything as data arrives (until the user toggles a node).
    watch(childrenByPath, (map) => { if (!_userToggled && map['']?.length) expandAll() }, { immediate: true })
  } else {
    // Lazy: seed each root's preloaded children (if any) and auto-expand that root,
    // so the first level shows without a fetch (mirrors the Explorer tree's
    // `_preloadedItems`). Roots without preloaded children fetch on first expand.
    watch(flatItems, (roots) => {
      if (!roots?.length) return
      const cbp = { ...childrenByPath.value }
      const exp = new Set(expanded.value)
      let changed = false
      for (const r of roots) {
        if (r._preloadedItems) {
          cbp[r.path] = r._preloadedItems
          exp.add(expandKeyFor(r.path, r.path))
          changed = true
        }
      }
      if (changed) { childrenByPath.value = cbp; expanded.value = exp }
    }, { immediate: true })
  }

  const state = computed(() => ({ expandedNodes: [...expanded.value], childrenByPath: childrenByPath.value }))

  return {
    nodes, expanded, toggleExpand,
    expandAll, collapseAll, expandRoots,
    reloadDir, reloadAll, softRefreshAll, replaceNodeChildren,
    childrenByPath, state,
  }
}

function sameChildren(a, b) {
  if (a.length !== b.length) return false
  for (let i = 0; i < a.length; i++) if (a[i].path !== b[i].path) return false
  return true
}

function unwrap(v) {
  if (typeof v === 'function') return v()
  return v && typeof v === 'object' && 'value' in v ? v.value : v
}
