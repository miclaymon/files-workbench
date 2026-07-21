// The app's SDK surface — what runtime-loaded plugins receive from their externalized
// `@workbench/plugin-sdk` (legacy `@fw/sdk`) and `vue` imports.
//
// The MECHANISM (publishing globalThis.__FW_SDK, versioning, hardening) lives in the
// @workbench/plugin-sdk package; this module is the host-policy half: it composes the
// surface from the framework/kit/core packages plus app-own composables/components and
// publishes it via the package's installFwSdk. Plugins share the host's single Vue
// instance and these live bindings — no second Vue, no duplicated state.
//
// SECURITY BOUNDARY — this surface exposes only NON-PRIVILEGED pieces:
//   • UI model classes, reactivity, and safe read/query helpers.
//   • It deliberately does NOT export mutating/privileged filesystem ops (fsDelete,
//     fsMove, fsCopy, fsRename, fsWriteFile, fsCreate*, fsTrash*, *Elevated) or the
//     control-server bridge. Those remain behind the permission-gated `api` a plugin
//     receives in activate(), so a runtime-loaded (possibly third-party) plugin cannot
//     mutate the host or filesystem without a declared, granted permission.
//   Grow this surface deliberately as plugins are migrated; keep privileged ops gated.

import * as vue from 'vue'
import { defineAsyncComponent } from 'vue'

import { installFwSdk as install } from '@workbench/plugin-sdk'

import {
  View, EditorView, ModalView, PanelView, ViewSection, StatusView, Activity,
} from '@workbench/framework'

// Icon resolution / theme registration.
import {
  resolveIcon, registerIconTheme, unregisterIconTheme, setActiveIconTheme,
  listIconThemes, useIconRegistry, activeIconThemeId, isIconThemeAvailable,
} from '@workbench/framework'
import { resolveCustomIcon } from '~/composables/useCustomIcon.js'

// Utility composables plugins use.
import { useDebugLog, LOG_LEVELS } from '~/composables/useDebugLog.js'
import { createEmitter } from '@workbench/framework'
import { useDirectoryFileTree } from '~/composables/useDirectoryFileTree.js'
import { useClickDebounce } from '@workbench/vue'

// Endpoint constants + NON-mutating filesystem helpers only.
import { API_BASE, API_V, MEDIA_BASE } from '@files-workbench/core'
import { fsStat, fsDirSize, watchDirSize, fsListDir, fsOpenWithSystem } from '@files-workbench/core'
// Filesystem search index (read-only query + live change feed).
import { searchIndex, indexStatus, subscribeIndex } from '@files-workbench/core'

// Safe shared components (leaf). Explorer's core components (ExplorerPanel/DirectoryTab/
// ExplorerStatusWidget/OpenEditorsView), MonacoEditor, and the media players are added as
// their plugins migrate (Explorer's remain the open M4 "keep core?" decision).
import PlaceholderPanel from '~/components/workbench/views/PlaceholderPanel.vue'
import { PendingValue } from '@workbench/vue'
import { ResolvedIcon } from '@workbench/vue'

// Heavy shared components exposed LAZILY (host-built by Vite, so their Monaco `?worker`
// imports and video.js/wavesurfer deps are handled correctly, and they don't load until
// first rendered). A plugin references these instead of bundling Monaco/media libs.
const MonacoEditor = defineAsyncComponent(() => import('~/components/workbench/editor/MonacoEditor.vue'))
const AudioPlayer = defineAsyncComponent(() => import('~/components/workbench/directory/AudioPlayer.vue'))
const VideoPlayer = defineAsyncComponent(() => import('~/components/workbench/directory/VideoPlayer.vue'))

export const sdk = Object.freeze({
  // UI model classes
  View, EditorView, ModalView, PanelView, ViewSection, StatusView, Activity,
  // icons
  resolveIcon, registerIconTheme, unregisterIconTheme, setActiveIconTheme,
  listIconThemes, useIconRegistry, activeIconThemeId, isIconThemeAvailable, resolveCustomIcon,
  // utilities
  useDebugLog, LOG_LEVELS, createEmitter, useDirectoryFileTree, useClickDebounce,
  // config + read-only fs
  API_BASE, API_V, MEDIA_BASE,
  fsStat, fsDirSize, watchDirSize, fsListDir, fsOpenWithSystem,
  // search index
  searchIndex, indexStatus, subscribeIndex,
  // safe shared components
  PlaceholderPanel, PendingValue, ResolvedIcon,
  // heavy shared components (lazy, host-built)
  MonacoEditor, AudioPlayer, VideoPlayer,
})

// Publish the SDK global. Call once, early, before any plugin client bundle is imported.
export function installFwSdk() {
  return install({ vue, sdk })
}
