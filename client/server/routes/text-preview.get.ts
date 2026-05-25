import { existsSync, statSync, readFileSync } from 'node:fs'
import { readFile } from 'node:fs/promises'
import { resolve } from 'node:path'

const DEFAULT_MAX_BYTES = 10_000

function loadMaxPreviewBytes(): number {
  try {
    const configDir = resolve(process.cwd(), '..', 'config', 'preferences')
    const defaults = JSON.parse(readFileSync(resolve(configDir, 'default-preferences.json'), 'utf-8'))
    const userPath = resolve(configDir, 'user-preferences.json')
    const user = existsSync(userPath)
      ? JSON.parse(readFileSync(userPath, 'utf-8') || '{}')
      : {}
    return user?.preview?.maxPreviewBytes ?? defaults?.preview?.maxPreviewBytes ?? DEFAULT_MAX_BYTES
  } catch {
    return DEFAULT_MAX_BYTES
  }
}

export default defineEventHandler(async (event) => {
  const query = getQuery(event)
  const filePath = query.path as string
  const force = query.force === 'true'

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

  const maxBytes = loadMaxPreviewBytes()

  if (!force && stats.size > maxBytes) {
    return { kind: 'tooLarge', fileSize: stats.size, maxBytes }
  }

  const raw = await readFile(filePath)

  let text: string
  let encoding: string

  try {
    text = new TextDecoder('utf-8', { fatal: true }).decode(raw)
    encoding = 'utf-8'
  } catch {
    text = new TextDecoder('latin1').decode(raw)
    encoding = 'latin-1'
  }

  return {
    text,
    encoding,
    fileSize: stats.size,
  }
})
