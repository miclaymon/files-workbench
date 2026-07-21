// Compiles the Go binaries into the core package's server/dist/ with
// platform-correct names, so electron-builder's extraResources can bundle them and
// main.js can spawn them:
//   • server        — the data/control HTTP server.
//   • fw-indexer     — the filesystem search index service (core spawns it as a
//                      child; it must sit next to the server binary so core finds it).
// Run as part of `npm run build:electron` (client). Builds natively for the current
// OS — for cross-platform releases, build on each target OS (see ROADMAP).
const { execSync } = require('child_process')
const path = require('path')

const isWin = process.platform === 'win32'
const serverDir = path.join(__dirname, '..', '..', '..', 'files-workbench-core', 'server')

const targets = [
  { name: isWin ? 'server.exe' : 'server', pkg: '.' },
  { name: isWin ? 'fw-indexer.exe' : 'fw-indexer', pkg: './cmd/fw-indexer' },
]

for (const t of targets) {
  const out = path.join('dist', t.name)
  console.log(`[build-server] go build -o ${out} ${t.pkg} (in ../files-workbench-core/server)`)
  execSync(`go build -o ${out} ${t.pkg}`, { cwd: serverDir, stdio: 'inherit' })
}
console.log('[build-server] done → server/dist (in ../files-workbench-core)')
