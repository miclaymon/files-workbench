import { onMounted, onUnmounted } from 'vue'

// ── Global keyboard shortcuts ─────────────────────────────────────────────────
// A generic keybinding dispatcher: it normalizes each keydown into a chord string
// and runs the command bound to that chord. Bindings and commands both live in
// the activity host's registries (contributed by Workbench and activities), so
// this slice owns no shortcut logic itself — it only translates keys to commands.
//
// Two cross-cutting rules preserved from the original hardcoded handler:
//   • most shortcuts are ignored while typing in an input / textarea /
//     contenteditable; a binding opts out with `allowInInput` (the command
//     palette and settings do).
//   • a matched binding preventDefaults even if its command is currently a no-op,
//     so the browser's native shortcut never leaks through.
export function useWorkbenchKeyboard({ host }) {
  const { commands } = host.facade
  const keybindings = host.keybindings

  function isEditable(el) {
    const tag = el?.tagName
    return tag === 'INPUT' || tag === 'TEXTAREA' || !!el?.isContentEditable
  }

  // Build a canonical chord ('ctrl+shift+p', 'delete', 'ctrl+1') from the event,
  // matching the registry's normalizeChord ordering (ctrl→alt→shift) and folding
  // meta→ctrl so macOS Cmd shortcuts resolve to the same bindings.
  function chordFromEvent(e) {
    const k = e.key
    if (!k || k === 'Control' || k === 'Shift' || k === 'Alt' || k === 'Meta') return null
    const parts = []
    if (e.ctrlKey || e.metaKey) parts.push('ctrl')
    if (e.altKey) parts.push('alt')
    if (e.shiftKey) parts.push('shift')
    parts.push(k.toLowerCase())
    return parts.join('+')
  }

  function onKeyDown(e) {
    const chord = chordFromEvent(e)
    if (!chord) return
    const editable = isEditable(e.target)
    for (const b of keybindings.forChord(chord)) {
      if (editable && !b.allowInInput) continue
      if (b.when && !b.when(host)) continue
      e.preventDefault()
      commands.execute(b.command, ...(b.args ?? []))
      return
    }
  }

  onMounted(() => window.addEventListener('keydown', onKeyDown))
  onUnmounted(() => window.removeEventListener('keydown', onKeyDown))
}
