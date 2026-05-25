import { createReadStream, existsSync, statSync } from 'node:fs'
import { extname } from 'node:path'

const MIME_TYPES: Record<string, string> = {
  // Images
  '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg', '.png': 'image/png',
  '.gif': 'image/gif', '.webp': 'image/webp', '.bmp': 'image/bmp',
  '.ico': 'image/x-icon', '.avif': 'image/avif', '.svg': 'image/svg+xml',
  // Video
  '.mp4': 'video/mp4', '.webm': 'video/webm', '.mov': 'video/quicktime',
  '.mkv': 'video/x-matroska', '.avi': 'video/x-msvideo',
  // Audio
  '.mp3': 'audio/mpeg', '.wav': 'audio/wav', '.flac': 'audio/flac',
  '.ogg': 'audio/ogg', '.aac': 'audio/aac',
  // Text / code — needed so iframe and fetch() get the right Content-Type
  '.html': 'text/html', '.htm': 'text/html', '.xhtml': 'text/html',
  '.css': 'text/css',
  '.js': 'text/javascript', '.mjs': 'text/javascript', '.cjs': 'text/javascript',
  '.ts': 'text/typescript', '.tsx': 'text/typescript', '.jsx': 'text/javascript',
  '.json': 'application/json', '.jsonc': 'application/json',
  '.xml': 'application/xml',
  '.yaml': 'text/yaml', '.yml': 'text/yaml',
  '.md': 'text/markdown', '.markdown': 'text/markdown',
  '.txt': 'text/plain', '.csv': 'text/csv',
  '.sh': 'text/x-sh', '.bash': 'text/x-sh', '.zsh': 'text/x-sh', '.fish': 'text/x-sh',
  '.py': 'text/x-python',
  '.rb': 'text/x-ruby',
  '.php': 'text/x-php',
  '.go': 'text/x-go',
  '.rs': 'text/x-rust',
  '.java': 'text/x-java',
  '.c': 'text/x-csrc', '.h': 'text/x-csrc',
  '.cpp': 'text/x-c++src', '.cc': 'text/x-c++src', '.cxx': 'text/x-c++src', '.hpp': 'text/x-c++src',
  '.cs': 'text/x-csharp',
  '.swift': 'text/x-swift',
  '.kt': 'text/x-kotlin',
  '.sql': 'text/x-sql',
  '.graphql': 'application/graphql', '.gql': 'application/graphql',
  '.vue': 'text/html', '.svelte': 'text/html',
  '.toml': 'text/x-toml',
  '.ini': 'text/x-ini', '.cfg': 'text/x-ini', '.conf': 'text/x-ini',
  '.r': 'text/x-r',
  '.lua': 'text/x-lua',
}

export default defineEventHandler(async (event) => {
  const query = getQuery(event)
  const filePath = query.path as string

  if (!filePath || typeof filePath !== 'string') {
    throw createError({ statusCode: 400, statusMessage: 'path required' })
  }

  if (!existsSync(filePath)) {
    throw createError({ statusCode: 404, statusMessage: 'File not found' })
  }

  const stats = statSync(filePath)
  if (!stats.isFile()) {
    throw createError({ statusCode: 400, statusMessage: 'Not a file' })
  }

  const mimeType = MIME_TYPES[extname(filePath).toLowerCase()] ?? 'application/octet-stream'

  setHeaders(event, {
    'Content-Type': mimeType,
    'Content-Length': String(stats.size),
    'Accept-Ranges': 'bytes',
    'Cache-Control': 'no-store',
  })

  return sendStream(event, createReadStream(filePath))
})
