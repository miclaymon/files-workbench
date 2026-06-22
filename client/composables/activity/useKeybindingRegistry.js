import { reactive } from 'vue'

// ── Keybinding registry ──────────────────────────────────────────────────────
//
// Maps keyboard chords to command ids. Like the command registry it is dynamic —
// activities (and plugins) contribute bindings through the facade and each
// registration returns a disposer. The dispatcher (useWorkbenchKeyboard) resolves
// a keydown to a chord and runs the bound command; no behaviour lives here.
//
// Binding shape:
//   key          chord string, e.g. 'ctrl+shift+p', 'delete', 'ctrl+1'. Modifier
//                order is irrelevant; 'cmd'/'meta' fold to 'ctrl' so one binding
//                covers macOS too.
//   command      command id to execute
//   args?        extra args forwarded to the command's run()
//   when(ctx)?   binding-level predicate (ctx = the activity host)
//   allowInInput when true the binding still fires while an input / textarea /
//                contenteditable is focused (default: suppressed)
export function createKeybindingRegistry({ log = () => {} } = {}) {
  const byChord = reactive(new Map())   // normalized chord → binding[]

  function register(binding) {
    if (!binding?.key || !binding?.command) {
      throw new Error('[keybindings] register() needs { key, command }')
    }
    const chord = normalizeChord(binding.key)
    const entry = { ...binding, chord }
    const arr = byChord.get(chord) ?? []
    arr.push(entry)
    byChord.set(chord, arr)
    // Disposer removes only this binding, leaving other bindings on the same chord.
    return () => {
      const a = byChord.get(chord)
      if (!a) return
      const i = a.indexOf(entry)
      if (i >= 0) a.splice(i, 1)
      if (a.length === 0) byChord.delete(chord)
    }
  }

  function forChord(chord) { return byChord.get(chord) ?? [] }
  function list() { return [...byChord.values()].flat() }

  return { register, forChord, list, normalizeChord }
}

// Canonicalize a chord: lowercase, fold cmd/meta→ctrl and option→alt, and order
// modifiers ctrl→alt→shift so registration order is irrelevant. The dispatcher
// builds event chords in this same canonical form, so lookups match directly.
export function normalizeChord(key) {
  const parts = String(key).toLowerCase().split('+').map(s => s.trim()).filter(Boolean)
  const mods = new Set()
  let base = ''
  for (const p of parts) {
    if (p === 'ctrl' || p === 'control' || p === 'cmd' || p === 'meta' || p === 'command') mods.add('ctrl')
    else if (p === 'alt' || p === 'option') mods.add('alt')
    else if (p === 'shift') mods.add('shift')
    else base = p
  }
  return [...['ctrl', 'alt', 'shift'].filter(m => mods.has(m)), base].filter(Boolean).join('+')
}
