// esbuild loader: compile a plugin's own `.vue` single-file components to JS using the
// already-present @vue/compiler-sfc (no extra dependency).
//
// Uses the STANDARD two-step compilation — `compileScript` (with binding metadata) plus
// a SEPARATE `compileTemplate` — exactly like @vitejs/plugin-vue. This matters: the host
// app is compiled by Vite the same way, and a plugin component rendered inside a
// Vite-compiled (block-optimized) parent must produce a matching block/fragment/anchor
// structure. The earlier `inlineTemplate` shortcut diverged there and corrupted the DOM
// (`__vnode`/`nextSibling` null) for multi-root components in the host tree.
//
// hoistStatic/cacheHandlers are off to match Vite's dev compiler.
const fs = require('fs/promises')
const path = require('path')
const crypto = require('crypto')
const { parse, compileScript, compileTemplate, compileStyle } = require('@vue/compiler-sfc')

function vueSfc() {
  return {
    name: 'vue-sfc',
    setup(build) {
      build.onLoad({ filter: /\.vue$/ }, async (args) => {
        const src = await fs.readFile(args.path, 'utf8')
        const { descriptor } = parse(src, { filename: args.path })
        const id = crypto.createHash('sha1').update(args.path).digest('hex').slice(0, 8)
        const scopeId = `data-v-${id}`
        const hasScoped = descriptor.styles.some((s) => s.scoped)

        // 1. <script>/<script setup> → a named const (so we can augment it), with the
        //    binding metadata the template compiler needs to resolve setup bindings.
        const script = compileScript(descriptor, { id, genDefaultAs: '__sfc_main' })
        let code = script.content + '\n'

        // 2. <template> → a separate `render` function, compiled with the script's
        //    binding metadata + the same scopeId, then attached to the component.
        if (descriptor.template) {
          const tpl = compileTemplate({
            source: descriptor.template.content,
            filename: args.path,
            id,
            scoped: hasScoped,
            slotted: descriptor.slotted,
            compilerOptions: {
              bindingMetadata: script.bindings,
              scopeId: hasScoped ? scopeId : undefined,
              hoistStatic: false,
              cacheHandlers: false,
            },
          })
          code += tpl.code + '\n'
          code += '__sfc_main.render = render\n'
        }

        // 3. Scoped/plain styles → injected once at load (browser only; no-op in Node).
        let css = ''
        for (const style of descriptor.styles) {
          const r = compileStyle({ source: style.content, filename: args.path, id, scoped: style.scoped })
          css += r.code
        }
        if (css) {
          code +=
            'if (typeof document !== "undefined") {' +
            'const __s = document.createElement("style");' +
            '__s.textContent = ' + JSON.stringify(css) + ';' +
            'document.head.appendChild(__s);}\n'
        }
        if (hasScoped) code += `__sfc_main.__scopeId = ${JSON.stringify(scopeId)}\n`
        code += 'export default __sfc_main\n'

        return { contents: code, loader: 'js', resolveDir: path.dirname(args.path) }
      })
    },
  }
}

module.exports = { vueSfc }
