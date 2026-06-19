import { fileURLToPath, URL } from 'node:url'
import type { ServerResponse } from 'node:http'

// Silence proxy ECONNREFUSED/ECONNRESET errors so a missing Go backend doesn't
// flood the console. Vite registers its own error logger synchronously right
// after calling configure(), so we defer via queueMicrotask to replace it.
function _silenceProxyErrors(proxy: any) {
  queueMicrotask(() => {
    proxy.removeAllListeners('error')
    proxy.on('error', (_err: Error, _req: unknown, res: ServerResponse) => {
      if (!res.headersSent) {
        res.writeHead(503, { 'Content-Type': 'application/json' })
        res.end(JSON.stringify({ detail: 'Server unavailable' }))
      }
    })
  })
}

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
        '/_api/v2': { target: 'http://127.0.0.1:8001', changeOrigin: true, configure: _silenceProxyErrors },
        '/_api':    { target: 'http://127.0.0.1:8000', changeOrigin: true, configure: _silenceProxyErrors },
        '/health':  { target: 'http://127.0.0.1:8000', changeOrigin: true, configure: _silenceProxyErrors },
      }
    }
  }
})
