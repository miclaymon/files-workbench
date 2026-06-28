import { EXT_LANGUAGE, TEXT_APP_MIMES } from './utils.js'
import { MEDIA_BASE as API_BASE } from '~/lib/api-config.js'

// ── Preview loading ────────────────────────────────────────────────────────────
// Pure fetch + MIME→preview resolution for a single item, shared by the Preview
// panel (multi/single in the side bar) and the Preview editor tab. Callers own
// their own reactive state / caching; these functions only fetch and classify.
//
// A preview descriptor is { kind, ...payload }:
//   text     { kind:'text',  text, language }
//   html     { kind:'html',  text, language:'html' }
//   image|video|audio  { kind }           (the component fetches the media by path)
//   tooLarge { kind:'tooLarge', fileSize, maxBytes }
//   binary | error     { kind }

// Fetch a text/preview payload for `path`. `force` bypasses the server's size cap.
export async function fetchTextContent(path, force = false) {
  const base = import.meta.env.DEV ? '/text-preview' : `${API_BASE}/fs/preview`
  const params = new URLSearchParams({ path })
  if (force) params.set('force', 'true')
  const res = await fetch(`${base}?${params}`)
  return res.ok ? res.json() : null
}

// Classify an item (given its fetched metadata) into a preview descriptor.
async function resolvePreview(item, metadata) {
  const mime = metadata.mime_type ?? ''
  const ext = item.name.split('.').pop()?.toLowerCase() ?? ''
  const language = EXT_LANGUAGE[ext]
  const isHtmlPage = ext === 'html' || ext === 'htm' || ext === 'xhtml'

  if (isHtmlPage) {
    const textData = await fetchTextContent(item.path)
    return textData?.kind === 'tooLarge'
      ? { ...textData, language: 'html' }
      : { kind: 'html', text: textData?.text ?? '', language: 'html' }
  }
  if (language) {
    const textData = await fetchTextContent(item.path)
    if (textData?.kind === 'tooLarge') return { ...textData, language }
    return textData ? { kind: 'text', text: textData.text, language } : { kind: 'binary' }
  }
  if (mime.startsWith('image/')) return { kind: 'image' }
  if (mime.startsWith('video/')) return { kind: 'video' }
  if (mime.startsWith('audio/')) return { kind: 'audio' }
  if (mime.startsWith('text/') || TEXT_APP_MIMES.has(mime)) {
    const lang = mime.split('/')[1]?.replace(/^x-/, '') || 'plaintext'
    const textData = await fetchTextContent(item.path)
    if (textData?.kind === 'tooLarge') return { ...textData, language: lang }
    return textData ? { kind: 'text', text: textData.text, language: lang } : { kind: 'binary' }
  }
  return { kind: 'binary' }
}

// Load metadata + classify in one call. Returns { preview, metadata }; on any
// failure returns { preview: { kind: 'error' }, metadata: null }.
export async function loadPreview(item) {
  try {
    const response = await fetch(`${API_BASE}/metadata?path=${encodeURIComponent(item.path)}`)
    if (!response.ok) return { preview: { kind: 'error' }, metadata: null }
    const metadata = await response.json()
    const preview = await resolvePreview(item, metadata)
    return { preview, metadata }
  } catch {
    return { preview: { kind: 'error' }, metadata: null }
  }
}

// Re-fetch text past the size cap (the "load anyway" path for tooLarge text).
// Returns a text descriptor, or null when still unavailable. `fallbackLang` keeps
// the previously-resolved language when the extension isn't in EXT_LANGUAGE.
export async function forceLoadText(item, fallbackLang) {
  const data = await fetchTextContent(item.path, true)
  if (!data || data.kind === 'tooLarge') return null
  const ext = item.name.split('.').pop()?.toLowerCase() ?? ''
  const lang = EXT_LANGUAGE[ext] ?? fallbackLang ?? 'plaintext'
  return { kind: 'text', text: data.text, language: lang }
}
