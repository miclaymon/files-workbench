// ── Prototype hardening (defense-in-depth, NOT a sandbox) ─────────────────────
//
// Client plugins run in the host's JS realm (they must — they contribute live Vue
// components rendered inline; a component can't cross a realm boundary). That means
// there is no true isolation: an in-realm module can always reach ambient globals.
// What we CAN do cheaply is freeze the well-known intrinsic prototypes so a plugin
// can't *poison* prototypes the whole app shares (e.g. adding an enumerable
// `Array.prototype` property, or replacing `Object.prototype.toString`). Integrity of
// the artifact itself rests on the content hash; the capability scan flags ambient
// use. This is the belt-and-suspenders layer on top of those.
//
// COMPAT RISK: freezing intrinsics can break libraries that monkey-patch prototypes
// at runtime (Monaco, video.js, markdown-it plugins, …). So it is **off by default**
// and must be verified against the full app before being turned on. Enable it to test:
//   • build-time:  VITE_FW_HARDEN=true
//   • runtime:     localStorage['fw:harden'] = '1'  (then reload)
// Once Explorer + Monaco preview + media playback + markdown render are verified clean
// with it on, flip the default (or bake VITE_FW_HARDEN into the production build).

// Constructors whose `.prototype` we freeze. Curated to the common poisoning targets.
const INTRINSICS = [
  Object, Array, Function, String, Number, Boolean, Symbol, BigInt,
  Promise, RegExp, Date, Map, Set, WeakMap, WeakSet, Error,
]

function hardenEnabled() {
  try { if (globalThis.localStorage?.getItem('fw:harden') === '1') return true } catch { /* no storage */ }
  try { if (import.meta.env?.VITE_FW_HARDEN === 'true') return true } catch { /* no import.meta */ }
  return false
}

let applied = false

/**
 * Freeze the well-known intrinsic prototypes. No-op unless enabled (see above) or
 * `force` is passed. Idempotent.
 * @returns {false | string[]} false if skipped, else the names of frozen intrinsics.
 */
export function hardenIntrinsics({ force = false } = {}) {
  if (applied) return false
  if (!force && !hardenEnabled()) return false
  applied = true
  const frozen = []
  for (const C of INTRINSICS) {
    try {
      if (C && C.prototype) { Object.freeze(C.prototype); frozen.push(C.name) }
    } catch { /* some environments disallow freezing a given intrinsic — skip it */ }
  }
  return frozen
}
