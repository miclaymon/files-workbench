// Explorer is loaded synchronously — Workbench calls host.requireApi('explorer')
// immediately after plugin init to pull the selection API. Every other plugin is
// a lazy dynamic import so a bad module (missing export, runtime error at the top
// of the file, etc.) isolates to that plugin and never crashes the host or peers.
import explorerManifest from './explorer/manifest.json'
import * as explorerModule from './explorer/src/plugin.js'

import sourceControlManifest   from './source-control/manifest.json'
import previewManifest          from './preview/manifest.json'
import detailsManifest          from './details/manifest.json'
import debugManifest            from './debug/manifest.json'
import materialIconThemeManifest from './material-icon-theme/manifest.json'
import chatManifest             from './chat/manifest.json'
import searchManifest           from './search/manifest.json'
import storageManifest          from './storage/manifest.json'
import converterManifest        from './converter/manifest.json'

export const EXPLORER_PLUGIN = { manifest: explorerManifest, module: explorerModule }

// Each entry is { manifest, load } where load() => Promise<module>.
// The plugin host calls load() and activate() in independent try/catch blocks —
// an import failure or activate() error is isolated to one plugin.
export const OPTIONAL_PLUGIN_LOADERS = [
  { manifest: sourceControlManifest,    load: () => import('./source-control/src/plugin.js'    ) },
  { manifest: previewManifest,          load: () => import('./preview/src/plugin.js'           ) },
  { manifest: detailsManifest,          load: () => import('./details/src/plugin.js'           ) },
  { manifest: debugManifest,            load: () => import('./debug/src/plugin.js'             ) },
  { manifest: materialIconThemeManifest,load: () => import('./material-icon-theme/src/plugin.js') },
  { manifest: chatManifest,             load: () => import('./chat/src/plugin.js'              ) },
  { manifest: searchManifest,           load: () => import('./search/src/plugin.js'            ) },
  { manifest: storageManifest,          load: () => import('./storage/src/plugin.js'           ) },
  { manifest: converterManifest,        load: () => import('./converter/src/plugin.js'         ) },
]
