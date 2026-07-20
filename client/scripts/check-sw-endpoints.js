// Guards the one duplicated table in the write path.
//
// The service worker (client/public/sw.js) must live in the app to get root scope,
// but the fallback path it backs up lives in @files-workbench/core (src/sw-queue.js) —
// so the kind → { path, method } map exists twice. If they drift, writes work through
// one path and 404 (or hit the wrong verb) through the other, which surfaces as an
// intermittent, environment-dependent bug: the SW handles ops when it's controlling
// the page, and the fallback handles them on first load / after a hard refresh.
//
// Run standalone (`npm run check:sw-endpoints`), as a hard gate in build:electron, and
// in --soft mode from the dev prebuild (warn, don't block).
const fs = require('fs')
const path = require('path')

const SOFT = process.argv.includes('--soft')
const SW_FILE = path.join(__dirname, '..', 'public', 'sw.js')
// Resolve the core package rather than hardcoding ../../files-workbench-core, so this
// keeps working if the checkout moves or the dep becomes a real (non-file:) install.
const SW_QUEUE_FILE = path.join(path.dirname(require.resolve('@files-workbench/core')), 'sw-queue.js')

// Pull the ENDPOINTS object literal, then its entries. Both files use the same
// `kind: { path: '…', method: '…' }` shape; anything else is reported as unparseable
// rather than silently treated as an empty map.
function parseEndpoints(file) {
  const src = fs.readFileSync(file, 'utf8')
  const block = /const\s+ENDPOINTS\s*=\s*\{([\s\S]*?)\n\}/.exec(src)
  if (!block) throw new Error(`no ENDPOINTS map found in ${file}`)
  const out = new Map()
  const entry = /(\w+)\s*:\s*\{\s*path:\s*'([^']+)'\s*,\s*method:\s*'([^']+)'\s*\}/g
  let m
  while ((m = entry.exec(block[1])) !== null) out.set(m[1], `${m[3]} ${m[2]}`)
  if (out.size === 0) throw new Error(`ENDPOINTS map in ${file} parsed as empty (format changed?)`)
  return out
}

function main() {
  const sw = parseEndpoints(SW_FILE)
  const queue = parseEndpoints(SW_QUEUE_FILE)

  const problems = []
  for (const [kind, def] of sw) {
    if (!queue.has(kind)) problems.push(`"${kind}" is in sw.js but missing from sw-queue.js`)
    else if (queue.get(kind) !== def) problems.push(`"${kind}" differs: sw.js has [${def}], sw-queue.js has [${queue.get(kind)}]`)
  }
  for (const kind of queue.keys()) {
    if (!sw.has(kind)) problems.push(`"${kind}" is in sw-queue.js but missing from sw.js`)
  }

  if (problems.length === 0) {
    console.log(`[check-sw-endpoints] ok — ${sw.size} write endpoints in sync`)
    return
  }
  const msg =
    'service-worker endpoint maps are out of sync:\n' +
    problems.map((p) => `    - ${p}`).join('\n') +
    `\n  Update BOTH:\n    ${path.relative(process.cwd(), SW_FILE)}\n    ${SW_QUEUE_FILE}`
  if (SOFT) { console.warn(`[check-sw-endpoints] ${msg}`); return }
  console.error(`\n[check-sw-endpoints] ${msg}\n`)
  process.exit(1)
}

try {
  main()
} catch (e) {
  // A parse failure means the guard can no longer see what it's guarding — that is
  // itself a problem worth failing a release build for.
  if (SOFT) { console.warn(`[check-sw-endpoints] skipped: ${e.message}`) }
  else { console.error(`\n[check-sw-endpoints] ${e.message}\n`); process.exit(1) }
}
