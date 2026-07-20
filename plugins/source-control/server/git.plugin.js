// Source Control server plugin (WASM entry). Compiled to git.wasm by the extism JS
// PDK (see client/scripts/build-plugins.js). Runs sandboxed in the Go server: the
// git logic below reaches `git` and the filesystem only through the permissioned
// host functions the SDK exposes as `host` (declared perms: exec:git, fs:read).
//
// This replaces the bespoke server/v1/scm.go handlers — the client now talks to it
// through the generic POST /_api/v1/plugins/source-control/rpc endpoint.

import { ServerPlugin, host } from '@workbench/plugin-sdk/server/ServerPlugin.js'
import { createGit } from './git-logic.js'

const git = createGit({ exec: host.exec, fs: host.fs, log: host.log })

const plugin = new ServerPlugin({
  methods: {
    detect: (params) => git.detect(params),
    info: (params) => git.info(params),
    commit: (params) => git.commit(params),
    init: (params) => git.init(params),
  },
})

// Fixed extism entry points the Go host calls (see plugin.d.ts).
export function handle() { return plugin.handle() }
export function plugin_init() { return plugin.lifecycleInit() }
export function plugin_destroy() { return plugin.lifecycleDestroy() }
