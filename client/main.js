import { createApp } from 'vue'
import Workbench from './components/workbench/Workbench.vue'
import { swQueue } from './lib/sw-queue.js'
import './assets/css/workbench.css'

// Fire-and-forget: the direct-fetch fallback handles any ops enqueued before the
// service worker is ready (was plugins/sw.client.js under Nuxt).
swQueue.init()

createApp(Workbench).mount('#app')
