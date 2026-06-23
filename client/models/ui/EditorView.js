import { View } from './View.js'

// An editor surface. The same EditorView can be presented as a tab in the editor
// grid or as a floating modal — "Open in Main Window" simply flips `presentation`
// from 'modal' to 'tab'. `kind` is the runtime tab-kind the persisted tab carries.
export class EditorView extends View {
  /** @param {import('./View.js').ViewOptions & { kind?: string, presentation?: 'tab'|'modal' }} opts */
  constructor(opts = {}) {
    super({ ...opts, location: opts.location ?? 'Editor' })
    this.kind         = opts.kind ?? null
    this.presentation = opts.presentation ?? 'tab'
  }

  get surface() { return this.presentation === 'modal' ? 'modal' : 'editor' }
}
