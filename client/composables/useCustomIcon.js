import { API_BASE, API_V } from '~/lib/api-config.js'

const FS_PREVIEW_BASE = `${API_BASE}/_api/${API_V}/fs/preview`

// Dolphin/KDE folder color names → CSS color values.
// Falling back to the raw name as a CSS color lets any valid CSS named color work too.
const FOLDER_COLORS = {
  red:           '#e53935',
  pink:          '#e91e63',
  purple:        '#9c27b0',
  violet:        '#7c3aed',
  indigo:        '#3f51b5',
  blue:          '#1e88e5',
  cyan:          '#00acc1',
  teal:          '#00897b',
  green:         '#43a047',
  lime:          '#c0ca33',
  yellow:        '#f9a825',
  amber:         '#ffb300',
  orange:        '#fb8c00',
  'deep-orange': '#e64a19',
  brown:         '#6d4c41',
  grey:          '#757575',
  gray:          '#757575',
  'blue-grey':   '#546e7a',
  black:         '#212121',
  white:         '#f5f5f5',
}

/**
 * Resolves a directory customization icon string into an action descriptor.
 * Returns null when no actionable customization is present.
 *
 * Descriptor types:
 *   { type: 'url', url }             — load image from this URL (absolute path icons)
 *   { type: 'folder-color', color }  — tint the default folder SVG with this CSS color
 */
export function resolveCustomIcon(iconStr) {
  if (!iconStr) return null

  // Absolute filesystem path → serve via the fs/preview endpoint
  if (iconStr.startsWith('/') || iconStr.startsWith('~/')) {
    return { type: 'url', url: `${FS_PREVIEW_BASE}?path=${encodeURIComponent(iconStr)}` }
  }

  // Dolphin color variant: "folder-violet", "folder-open-red", etc.
  // Restrict to known palette entries so XDG icon theme names like "folder-android"
  // are not misinterpreted as folder colors (they should fall through to the icon pack).
  const m = iconStr.match(/^folder(?:-open)?-(.+)$/)
  if (m && m[1] in FOLDER_COLORS) {
    return { type: 'folder-color', color: FOLDER_COLORS[m[1]] }
  }

  return null
}
