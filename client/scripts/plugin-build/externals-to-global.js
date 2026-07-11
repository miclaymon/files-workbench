// esbuild plugin: resolve the host-shared bare specifiers to the runtime SDK global
// (globalThis.__FW_SDK) instead of bundling them. This is what lets a runtime-loaded
// plugin share the host's SINGLE Vue instance (and its models/components/icons) — a
// second bundled Vue would break reactivity, provide/inject, and component interop.
//
// The plugin's `import { ref } from 'vue'` (and the runtime helpers the SFC template
// compiler emits) resolve, at load time, to globalThis.__FW_SDK.vue, etc.

// Bare specifier → property on globalThis.__FW_SDK.
//
// Only the singleton-sensitive modules are shared: `vue` (one reactive runtime/instance
// for the whole app) and `@fw/sdk` (the host's live UI models, composables, shared
// components, and api helpers — all bound to the host's Vue and app state). Everything
// else a plugin needs (e.g. `@mdi/js` icon path-strings, `markdown-it`) is plain,
// self-contained data/logic with no shared state, so plugins bundle their own copy
// (esbuild tree-shakes `@mdi/js` down to just the icons a plugin actually imports).
const GLOBALS = Object.freeze({
  vue: 'vue',
  '@fw/sdk': 'sdk',
})

function externalsToGlobal() {
  const names = Object.keys(GLOBALS)
  const filter = new RegExp('^(' + names.map((n) => n.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')).join('|') + ')$')
  return {
    name: 'externals-to-global',
    setup(build) {
      build.onResolve({ filter }, (args) => ({ path: args.path, namespace: 'fw-global' }))
      build.onLoad({ filter: /.*/, namespace: 'fw-global' }, (args) => ({
        // CJS virtual module reading the runtime global; esbuild's interop lets a
        // plugin's named imports (`import { ref }`) resolve members at runtime.
        contents: `module.exports = (globalThis.__FW_SDK && globalThis.__FW_SDK.${GLOBALS[args.path]}) || {}`,
        loader: 'js',
      }))
    },
  }
}

module.exports = { externalsToGlobal, GLOBALS }
