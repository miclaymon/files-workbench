// Unit test for the ported git logic (parity with server/v1/scm.go). Runs in plain
// Node with mocked exec/fs — proves the port before it's compiled to WASM.
//   node client/builtin-plugins/source-control/server/git-logic.test.mjs
import assert from 'node:assert'
import {
  createGit, parseGitStatus, parseGitLog, dirname, basename, join,
} from './git-logic.js'

let passed = 0
const ok = (name) => { passed++; console.log('  ok', name) }

// ── path helpers ──────────────────────────────────────────────────────────────
assert.equal(dirname('/a/b/c'), '/a/b');            ok('dirname nested')
assert.equal(dirname('/a'), '/');                   ok('dirname one level')
assert.equal(dirname('/'), '/');                    ok('dirname root terminates')
assert.equal(dirname('C:\\Users\\x'), 'C:\\Users'); ok('dirname windows')
assert.equal(dirname('C:\\'), 'C:');                ok('dirname windows drive')
assert.equal(basename('/a/b/repo'), 'repo');        ok('basename')
assert.equal(basename('/a/b/repo/'), 'repo');       ok('basename trailing slash')
assert.equal(join('/a/b', '.git'), '/a/b/.git');    ok('join posix')
assert.equal(join('C:\\a', '.git'), 'C:\\a\\.git'); ok('join windows')

// ── parseGitStatus (porcelain v1) ─────────────────────────────────────────────
{
  const out = [
    'M  staged-mod.js',   // staged modification (X=M)
    ' M worktree-mod.js', // worktree modification (Y=M)
    'A  added.js',        // staged add
    '?? untracked.txt',   // untracked
    'R  old.js -> new.js',// rename (keep new path)
  ].join('\n')
  const { staged, changes } = parseGitStatus(out)
  assert.deepEqual(staged.map((s) => s.path), ['staged-mod.js', 'added.js', 'new.js'])
  assert.deepEqual(changes.map((c) => c.path), ['worktree-mod.js', 'untracked.txt'])
  assert.equal(changes.find((c) => c.path === 'untracked.txt').status, 'U')
  ok('parseGitStatus staged/changes/rename/untracked')
}

// ── parseGitLog (0x1f-separated, %D refs) ─────────────────────────────────────
{
  const US = '\x1f'
  const out = [
    ['abc123', 'first subject', 'Alice', '2026-01-01', 'HEAD -> main, tag: v1, origin/main'].join(US),
    ['def456', 'second', 'Bob', '2026-01-02', ''].join(US),
  ].join('\n')
  const log = parseGitLog(out)
  assert.equal(log.length, 2)
  assert.deepEqual(log[0], { hash: 'abc123', subject: 'first subject', author: 'Alice', date: '2026-01-01', refs: ['main', 'v1', 'origin/main'] })
  assert.deepEqual(log[1].refs, [])
  ok('parseGitLog fields + ref cleanup')
}

// ── detect: walks ancestors/children/siblings for .git ────────────────────────
{
  // Repo at /work/proj; /work/proj/sub is a nested repo; /work/other is a sibling.
  const repos = new Set(['/work/proj', '/work/proj/sub', '/work/other'])
  const fs = {
    stat: (p) => ({ exists: p.endsWith('/.git') && repos.has(p.slice(0, -'/.git'.length)) }),
    readDir: (p) => {
      if (p === '/work') return [{ name: 'proj', isDir: true }, { name: 'other', isDir: true }]
      if (p === '/work/proj') return [{ name: 'sub', isDir: true }, { name: 'file.txt', isDir: false }]
      return []
    },
  }
  const git = createGit({ exec: () => ({ stdout: '', stderr: '', code: 0 }), fs })
  const found = git.detect({ paths: ['/work/proj'] }).map((r) => r.root)
  assert.deepEqual(found, ['/work/other', '/work/proj', '/work/proj/sub']) // sorted
  assert.equal(git.detect({ paths: ['/work/proj'] })[1].name, 'proj')
  ok('detect finds ancestor/child/sibling repos, sorted')
}

// ── info: assembles branch/ahead-behind/status/log ────────────────────────────
{
  const US = '\x1f'
  const exec = (bin, args) => {
    const a = args.join(' ')
    if (a.includes('rev-parse --abbrev-ref HEAD')) return { stdout: 'main\n', code: 0 }
    if (a.includes('rev-list')) return { stdout: '2\t3\n', code: 0 } // behind=2 ahead=3
    if (a.includes('status --porcelain')) return { stdout: 'M  a.js\n?? b.txt\n', code: 0 }
    if (a.includes('log')) return { stdout: ['h1', 's1', 'auth', '2026-01-01', 'main'].join(US) + '\n', code: 0 }
    return { stdout: '', code: 0 }
  }
  const fs = { stat: (p) => ({ exists: p.endsWith('/.git') }) }
  const git = createGit({ exec, fs })
  const info = git.info({ root: '/repo' })
  assert.equal(info.branch, 'main')
  assert.equal(info.behind, 2)
  assert.equal(info.ahead, 3)
  assert.equal(info.staged.length, 1)
  assert.equal(info.changes.length, 1)
  assert.equal(info.log[0].hash, 'h1')
  ok('info assembles branch/ahead-behind/status/log')
  assert.throws(() => git.info({ root: '' }), /root required/); ok('info requires root')
}

// ── commit / init: exec + error propagation ───────────────────────────────────
{
  const calls = []
  const fs = { stat: (p) => ({ exists: p.endsWith('/.git') || p === '/repo' }) }
  const okExec = (bin, args) => { calls.push(args.join(' ')); return { stdout: '', stderr: '', code: 0 } }
  const git = createGit({ exec: okExec, fs })
  assert.deepEqual(git.commit({ root: '/repo', message: 'hi' }), { ok: true })
  assert.ok(calls.some((c) => c.includes('commit -m hi')))
  assert.deepEqual(git.init({ path: '/new' }), { ok: true, root: '/new' })
  ok('commit + init run git and return ok')

  const failExec = () => ({ stdout: '', stderr: 'nothing to commit\n', code: 1 })
  const gitFail = createGit({ exec: failExec, fs })
  assert.throws(() => gitFail.commit({ root: '/repo', message: 'x' }), /nothing to commit/)
  ok('commit surfaces git stderr on failure')
}

console.log(`\nAll ${passed} git-logic assertions passed ✓`)
