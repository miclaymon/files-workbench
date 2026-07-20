import { createApp, nextTick } from 'vue'
import Workbench from './components/workbench/Workbench.vue'
import { swQueue } from '@files-workbench/core'
import '@workbench/vue/styles/workbench.css'

// Fire-and-forget: the direct-fetch fallback handles any ops enqueued before the
// service worker is ready (was plugins/sw.client.js under Nuxt).
swQueue.init()

createApp(Workbench).mount('#app')
dismissBootSkeleton()

/**
 * The inline #boot skeleton (client/index.html) stays up as an opaque overlay
 * through Vue's first render so the real workbench chrome never visibly pops
 * in over it. `useWorkspaces`/`useViewLayout` restore the persisted layout
 * synchronously during Workbench's setup(), so it's already in the DOM by the
 * time `mount()` returns — `nextTick` plus a couple of rAFs just give the
 * browser a chance to actually paint that frame before we start the fade.
 * index.html's own timeout is the hard fallback if this never runs at all
 * (e.g. a synchronous exception during mount).
 */
async function dismissBootSkeleton() {
  const boot = document.getElementById('boot')
  if (!boot) return
  await nextTick()
  await new Promise(requestAnimationFrame)
  await new Promise(requestAnimationFrame)
  boot.classList.add('--fade')
  setTimeout(() => boot.remove(), 200)
}
