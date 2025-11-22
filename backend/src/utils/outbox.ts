import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const currentDir = path.dirname(fileURLToPath(import.meta.url))
const uploadsRoot = path.resolve(currentDir, '..', '..', 'uploads')
export const outboxDir = path.join(uploadsRoot, 'outbox')

fs.mkdirSync(outboxDir, { recursive: true })

