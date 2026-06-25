import explorerManifest from './explorer/manifest.json'
import * as explorerModule from './explorer/src/plugin.js'
import sourceControlManifest from './source-control/manifest.json'
import * as sourceControlModule from './source-control/src/plugin.js'
import previewManifest from './preview/manifest.json'
import * as previewModule from './preview/src/plugin.js'
import detailsManifest from './details/manifest.json'
import * as detailsModule from './details/src/plugin.js'
import debugManifest from './debug/manifest.json'
import * as debugModule from './debug/src/plugin.js'
import materialIconThemeManifest from './material-icon-theme/manifest.json'
import * as materialIconThemeModule from './material-icon-theme/src/plugin.js'
import chatManifest from './chat/manifest.json'
import * as chatModule from './chat/src/plugin.js'
import searchManifest from './search/manifest.json'
import * as searchModule from './search/src/plugin.js'
import storageManifest from './storage/manifest.json'
import * as storageModule from './storage/src/plugin.js'
import converterManifest from './converter/manifest.json'
import * as converterModule from './converter/src/plugin.js'

// First-party plugins shipped in-tree and loaded through the plugin host at
// startup, exactly the way an extracted third-party archive eventually will be —
// each is a { manifest, module } pair. They are NOT in client/activities/: they
// drive the workbench only through the public plugin API, proving that path.
//
// Explorer is the privileged first-party plugin: it owns the selection capability
// the rest of the workbench consumes, so it loads first (Workbench pulls its API
// synchronously). Preview / Details / Debug are pure surface contributors (panels
// in the Secondary Side Bar / Bottom Panel); Source Control additionally brokers
// to the Go scm API; Material Icon Theme registers an icon-pack handler (the
// `icons` permission) that drives layer 2 of the icon pipeline. Chat / Search /
// Storage / Converter are placeholder panels (Chat in the Secondary Side Bar; the
// others Activity Bar entries) awaiting their roadmap build-out.
export const BUILTIN_PLUGINS = [
  { manifest: explorerManifest, module: explorerModule },
  { manifest: sourceControlManifest, module: sourceControlModule },
  { manifest: previewManifest, module: previewModule },
  { manifest: detailsManifest, module: detailsModule },
  { manifest: debugManifest, module: debugModule },
  { manifest: materialIconThemeManifest, module: materialIconThemeModule },
  { manifest: chatManifest, module: chatModule },
  { manifest: searchManifest, module: searchModule },
  { manifest: storageManifest, module: storageModule },
  { manifest: converterManifest, module: converterModule },
]
