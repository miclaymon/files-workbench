import { fileURLToPath, URL } from 'node:url'

export default defineNuxtConfig({
  compatibilityDate: '2024-11-01',
  devtools: { enabled: false },
  ssr: false,
  css: ['~/assets/css/workbench.css'],
  components: [
    { path: '~/components/workbench', pathPrefix: false }
  ],
  vite: {
    resolve: {
      alias: {
        '#preferences-schema': fileURLToPath(new URL('../config/preferences/preferences.schema.json', import.meta.url)),
      }
    },
    server: {
      proxy: {
        '/_api/v2': { target: 'http://127.0.0.1:8001', changeOrigin: true },
        '/_api': { target: 'http://127.0.0.1:8000', changeOrigin: true },
        '/health': { target: 'http://127.0.0.1:8000', changeOrigin: true },
      }
    }
  }
})
