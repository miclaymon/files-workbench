// Explorer is the one REQUIRED, core-bundled built-in — deliberately NOT a runtime
// plugin (the M4 decision). Two reasons make it "core wearing a plugin costume":
//   1. It owns the app's selection capability. Workbench calls host.requireApi('explorer')
//      SYNCHRONOUSLY right after loading it and hands the selection refs to the file-op /
//      menu / keyboard slices during setup(). Runtime loading is async (fetch → verify →
//      import), so it can't satisfy that synchronous bootstrap dependency without making
//      the whole Workbench setup async.
//   2. Migrating it would require the SDK to expose useSelection (the privileged core
//      selection state machine) plus DirectoryTab / ExplorerPanel / ExplorerStatusWidget /
//      OpenEditorsView to every plugin — contradicting the SDK's non-privileged boundary.
// So Explorer stays compiled in and loaded synchronously. It cannot be uninstalled.
import explorerManifest from './explorer/manifest.json'
import * as explorerModule from './explorer/src/plugin.js'

export const EXPLORER_PLUGIN = { manifest: explorerManifest, module: explorerModule }

// Every other first-party plugin loads at RUNTIME from /plugins/<id>/ (see
// useRuntimePlugins.js): chat, debug, search, storage, converter, details,
// material-icon-theme, preview, source-control. Nothing else is bundled, so this
// legacy list is empty — kept only for the host's loader signature.
export const OPTIONAL_PLUGIN_LOADERS = []
