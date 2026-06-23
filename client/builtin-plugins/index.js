import sourceControlManifest from './source-control/manifest.json'
import * as sourceControlModule from './source-control/src/plugin.js'

// First-party plugins shipped in-tree and loaded through the plugin host at
// startup, exactly the way an extracted third-party archive eventually will be —
// each is a { manifest, module } pair. They are NOT in client/activities/: they
// drive the workbench only through the public plugin API, proving that path.
export const BUILTIN_PLUGINS = [
  { manifest: sourceControlManifest, module: sourceControlModule },
]
