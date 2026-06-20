import { ref, computed } from 'vue'

// ── Notifications slice ───────────────────────────────────────────────────────
// A module-level singleton so any producer (file ops, future background jobs,
// the server connection, etc.) can push notifications without prop-drilling.
//
// Notification shape (all fields except `id` optional):
//   {
//     id:        string                 unique; pass to reuse/replace an entry
//     type:      'info'|'success'|'warning'|'error'|'progress'
//     title:     string
//     message:   string                 secondary line
//     timestamp: number                 ms epoch (defaults to now)
//     read:      boolean
//     silent:    boolean                excluded from the unread dot + toasts
//     dismissible: boolean              shows the per-item × (default true)
//     progress:  { done, total }        drives the status-bar meter while running
//     progressLabel: string            status-bar text, e.g. "Renaming 142 items…"
//     items:     [{ label, status, detail }]            simple flat breakdown
//     job:       {                                       rich multi-op breakdown
//       verb:  string,                                   e.g. "rename"
//       total: number,
//       operations: [{ id, status:'pending'|'running'|'completed'|'failed',
//                      from, to, label, startedAt, finishedAt, durationMs, error }],
//     }
//     actions:   [{ id, label, handler, primary? }]
//   }
let _seq = 0
const _items = ref([])  // newest first

export function useNotifications() {
  const notifications = computed(() => _items.value)
  // Silent notifications never light the unread dot.
  const unreadCount = computed(() => _items.value.reduce((n, x) => n + (x.read || x.silent ? 0 : 1), 0))
  const hasUnread = computed(() => unreadCount.value > 0)
  // The most recent still-running job — what the status-bar progress item shows.
  const activeJob = computed(() =>
    _items.value.find(n => n.type === 'progress' && n.progress && n.progress.done < n.progress.total) ?? null
  )

  // Create or, when `id` matches an existing entry, replace it in place.
  function notify(opts = {}) {
    const id = opts.id ?? `ntf-${++_seq}`
    const next = {
      type: 'info', title: '', message: '', timestamp: Date.now(),
      read: false, silent: false, dismissible: true,
      progress: null, progressLabel: '', items: null, job: null, actions: null,
      ...opts, id,
    }
    const idx = _items.value.findIndex(n => n.id === id)
    if (idx === -1) _items.value = [next, ..._items.value]
    else _items.value = _items.value.map((n, i) => (i === idx ? { ...n, ...next } : n))
    return id
  }

  // Patch an existing notification (object or updater fn). Useful for progress.
  function update(id, patch) {
    _items.value = _items.value.map(n => {
      if (n.id !== id) return n
      return { ...n, ...(typeof patch === 'function' ? patch(n) : patch) }
    })
  }

  function dismiss(id) { _items.value = _items.value.filter(n => n.id !== id) }
  function clear() { _items.value = [] }
  function markRead(id) { update(id, { read: true }) }
  function markAllRead() {
    if (!_items.value.some(n => !n.read)) return
    _items.value = _items.value.map(n => (n.read ? n : { ...n, read: true }))
  }

  // Start a tracked multi-operation job. Returns control handles to report each
  // operation's outcome; the notification's title/type/progress recompute live.
  //
  //   const job = startJob({ verb: 'rename', progressLabel: 'Renaming 3 items…',
  //                          operations: [{ id, from, to }] })
  //   job.start(id); job.succeed(id); job.fail(id, err); job.setActions([...])
  function startJob({ verb, operations, progressLabel = '', silent = false, kind = undefined }) {
    const ops = operations.map((o, i) => ({
      id: o.id ?? i,
      status: 'running',
      from: o.from ?? null, to: o.to ?? null, label: o.label ?? null,
      startedAt: Date.now(), finishedAt: null, durationMs: null, error: null,
    }))
    const id = notify({
      type: 'progress', kind, silent, progressLabel,
      title: jobTitle(verb, ops),
      progress: { done: 0, total: ops.length },
      job: { verb, total: ops.length, operations: ops },
    })

    function patchOp(opId, makePatch) {
      update(id, n => {
        const nextOps = n.job.operations.map(op => (op.id === opId ? { ...op, ...makePatch(op) } : op))
        const settled = nextOps.filter(o => o.status === 'completed' || o.status === 'failed').length
        const allDone = settled === nextOps.length
        const failed = nextOps.filter(o => o.status === 'failed').length
        return {
          job: { ...n.job, operations: nextOps },
          progress: { done: settled, total: nextOps.length },
          type: allDone ? (failed === 0 ? 'success' : (failed === nextOps.length ? 'error' : 'warning')) : 'progress',
          title: jobTitle(verb, nextOps),
        }
      })
    }

    return {
      id,
      start:   (opId) => patchOp(opId, () => ({ status: 'running', startedAt: Date.now() })),
      succeed: (opId) => patchOp(opId, op => ({ status: 'completed', finishedAt: Date.now(), durationMs: op.startedAt ? Date.now() - op.startedAt : null })),
      fail:    (opId, error) => patchOp(opId, op => ({ status: 'failed', finishedAt: Date.now(), durationMs: op.startedAt ? Date.now() - op.startedAt : null, error: error?.message ?? String(error) })),
      setActions: (actions) => update(id, { actions }),
    }
  }

  return {
    notifications, unreadCount, hasUnread, activeJob,
    notify, update, dismiss, clear, markRead, markAllRead, startJob,
  }
}

// "Job: rename 142 items" / "… (2 failed)" / "… (failed)" when all failed.
function jobTitle(verb, operations) {
  const total = operations.length
  const failed = operations.filter(o => o.status === 'failed').length
  const base = `Job: ${verb} ${total} item${total === 1 ? '' : 's'}`
  if (failed === 0) return base
  if (failed === total) return `${base} (failed)`
  return `${base} (${failed} failed)`
}
