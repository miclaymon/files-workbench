import { ref, computed, watch } from 'vue'
import { useIconPack } from '~/composables/useIconPack.js'

// ── Directory file tree ───────────────────────────────────────────────────────
//
// Builds a renderable file tree from a flat set of items that each carry a `path`
// (already relative to whatever root the caller cares about — e.g. git status
// paths are repo-relative). Modelled on the Explorer tree (the gold standard): it
// synthesizes a `childrenByPath` map, then recursively builds nodes that carry an
// `_expandKey` and whose `children` are populated only while expanded — the exact
// node shape `TreeItem` consumes, so a tree renderer can mirror the Explorer look.
//
// The difference from the Explorer tree is only the data source: there children
// are fetched lazily per directory; here every path is known up front, so the
// whole hierarchy is derived once. (The Explorer tree could later adopt this
// builder by feeding it a flattened listing.)
//
// Two presentations, chosen by `mode`:
//   'tree'  the synthesized directory hierarchy; files always show.
//   'list'  the files only, sorted by path (each also exposes its `dir`).
//
// Params (each may be a ref, a getter, or a plain value):
//   items  → [{ path, ...meta }]
//   mode   → 'tree' | 'list'
//
// Returns { nodes, expanded, toggleExpand, expandAll, collapseAll } where nodes
// are { ...item, key, name, path, type, icon, _expandKey, children[] }.
export function useDirectoryFileTree({ items, mode } = {}) {
  const { ensureLoaded, resolveIcon, isAvailable } = useIconPack()
  ensureLoaded()

  const flatItems = computed(() => unwrap(items) ?? [])
  const modeVal   = computed(() => unwrap(mode) ?? 'tree')

  const expanded = ref(new Set())

  function iconName(name, isDir) { return isAvailable.value ? resolveIcon(name, isDir) : null }
  const isExpandable = (node) => node.type === 'directory'

  // Synthesize the directory hierarchy from the flat path list into a
  // childrenByPath map ('' keys the roots) — the same structure the Explorer tree
  // fills lazily from the server, derived once here. Each directory's children are
  // ordered directories-first, then files, both alphabetical (matching Explorer).
  const childrenByPath = computed(() => {
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
    for (const it of flatItems.value) {
      const segs = it.path.split('/')
      const parent = segs.slice(0, -1).join('/')
      ensureDir(parent)
      ;(map[parent] ??= []).push({ ...it, name: segs[segs.length - 1], type: 'file' })
    }
    for (const key of Object.keys(map)) {
      map[key].sort((a, b) =>
        a.type === b.type ? a.name.localeCompare(b.name) : (a.type === 'directory' ? -1 : 1))
    }
    return map
  })

  // Recursively build a node, spreading the source item (so icon/status/etc. carry
  // through) and including children only when the node is expanded — exactly like
  // the Explorer tree's buildTreeNode.
  function buildNode(item) {
    const node = {
      ...item,
      key: item.path,
      _expandKey: item.path,
      icon: item.icon ?? iconName(item.name, isExpandable(item)),
    }
    node.children = (isExpandable(node) && expanded.value.has(node._expandKey))
      ? (childrenByPath.value[node.path] ?? []).map(buildNode)
      : []
    return node
  }

  const treeNodes = computed(() => (childrenByPath.value[''] ?? []).map(buildNode))

  const listNodes = computed(() => [...flatItems.value]
    .sort((a, b) => a.path.localeCompare(b.path))
    .map((it) => {
      const segs = it.path.split('/')
      return {
        ...it, key: it.path, _expandKey: it.path, name: segs[segs.length - 1], type: 'file',
        icon: iconName(segs[segs.length - 1], false), dir: segs.slice(0, -1).join('/'), children: [],
      }
    }))

  const nodes = computed(() => (modeVal.value === 'list' ? listNodes.value : treeNodes.value))

  // ── Expand state ──────────────────────────────────────────────────────────────
  function allDirKeys() {
    const keys = []
    const walk = (dir) => (childrenByPath.value[dir] ?? []).forEach((n) => {
      if (n.type === 'directory') { keys.push(n.path); walk(n.path) }
    })
    walk('')
    return keys
  }
  function toggleExpand({ expandKey }) {
    const next = new Set(expanded.value)
    next.has(expandKey) ? next.delete(expandKey) : next.add(expandKey)
    expanded.value = next
  }
  const expandAll   = () => { expanded.value = new Set(allDirKeys()) }
  const collapseAll = () => { expanded.value = new Set() }

  // Auto-expand the whole tree as data arrives so changes are visible by default
  // (a fresh tree view shows its contents), until the user toggles a node — after
  // that their expand state is respected.
  let _userToggled = false
  const _toggleExpand = toggleExpand
  watch(childrenByPath, (map) => { if (!_userToggled && map['']?.length) expandAll() }, { immediate: true })

  return {
    nodes,
    expanded,
    toggleExpand: (e) => { _userToggled = true; _toggleExpand(e) },
    expandAll,
    collapseAll,
  }
}

function unwrap(v) {
  if (typeof v === 'function') return v()
  return v && typeof v === 'object' && 'value' in v ? v.value : v
}
