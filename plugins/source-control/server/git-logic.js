// Pure git logic, ported from server/v1/scm.go. Deliberately free of any sandbox
// globals: the side-effect surface (exec / fs) is INJECTED, so this file runs and
// unit-tests in plain Node exactly as it runs inside the WASM sandbox. git.plugin.js
// wires the real host functions in; git-logic.test.mjs wires mocks in.

// ── path helpers (handle both POSIX and Windows paths from the OS) ─────────────
function sepOf(p) { return p.includes('\\') && !p.includes('/') ? '\\' : '/' }

export function dirname(p) {
  const stripped = p.replace(/[/\\]+$/, '')
  if (stripped === '') return p.length ? p[0] : p            // all separators → root
  const i = Math.max(stripped.lastIndexOf('/'), stripped.lastIndexOf('\\'))
  if (i < 0) return stripped                                 // no separator (e.g. "C:")
  if (i === 0) return stripped.slice(0, 1)                   // POSIX root: "/x" → "/"
  if (i === 2 && /^[A-Za-z]:$/.test(stripped.slice(0, 2))) return stripped.slice(0, 3) // "C:\x" → "C:\"
  return stripped.slice(0, i)
}

export function basename(p) {
  const stripped = p.replace(/[/\\]+$/, '')
  const i = Math.max(stripped.lastIndexOf('/'), stripped.lastIndexOf('\\'))
  return i < 0 ? stripped : stripped.slice(i + 1)
}

export function join(a, b) {
  return a.replace(/[/\\]+$/, '') + sepOf(a) + b
}

// ── pure git-output parsers (direct ports of scm.go) ──────────────────────────

// parseGitStatus splits `git status --porcelain=v1` into staged (index) and changed
// (worktree/untracked) entries. Lines are "XY path".
export function parseGitStatus(out) {
  const staged = []
  const changes = []
  for (const line of out.split('\n')) {
    if (line.length < 3) continue
    const x = line[0]
    const y = line[1]
    let p = line.slice(3).trim()
    const arrow = p.indexOf(' -> ')       // rename: keep the new path
    if (arrow >= 0) p = p.slice(arrow + 4)
    if (x !== ' ' && x !== '?') staged.push({ path: p, status: x })
    if (x === '?' || y === '?') changes.push({ path: p, status: 'U' })
    else if (y !== ' ') changes.push({ path: p, status: y })
  }
  return { staged, changes }
}

// parseGitLog parses the unit-separated (0x1f) `git log` output; %D carries refs.
export function parseGitLog(logOut) {
  const commits = []
  for (const line of logOut.split('\n')) {
    const parts = line.split('\x1f')
    if (parts.length < 4) continue
    const refs = []
    if (parts.length >= 5 && parts[4] !== '') {
      for (let ref of parts[4].split(', ')) {
        ref = ref.trim().replace(/^HEAD -> /, '').replace(/^tag: /, '')
        if (ref !== '' && ref !== 'HEAD') refs.push(ref)
      }
    }
    commits.push({ hash: parts[0], subject: parts[1], author: parts[2], date: parts[3], refs })
  }
  return commits
}

// ── the git service (methods), built over injected exec/fs ────────────────────
// exec(bin, args, cwd) → { stdout, stderr, code };  fs.stat/readDir(path).
export function createGit({ exec, fs, log }) {
  const trace = (m) => { try { if (log) log(m) } catch (_) {} }
  const runGit = (dir, args) => {
    const r = exec('git', ['-C', dir, ...args], '')
    return { out: (r.stdout || '').replace(/\n+$/, ''), code: r.code }
  }
  const isGitRepo = (dir) => {
    try { return !!fs.stat(join(dir, '.git')).exists } catch (_) { return false }
  }
  const addChildRepos = (dir, found) => {
    let entries
    try { entries = fs.readDir(dir) } catch (_) { return }
    for (const e of entries || []) {
      if (e.isDir) {
        const child = join(dir, e.name)
        if (isGitRepo(child)) found.add(child)
      }
    }
  }
  // Ancestors that are repos, plus direct children and siblings, depth-capped.
  const detectReposForPath = (path, found) => {
    let dir = path
    for (let depth = 0; depth < 24; depth++) {
      if (isGitRepo(dir)) found.add(dir)
      const parent = dirname(dir)
      if (parent === dir) break            // filesystem root
      addChildRepos(parent, found)         // siblings of dir
      dir = parent
    }
    addChildRepos(path, found)             // direct children of the path
  }

  return {
    detect({ paths = [] } = {}) {
      const found = new Set()
      for (const p of paths) if (p) detectReposForPath(p, found)
      return [...found]
        .map((root) => ({ id: root, name: basename(root), root }))
        .sort((a, b) => (a.root < b.root ? -1 : a.root > b.root ? 1 : 0))
    },

    info({ root } = {}) {
      if (!root) throw new Error('root required')
      if (!isGitRepo(root)) throw new Error('not a git repository')
      const info = { branch: '', ahead: 0, behind: 0, staged: [], changes: [], log: [] }
      info.branch = runGit(root, ['rev-parse', '--abbrev-ref', 'HEAD']).out
      const ab = runGit(root, ['rev-list', '--left-right', '--count', '@{upstream}...HEAD'])
      if (ab.code === 0) {
        const f = ab.out.trim().split(/\s+/)
        if (f.length === 2) {
          info.behind = parseInt(f[0], 10) || 0
          info.ahead = parseInt(f[1], 10) || 0
        }
      }
      const st = runGit(root, ['status', '--porcelain=v1', '-uall'])
      if (st.code === 0) Object.assign(info, parseGitStatus(st.out))
      const lg = runGit(root, ['log', '--max-count=50', '--date=short', '--pretty=format:%h%x1f%s%x1f%an%x1f%ad%x1f%D'])
      if (lg.code === 0) info.log = parseGitLog(lg.out)
      return info
    },

    commit({ root, message } = {}) {
      if (!root || !message) throw new Error('root and message required')
      fs.stat(root)                        // blacklist-checked host-side; throws if excluded
      if (!isGitRepo(root)) throw new Error('not a git repository')
      const r = exec('git', ['-C', root, 'commit', '-m', message], '')
      if (r.code !== 0) throw new Error((r.stderr || r.stdout || 'commit failed').trim())
      return { ok: true }
    },

    init({ path } = {}) {
      if (!path) throw new Error('path required')
      fs.stat(path)                        // blacklist-checked host-side
      const r = exec('git', ['-C', path, 'init'], '')
      if (r.code !== 0) throw new Error((r.stderr || r.stdout || 'init failed').trim())
      return { ok: true, root: path }
    },
  }
}
