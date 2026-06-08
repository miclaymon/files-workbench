import { ref, computed } from 'vue'
import { useDebugLog } from './useDebugLog.js'
import { swQueue } from '~/lib/sw-queue.js'

// Module-level state so the queue is shared across the whole app.
const deferredMode = ref(false)
const _deferred = ref([])  // { id, opId, label, resolve, reject } when deferredMode is on
let _seq = 0

export function useFileOpsQueue() {
  const { log } = useDebugLog()

  const pendingCount = computed(() => _deferred.value.length)

  /**
   * Enqueue a file operation.
   *
   * @param {object} op
   * @param {string}  op.label  - Human-readable description for debug log
   * @param {string}  op.kind   - Operation kind ('rename', 'move', 'copy', …)
   * @param {object}  op.params - Serialisable parameters sent to the server
   * @returns {Promise<*>}  Resolves with the server response when executed.
   */
  function enqueue(op) {
    const id = ++_seq
    log('ops-queue', `Queued #${id}`, op.label)

    const opId = swQueue.enqueue(op.kind, op.params)

    if (!deferredMode.value) {
      log('ops-queue', `Executing #${id}`, op.label)
      const [promise] = swQueue.execute([opId])
      return promise.then(
        result => { log('ops-queue', `Done #${id}`, op.label); return result },
        err    => { log('ops-queue', `Failed #${id}: ${err?.message ?? err}`, op.label); throw err },
      )
    }

    // Deferred: hold the opId until flush() is called.
    return new Promise((resolve, reject) => {
      _deferred.value.push({ id, opId, label: op.label, resolve, reject })
    })
  }

  /**
   * Execute all deferred operations concurrently and resolve their Promises.
   * In deferred mode each caller gets a Promise from enqueue() that settles here.
   */
  async function flush() {
    const batch = _deferred.value.splice(0)
    if (!batch.length) return

    const opIds = batch.map(e => e.opId)
    const promises = swQueue.execute(opIds)

    await Promise.allSettled(
      promises.map((p, i) =>
        p.then(
          result => { log('ops-queue', `Done #${batch[i].id}`, batch[i].label); batch[i].resolve(result) },
          err    => { log('ops-queue', `Failed #${batch[i].id}: ${err?.message ?? err}`, batch[i].label); batch[i].reject(err) },
        )
      )
    )
  }

  /** Discard all pending deferred operations. */
  function cancel() {
    const batch = _deferred.value.splice(0)
    for (const entry of batch) {
      entry.reject(new Error('Cancelled'))
      log('ops-queue', `Cancelled #${entry.id}`, entry.label)
    }
    swQueue.clear()
  }

  return { deferredMode, pendingCount, enqueue, flush, cancel }
}
