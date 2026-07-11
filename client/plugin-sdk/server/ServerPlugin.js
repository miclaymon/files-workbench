// Server-plugin SDK — runs INSIDE the WASM sandbox (compiled by the extism JS PDK).
//
// This is NOT a browser/Node module: it relies on the globals the extism JS PDK
// injects (`Host`, `Memory`) and is compiled to `.wasm`, not imported by the Vue
// client. A plugin's server entry authors a ServerPlugin and re-exports the three
// fixed extism entry points (see the git plugin for the canonical shape):
//
//   import { ServerPlugin, host } from '<sdk>/server/ServerPlugin.js'
//   const plugin = new ServerPlugin({ init, destroy, methods: { … } })
//   export function handle()         { return plugin.handle() }
//   export function plugin_init()    { return plugin.lifecycleInit() }
//   export function plugin_destroy() { return plugin.lifecycleDestroy() }
//
// The Go host (server/v1/plugin_host.go) calls `handle` with { method, params };
// side-effects reach the OS only through the permissioned host functions below.

// callHost invokes a Go host function by name. The extism JS PDK passes/returns an
// i64 memory offset: we write the JSON arg into extism memory, pass its offset, and
// read the JSON result back from the returned offset. Host functions are synchronous
// (QuickJS has no event loop here), so plugin methods must be synchronous too.
function callHost(name, payload) {
  const fns = Host.getFunctions()
  const fn = fns[name]
  if (!fn) throw new Error(`host function unavailable: ${name} (permission not granted?)`)
  const mem = Memory.fromString(JSON.stringify(payload ?? {}))
  const outOffset = fn(mem.offset)
  const raw = Memory.find(outOffset).readString()
  return raw ? JSON.parse(raw) : null
}

// unwrap turns a host-function error envelope into a thrown Error.
function unwrap(res) {
  if (res && res.error) throw new Error(res.error)
  return res
}

// host is the ergonomic, permission-gated bridge to the OS. Each method maps to a
// Go host function; ungranted capabilities throw ("permission denied: …").
export const host = {
  // Run an allowlisted binary. Requires `exec:<bin>`. Returns { stdout, stderr, code }.
  exec(bin, args = [], cwd = '') {
    return unwrap(callHost('host_exec', { bin, args, cwd }))
  },
  // Filesystem reads. Require `fs:read`; every path is blacklist-checked host-side.
  fs: {
    stat(path) { return unwrap(callHost('host_fs_stat', { path })) },        // { exists, isDir, size, name }
    readDir(path) { return unwrap(callHost('host_fs_read_dir', { path })).entries }, // [{ name, isDir }]
    readFile(path) { return unwrap(callHost('host_fs_read_file', { path })).content }, // string
  },
  // Diagnostic log to the server console (always available).
  log(msg) { try { callHost('host_log', { msg: String(msg) }) } catch (_) { /* best effort */ } },
}

export class ServerPlugin {
  constructor({ methods = {}, init, destroy } = {}) {
    this._methods = methods
    this._init = init
    this._destroy = destroy
  }

  // handle is the single RPC entry point. Reads { method, params } from extism
  // input, dispatches to the matching method, and writes a { ok, result } /
  // { ok:false, error } envelope (the client SDK unwraps it).
  handle() {
    let res
    try {
      const input = JSON.parse(Host.inputString() || '{}')
      const fn = this._methods[input.method]
      if (typeof fn !== 'function') throw new Error(`unknown method: ${input.method}`)
      res = { ok: true, result: fn(input.params ?? {}, host) }
    } catch (e) {
      res = { ok: false, error: e && e.message ? e.message : String(e) }
    }
    Host.outputString(JSON.stringify(res))
    return 0
  }

  // Lifecycle hooks — called once by the Go host after instantiation / before teardown.
  lifecycleInit() {
    try { if (this._init) this._init({ host }) } catch (e) { host.log('init error: ' + (e && e.message ? e.message : e)) }
    return 0
  }
  lifecycleDestroy() {
    try { if (this._destroy) this._destroy() } catch (_) { /* ignore */ }
    return 0
  }
}
