import { MEDIA_BASE as API_BASE } from '~/lib/api-config.js'

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
