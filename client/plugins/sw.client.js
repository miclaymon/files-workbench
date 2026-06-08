import { swQueue } from '~/lib/sw-queue.js'

export default defineNuxtPlugin(() => {
  // Fire-and-forget: direct-fetch fallback handles any ops that arrive before ready.
  swQueue.init()
})
