import fs from 'node:fs'
import path from 'node:path'
import { resolveUploadsRoot } from './uploads'

const uploadsRoot = resolveUploadsRoot()
export const outboxDir = path.join(uploadsRoot, 'outbox')

fs.mkdirSync(outboxDir, { recursive: true })

