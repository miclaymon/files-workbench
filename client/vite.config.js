import { fileURLToPath, URL } from 'node:url'
import { defineConfig } from 'vite'
import vue from '@vitejs/plugin-vue'

// The client talks to the Go servers directly (CORS is permissive on the Go side):
// reads → data server :8001, writes → control server :8002. There is no dev proxy —
// the old Nuxt devProxy silently truncated large binary responses, which forced the
// Nitro /media-preview + /text-preview workaround routes. Direct absolute URLs (see
// lib/api-config.js) make dev behave exactly like the packaged app.
export default defineConfig({
  plugins: [vue()],
  // Relative asset paths so the build works from file:// when Electron loads
  // dist/index.html directly.
  base: './',
  resolve: {
    // @workbench/framework is a symlinked local package built on @vue/reactivity.
    // Dedupe forces its imports to resolve to THIS app's single copy (the one
    // inside `vue`) — two reactivity instances would silently break dependency
    // tracking across the framework/app boundary.
    dedupe: ['vue', '@vue/reactivity'],
    alias: {
      '~': fileURLToPath(new URL('.', import.meta.url)).replace(/\/$/, ''),
      '#preferences-schema': fileURLToPath(new URL('../config/preferences/preferences.schema.json', import.meta.url)),
      // Committed first-party plugin hash pins — the client's root of trust for
      // verifying runtime-loaded plugin artifacts (see useRuntimePlugins.js).
      '#plugins-lock': fileURLToPath(new URL('../plugins.lock.json', import.meta.url)),
    },
  },
  server: {
    port: 3000,
    strictPort: true,
  },
  build: {
    outDir: 'dist',
  },
})
