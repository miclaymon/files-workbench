// @fw/sdk — the host-provided SDK for RUNTIME-loaded client plugins.
//
// A plugin's client bundle is built with `vue` and `@fw/sdk` externalized to the host
// (see client/scripts/plugin-build/externals-to-global.js): at load time they resolve
// to `globalThis.__FW_SDK.vue` / `.sdk`. `installFwSdk()` publishes that global from the
// HOST's own imports, guaranteeing plugins share the host's single Vue instance and its
// live models/composables/components — no second Vue, no duplicated state.
//
// SECURITY BOUNDARY — this SDK exposes only NON-PRIVILEGED surface:
//   • UI model classes, reactivity, and safe read/query helpers.
//   • It deliberately does NOT export mutating/privileged filesystem ops (fsDelete,
//     fsMove, fsCopy, fsRename, fsWriteFile, fsCreate*, fsTrash*, *Elevated) or the
//     control-server bridge. Those remain behind the permission-gated `api` a plugin
//     receives in activate(), so a runtime-loaded (possibly third-party) plugin cannot
//     mutate the host or filesystem without a declared, granted permission.
//   Grow this surface deliberately as plugins are migrated; keep privileged ops gated.

import * as vue from 'vue'
import { defineAsyncComponent } from 'vue'

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
import { API_BASE, API_V, MEDIA_BASE } from '~/lib/api-config.js'
import { fsStat, fsDirSize, watchDirSize, fsListDir, fsOpenWithSystem } from '~/lib/fs-api.js'

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
  // safe shared components
  PlaceholderPanel, PendingValue, ResolvedIcon,
  // heavy shared components (lazy, host-built)
  MonacoEditor, AudioPlayer, VideoPlayer,
})

// Current SDK contract version — a plugin's manifest declares `engines.sdk` and the
// host checks compatibility before loading (bump on breaking surface changes).
export const SDK_VERSION = '1.0.0'

// Publish the SDK global. Call once, early, before any plugin client bundle is imported.
export function installFwSdk() {
  globalThis.__FW_SDK = Object.freeze({ vue, sdk, version: SDK_VERSION })
  return globalThis.__FW_SDK
}
