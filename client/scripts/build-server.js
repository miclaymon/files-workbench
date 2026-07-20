// Compiles the Go data/control server into the core package's server/dist/ with the
// platform-correct name (server.exe on Windows, server elsewhere) so
// electron-builder's extraResources can bundle it and main.js can spawn it.
// Run as part of `npm run build:electron` (client). Builds natively for the
// current OS — for cross-platform releases, build on each target OS (see ROADMAP).
const { execSync } = require('child_process')
const path = require('path')

const isWin = process.platform === 'win32'
const out = path.join('dist', isWin ? 'server.exe' : 'server')
const serverDir = path.join(__dirname, '..', '..', '..', 'files-workbench-core', 'server')

console.log(`[build-server] go build -o ${out} (in ../files-workbench-core/server)`)
execSync(`go build -o ${out} .`, { cwd: serverDir, stdio: 'inherit' })
console.log(`[build-server] done → server/dist (in ../files-workbench-core)`)
