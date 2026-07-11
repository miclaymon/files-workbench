import { MEDIA_BASE as API_BASE } from '@fw/sdk'

export const EXT_LANGUAGE = {
  js: 'javascript', mjs: 'javascript', cjs: 'javascript', jsx: 'javascript',
  ts: 'typescript', tsx: 'typescript',
  css: 'css', scss: 'scss', sass: 'scss', less: 'less',
  html: 'html', htm: 'html', xhtml: 'html',
  vue: 'html', svelte: 'html',
  xml: 'xml',
  json: 'json', jsonc: 'json', json5: 'json',
  yaml: 'yaml', yml: 'yaml',
  toml: 'ini',
  md: 'markdown', mdx: 'markdown', markdown: 'markdown',
  txt: 'plaintext', csv: 'plaintext', log: 'plaintext',
  py: 'python',
  rb: 'ruby',
  php: 'php',
  go: 'go',
  rs: 'rust',
  java: 'java',
  c: 'c', h: 'c',
  cpp: 'cpp', cc: 'cpp', cxx: 'cpp', hpp: 'cpp',
  cs: 'csharp',
  swift: 'swift',
  kt: 'kotlin',
  sh: 'shell', bash: 'shell', zsh: 'shell', fish: 'shell',
  sql: 'sql',
  graphql: 'graphql', gql: 'graphql',
  r: 'r',
  lua: 'lua',
  ini: 'ini', cfg: 'ini', conf: 'ini', env: 'shell',
  dockerfile: 'dockerfile',
}

export const TEXT_APP_MIMES = new Set([
  'application/json', 'application/ld+json',
  'application/javascript',
  'application/xml',
  'application/yaml',
  'application/graphql',
  'application/x-sh', 'application/x-python', 'application/x-ruby',
])

// An item is previewable when it's a real file (has path + name and isn't a
// directory). Shared by the panel's list filter and the "Open in Editor Tab"
// action so both agree on what can be previewed.
export function isPreviewable(item) {
  return !!(item?.path && item?.name && item?.kind !== 'dir' && item?.kind !== 'directory')
}

// Archives have no inline preview (their content is a virtual directory browsed in
// the Explorer, not rendered here). Used to gate the "Open in Editor Tab" action.
const ARCHIVE_EXTS = new Set(['zip', 'tar', 'gz', 'bz2', 'xz', '7z', 'rar', 'tgz', 'tbz2', 'txz'])

// Whether an item can open as a Preview editor tab: a previewable file that isn't
// an archive or directory (those have no meaningful single-pane preview).
export function isPreviewTabbable(item) {
  if (!isPreviewable(item)) return false
  const ext = item.name.split('.').pop()?.toLowerCase() ?? ''
  return !ARCHIVE_EXTS.has(ext)
}

// Whether an item is a markdown document (gates the rendered-preview editor actions).
export function isMarkdown(item) {
  const ext = item?.name?.split('.').pop()?.toLowerCase() ?? ''
  return ext === 'md' || ext === 'mdx' || ext === 'markdown'
}

// Image/video extensions the server can thumbnail (matches the directory grid).
const THUMB_IMAGE_EXTS = new Set(['png', 'jpg', 'jpeg', 'webp', 'gif', 'bmp', 'ico', 'avif'])
const THUMB_VIDEO_EXTS = new Set(['mp4', 'webm', 'mkv', 'avi', 'mov', 'm4v', 'flv', 'wmv', 'ts', 'mpeg', 'mpg', 'm2ts'])

// A small thumbnail URL to use as an item's icon, when it's an image or video the
// server can thumbnail; null otherwise (caller falls back to a file-type icon).
// Images use the /image endpoint (resized original); videos use /thumbnail.
export function thumbnailIconUrl(item, size = 64) {
  const ext = item?.name?.split('.').pop()?.toLowerCase() ?? ''
  if (THUMB_IMAGE_EXTS.has(ext)) return `${API_BASE}/image?path=${encodeURIComponent(item.path)}&size=${size}`
  if (THUMB_VIDEO_EXTS.has(ext)) return `${API_BASE}/thumbnail?path=${encodeURIComponent(item.path)}&size=${size}`
  return null
}

// The single item shown in single-item mode: the focused item when it's a
// previewable file, else the most-recently selected previewable item. Mirrors
// the panel's single-mode selection so the editor-tab action opens the same item.
export function singlePreviewable(selectedItems, focusedItem) {
  if (focusedItem?.path && focusedItem.kind !== 'dir' && focusedItem.kind !== 'directory') return focusedItem
  return (selectedItems ?? []).filter(isPreviewable).at(-1) ?? null
}

export function formatBytes(bytes) {
  if (!bytes || bytes === 0) return '—'
  const units = ['B', 'KB', 'MB', 'GB']
  let i = 0, b = bytes
  while (b >= 1024 && i < units.length - 1) { b /= 1024; i++ }
  return `${b.toFixed(i === 0 ? 0 : 1)} ${units[i]}`
}

export function previewUrl(path) {
  const base = import.meta.env.DEV ? '/media-preview' : `${API_BASE}/preview`
  return `${base}?path=${encodeURIComponent(path)}`
}

export function thumbnailUrl(path) {
  return `${API_BASE}/image?path=${encodeURIComponent(path)}&size=64`
}
