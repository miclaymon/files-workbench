<template>
  <div class="markdown-preview" @click="onClick">
    <div class="markdown-body" v-html="html" />
  </div>
</template>

<script setup>
import { computed } from 'vue'
import MarkdownIt from 'markdown-it'
import { previewUrl } from './utils.js'

// Rendered-document view of a markdown file. `html:false` makes markdown-it drop raw
// HTML / <script> from the source, so its output is safe to inject with v-html (no
// sanitizer needed); `linkify` auto-links bare URLs. Relative image sources are
// rewritten to the media endpoint against the file's directory so local images load.
const props = defineProps({
  text: { type: String, default: '' },
  item: { type: Object, default: null },   // { path, name } — for relative image resolution
})

const md = new MarkdownIt({ html: false, linkify: true, breaks: false, typographer: true })

const isExternal = (src) => /^(?:https?:|data:|blob:|mailto:|\/\/)/i.test(src)
function dirOf(path) {
  if (!path) return ''
  const i = Math.max(path.lastIndexOf('/'), path.lastIndexOf('\\'))
  return i > 0 ? path.slice(0, i) : ''
}

// Rewrite relative image srcs to the served file (absolute paths and external URLs
// pass through). The file's directory rides in markdown-it's `env`.
const defaultImageRule = md.renderer.rules.image ?? ((t, i, o, e, s) => s.renderToken(t, i, o))
md.renderer.rules.image = (tokens, idx, options, env, self) => {
  const token = tokens[idx]
  const si = token.attrIndex('src')
  if (si >= 0) {
    const src = token.attrs[si][1]
    if (src && env?.dir && !isExternal(src) && !src.startsWith('/')) {
      token.attrs[si][1] = previewUrl(`${env.dir}/${src.replace(/^\.\//, '')}`)
    }
  }
  return defaultImageRule(tokens, idx, options, env, self)
}

const html = computed(() => md.render(props.text ?? '', { dir: dirOf(props.item?.path) }))

// Links must not navigate the SPA away: open external links in a new tab / the OS,
// smooth-scroll in-page anchors, ignore anything else.
function onClick(e) {
  const a = e.target.closest?.('a')
  if (!a) return
  const href = a.getAttribute('href') ?? ''
  e.preventDefault()
  if (href.startsWith('#')) {
    document.getElementById(decodeURIComponent(href.slice(1)))?.scrollIntoView({ behavior: 'smooth' })
  } else if (href) {
    window.open(href, '_blank', 'noopener,noreferrer')
  }
}
</script>

<style scoped>
.markdown-preview {
  height: 100%;
  overflow: auto;
  user-select: text;
}

.markdown-body {
  max-width: 900px;
  margin: 0 auto;
  padding: 24px 28px 64px;
  color: var(--text, #d4d4d4);
  font-size: 14px;
  line-height: 1.6;
  word-wrap: break-word;
}

.markdown-body :deep(h1),
.markdown-body :deep(h2),
.markdown-body :deep(h3),
.markdown-body :deep(h4),
.markdown-body :deep(h5),
.markdown-body :deep(h6) {
  margin: 1.4em 0 0.6em;
  font-weight: 600;
  line-height: 1.25;
  color: var(--text, #e8e8e8);
}
.markdown-body :deep(h1) { font-size: 1.9em; padding-bottom: 0.3em; border-bottom: 1px solid var(--border); }
.markdown-body :deep(h2) { font-size: 1.5em; padding-bottom: 0.3em; border-bottom: 1px solid var(--border); }
.markdown-body :deep(h3) { font-size: 1.25em; }
.markdown-body :deep(h4) { font-size: 1.05em; }
.markdown-body :deep(> :first-child) { margin-top: 0; }

.markdown-body :deep(p),
.markdown-body :deep(ul),
.markdown-body :deep(ol),
.markdown-body :deep(blockquote),
.markdown-body :deep(table) { margin: 0 0 1em; }

.markdown-body :deep(a) { color: var(--accent, #4aa3ff); text-decoration: none; }
.markdown-body :deep(a:hover) { text-decoration: underline; }

.markdown-body :deep(ul),
.markdown-body :deep(ol) { padding-left: 1.6em; }
.markdown-body :deep(li) { margin: 0.25em 0; }
.markdown-body :deep(li > input[type="checkbox"]) { margin-right: 0.4em; }

.markdown-body :deep(code) {
  font-family: var(--mono-font, ui-monospace, 'Cascadia Code', Menlo, monospace);
  font-size: 0.88em;
  background: var(--code-bg, rgba(255,255,255,0.08));
  padding: 0.15em 0.4em;
  border-radius: 4px;
}
.markdown-body :deep(pre) {
  background: var(--code-bg, rgba(255,255,255,0.06));
  border: 1px solid var(--border);
  border-radius: 6px;
  padding: 12px 14px;
  overflow: auto;
  margin: 0 0 1em;
}
.markdown-body :deep(pre code) { background: none; padding: 0; font-size: 0.85em; line-height: 1.5; }

.markdown-body :deep(blockquote) {
  padding: 0.2em 1em;
  color: var(--text-muted);
  border-left: 3px solid var(--border);
}

.markdown-body :deep(table) { border-collapse: collapse; display: block; overflow: auto; }
.markdown-body :deep(th),
.markdown-body :deep(td) { border: 1px solid var(--border); padding: 6px 12px; }
.markdown-body :deep(th) { background: var(--hover-background, rgba(255,255,255,0.04)); font-weight: 600; }

.markdown-body :deep(img) { max-width: 100%; border-radius: 4px; }
.markdown-body :deep(hr) { border: none; border-top: 1px solid var(--border); margin: 1.6em 0; }
</style>
