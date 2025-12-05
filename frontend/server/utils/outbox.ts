import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const currentDir = path.dirname(fileURLToPath(import.meta.url))

const resolveUploadsRoot = () => {
  const custom = process.env.UPLOADS_DIR
  if (custom) {
    return path.isAbsolute(custom) ? custom : path.resolve(process.cwd(), custom)
  }
  const repoRoot = path.resolve(currentDir, '..', '..', '..')
  return path.join(repoRoot, 'uploads')
}

const uploadsRoot = resolveUploadsRoot()
export const outboxDir = path.join(uploadsRoot, 'outbox')

fs.mkdirSync(outboxDir, { recursive: true })

