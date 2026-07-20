// Compiles builtin plugins' server backends (JS) to WASM and emits the Go-side
// plugin.json the server discovers at startup. Outputs into config/plugins/<id>/ —
// which build-server bundles (extraResources ships ../config) and the dev Go server
// reads directly (configDir = repo config/).
//
// Two-stage build (the extism JS PDK's QuickJS has no ES-module support, so the
// entry + its imports must be flattened first):
//   1. esbuild → one CommonJS bundle (resolves the SDK + logic imports)
//   2. extism-js → WASM
//
// Run as `npm run build:plugins`, and as part of `build:electron` before `vite
// build`. Requires the `extism-js` CLI on PATH (like git/ffmpeg — see PLUGINS.md);
// esbuild is already a dependency.
//
// `--soft` (used by the dev prebuild in `npm run dev`): never fails the build — a
// missing compiler or a plugin build error is a warning, not an error, so the dev
// server still starts (the plugin just degrades to unavailable). Also skips any
// plugin whose WASM is already newer than its sources, so it's ~free when unchanged.
const fs = require('fs')
const os = require('os')
const path = require('path')
const crypto = require('crypto')
const { execFileSync } = require('child_process')
const esbuild = require('esbuild')
// The plugin-build helpers live in the SDK package. vueSfc gets the HOST's SFC
// compiler injected — the package can't (and shouldn't) resolve its own copy.
const { vueSfc } = require('@workbench/plugin-sdk/build/vue-sfc.cjs')
const { externalsToGlobal } = require('@workbench/plugin-sdk/build/externals-to-global.cjs')
const compilerSfc = require('@vue/compiler-sfc')

const SOFT = process.argv.includes('--soft')
// `--out <dir>` overrides the client-artifact output dir. The production build
// (build:electron) uses a dedicated dir so its DEV=false artifacts never collide with
// dev's DEV=true ones in .fw/plugins (which would break the dev-mock endpoints).
const OUT_ARG = (() => { const i = process.argv.indexOf('--out'); return i >= 0 ? process.argv[i + 1] : null })()
const IS_DEV_BUILD = !OUT_ARG // a prod build always targets a dedicated --out dir
const CLIENT_DIR = path.join(__dirname, '..')
const REPO_DIR = path.join(CLIENT_DIR, '..')
const SDK_DTS = require.resolve('@workbench/plugin-sdk/server/plugin.d.ts')
const SDK_DIR = path.dirname(SDK_DTS)
const OUT_ROOT = path.join(REPO_DIR, 'config', 'plugins') // server-plugin WASM (Go scans configDir/plugins)
const WASM_NAME = 'plugin.wasm' // fixed output name per plugin dir

// The unified plugin source tree (client + server targets both live here) and the
// built client-artifact dir. Dev default for the dist is a gitignored in-repo dir;
// production (build:electron) passes --out and Electron sets FW_PLUGINS_DIR at runtime.
const PLUGINS_SRC = path.join(REPO_DIR, 'plugins')
const PLUGINS_DIST = OUT_ARG
  ? path.resolve(REPO_DIR, OUT_ARG)
  : path.join(REPO_DIR, '.fw', 'plugins')
const LOCK_FILE = path.join(REPO_DIR, 'plugins.lock.json')
const PLUGIN_BUILD_DIR = path.dirname(require.resolve('@workbench/plugin-sdk/build/vue-sfc.cjs'))
const NODE_PATHS = [path.join(CLIENT_DIR, 'node_modules')] // resolve @mdi/js etc. for /plugins sources

const sha256 = (buf) => crypto.createHash('sha256').update(buf).digest('hex')
const readLock = () => { try { return JSON.parse(fs.readFileSync(LOCK_FILE, 'utf8')) } catch { return {} } }
const writeLock = (lock) => {
  const sorted = {}
  for (const k of Object.keys(lock).sort()) sorted[k] = lock[k]
  fs.writeFileSync(LOCK_FILE, JSON.stringify(sorted, null, 2) + '\n')
}

function hasExtismJs() {
  try { execFileSync('extism-js', ['--version'], { stdio: 'ignore' }); return true }
  catch { return false }
}

// Newest file mtime under a dir tree (0 if absent) — for the up-to-date check.
function newestMtimeMs(dir) {
  let newest = 0
  let entries
  try { entries = fs.readdirSync(dir, { withFileTypes: true }) } catch { return 0 }
  for (const e of entries) {
    const p = path.join(dir, e.name)
    if (e.isDirectory()) newest = Math.max(newest, newestMtimeMs(p))
    else newest = Math.max(newest, fs.statSync(p).mtimeMs)
  }
  return newest
}

// A built wasm is fresh if it's newer than the plugin's server sources and the SDK.
function isUpToDate(srcEntry, outWasm) {
  if (!fs.existsSync(outWasm)) return false
  const wasmMs = fs.statSync(outWasm).mtimeMs
  const srcMs = Math.max(newestMtimeMs(path.dirname(srcEntry)), newestMtimeMs(SDK_DIR))
  return wasmMs >= srcMs
}

// Discover plugins under /plugins/<id>/ whose manifest declares a `server` block
// (the WASM backend). Same unified source tree as the client target.
function discover() {
  if (!fs.existsSync(PLUGINS_SRC)) return []
  const out = []
  for (const entry of fs.readdirSync(PLUGINS_SRC, { withFileTypes: true })) {
    if (!entry.isDirectory()) continue
    const mfPath = path.join(PLUGINS_SRC, entry.name, 'manifest.json')
    if (!fs.existsSync(mfPath)) continue
    let mf
    try { mf = JSON.parse(fs.readFileSync(mfPath, 'utf8')) } catch { continue }
    if (!mf.server || !mf.server.entry) continue
    out.push({ id: mf.id || entry.name, dir: path.join(PLUGINS_SRC, entry.name), server: mf.server })
  }
  return out
}

// A built client bundle is fresh if newer than the plugin sources and the esbuild
// plugins (the SDK surface is externalized, not bundled, so it doesn't affect the output).
function isClientUpToDate(pluginDir, outClient) {
  if (!fs.existsSync(outClient)) return false
  const outMs = fs.statSync(outClient).mtimeMs
  // Rebuild if the plugin sources, the esbuild loaders, or this build script changed.
  const buildScriptMs = fs.statSync(__filename).mtimeMs
  return outMs >= Math.max(newestMtimeMs(pluginDir), newestMtimeMs(PLUGIN_BUILD_DIR), buildScriptMs)
}

// Build the client target of each plugin under /plugins/<id>/ → an ESM bundle with
// `vue`/`@workbench/plugin-sdk` externalized to the host global. Emits
// <dist>/<id>/{client.js, plugin.json} + content hashes, and updates the committed
// first-party lock.
async function buildClientPlugins() {
  if (!fs.existsSync(PLUGINS_SRC)) return
  const { scanCapabilities, uncoveredFindings } = await import('@workbench/plugin-sdk')
  const lock = readLock()
  let built = 0
  for (const entry of fs.readdirSync(PLUGINS_SRC, { withFileTypes: true })) {
    if (!entry.isDirectory()) continue
    const dir = path.join(PLUGINS_SRC, entry.name)
    const mfPath = path.join(dir, 'manifest.json')
    if (!fs.existsSync(mfPath)) continue
    let mf
    try { mf = JSON.parse(fs.readFileSync(mfPath, 'utf8')) } catch { continue }
    if (!mf.client || !mf.client.entry) continue

    const id = mf.id || entry.name
    const srcEntry = path.join(dir, mf.client.entry)
    if (!fs.existsSync(srcEntry)) {
      if (SOFT) { console.warn(`[build-plugins] ${id}: client entry not found, skipped: ${srcEntry}`); continue }
      console.error(`[build-plugins] ${id}: client entry not found: ${srcEntry}`); process.exit(1)
    }
    const outDir = path.join(PLUGINS_DIST, id)
    const outClient = path.join(outDir, 'client.js')
    if (SOFT && isClientUpToDate(dir, outClient)) { console.log(`[build-plugins] ${id}: client up to date, skipped`); continue }
    fs.mkdirSync(outDir, { recursive: true })

    try {
      await esbuild.build({
        entryPoints: [srcEntry],
        bundle: true,
        format: 'esm',
        target: 'es2020',
        outfile: outClient,
        nodePaths: NODE_PATHS,
        plugins: [vueSfc({ compilerSfc }), externalsToGlobal()],
        legalComments: 'none',
        // Vite replaces `import.meta.env` in the host build; esbuild does not, so plugin
        // code that reads it (e.g. `import.meta.env.DEV`) would throw at runtime. Define
        // it to match the build mode. DEV is keyed to `--out` (only the production
        // `build:electron` passes it) — NOT to `--soft` (which is purely error-tolerance)
        // — so a dev build always emits DEV=true dev-mock artifacts into .fw/plugins and a
        // prod build always emits DEV=false into the --out dir, with no cross-contamination.
        define: {
          'import.meta.env.DEV': JSON.stringify(IS_DEV_BUILD),
          'import.meta.env.PROD': JSON.stringify(!IS_DEV_BUILD),
          'import.meta.env.MODE': JSON.stringify(IS_DEV_BUILD ? 'development' : 'production'),
          'import.meta.env.SSR': 'false',
        },
      })
    } catch (e) {
      if (SOFT) { console.warn(`[build-plugins] ${id}: client build failed, skipped (soft): ${e.message}`); continue }
      throw e
    }

    // Capability scan (@workbench/plugin-sdk): code-execution primitives
    // (eval / Function / dynamic import / Worker) fail a non-soft first-party build;
    // uncovered network/storage/clipboard use is advisory (route it through `api`).
    const findings = uncoveredFindings(scanCapabilities(fs.readFileSync(outClient, 'utf8')), mf.permissions || [])
    const high = findings.filter((f) => f.severity === 'high')
    if (high.length) {
      const list = high.map((f) => `${f.token}×${f.count}`).join(', ')
      if (SOFT) { console.warn(`[build-plugins] ${id}: capability scan (soft): code-execution primitives — ${list}`) }
      else { console.error(`[build-plugins] ${id}: refusing build — code-execution primitives in bundle: ${list}`); process.exit(1) }
    }
    const caps = findings.filter((f) => f.severity === 'capability')
    if (caps.length) {
      console.warn(`[build-plugins] ${id}: capability scan: ${caps.map((f) => `${f.token} (declare "${f.permission}")`).join(', ')}`)
    }

    const clientHash = sha256(fs.readFileSync(outClient))
    const runtimeManifest = {
      id,
      name: mf.name,
      version: mf.version,
      icon: mf.icon,
      permissions: mf.permissions || [],
      client: { entry: 'client.js', hash: clientHash },
    }
    fs.writeFileSync(path.join(outDir, 'plugin.json'), JSON.stringify(runtimeManifest, null, 2) + '\n')
    lock[id] = { version: mf.version, client: clientHash }
    built++
    console.log(`[build-plugins] ${id}: client -> ${path.relative(REPO_DIR, outClient)} (sha256 ${clientHash.slice(0, 12)}…)`)
  }
  writeLock(lock)
  if (built) console.log(`[build-plugins] built ${built} client plugin(s)`)
}

function buildServerPlugins() {
  const servers = discover()
  if (servers.length === 0) {
    console.log('[build-plugins] no server plugins to build')
    return
  }
  if (!hasExtismJs()) {
    const msg =
      '`extism-js` (extism JS PDK compiler) not found on PATH.\n' +
      `  ${servers.length} server plugin(s) need it to build their WASM backends:\n` +
      servers.map((s) => `    - ${s.id}`).join('\n') + '\n\n' +
      '  Install (Linux/macOS):\n' +
      '    curl -L https://raw.githubusercontent.com/extism/js-pdk/main/install.sh | bash\n' +
      '  or grab a release binary: https://github.com/extism/js-pdk/releases\n' +
      '  (the compiler also needs binaryen `wasm-merge` on PATH for some versions).'
    if (SOFT) {
      // Dev prebuild: don't block `npm run dev`; the plugin just degrades to unavailable.
      console.warn(`[build-plugins] skipped (soft): ${msg}`)
      return
    }
    console.error('\n[build-plugins] ' + msg + '\n')
    process.exit(1)
  }

  let built = 0
  for (const s of servers) {
    const srcEntry = path.join(s.dir, s.server.entry)
    if (!fs.existsSync(srcEntry)) {
      if (SOFT) { console.warn(`[build-plugins] ${s.id}: entry not found, skipped: ${srcEntry}`); continue }
      console.error(`[build-plugins] ${s.id}: entry not found: ${srcEntry}`)
      process.exit(1)
    }
    const outDir = path.join(OUT_ROOT, s.id)
    const outWasm = path.join(outDir, WASM_NAME)

    if (SOFT && isUpToDate(srcEntry, outWasm)) {
      console.log(`[build-plugins] ${s.id}: up to date, skipped`)
      continue
    }
    fs.mkdirSync(outDir, { recursive: true })

    try {
      // Stage 1: flatten to a single CommonJS file (extism JS PDK has no ESM support).
      const bundle = path.join(os.tmpdir(), `fw-plugin-${s.id}-${process.pid}.js`)
      esbuild.buildSync({
        entryPoints: [srcEntry],
        bundle: true,
        format: 'cjs',
        target: 'es2020',
        platform: 'neutral',
        outfile: bundle,
        nodePaths: NODE_PATHS, // resolve '@workbench/plugin-sdk/server/*' for /plugins sources
      })

      // Stage 2: compile the bundle to WASM.
      console.log(`[build-plugins] ${s.id}: ${path.relative(CLIENT_DIR, srcEntry)} -> ${path.relative(path.join(CLIENT_DIR, '..'), outWasm)}`)
      try {
        execFileSync('extism-js', [bundle, '-i', SDK_DTS, '-o', outWasm], { stdio: 'inherit' })
      } finally {
        fs.rmSync(bundle, { force: true })
      }

      // Emit the Go-side manifest the server scans (config/plugins/<id>/plugin.json).
      const goManifest = {
        id: s.id,
        server: {
          entry: WASM_NAME,
          runtime: s.server.runtime || 'wasm-js',
          permissions: s.server.permissions || [],
        },
      }
      fs.writeFileSync(path.join(outDir, 'plugin.json'), JSON.stringify(goManifest, null, 2) + '\n')
      built++
    } catch (e) {
      if (SOFT) { console.warn(`[build-plugins] ${s.id}: build failed, skipped (soft): ${e.message}`); continue }
      throw e
    }
  }
  console.log(`[build-plugins] built ${built} server plugin(s)` + (SOFT ? ' (soft)' : ''))
}

async function main() {
  await buildClientPlugins()
  buildServerPlugins()
}

main().catch((e) => { console.error(e); process.exit(1) })
