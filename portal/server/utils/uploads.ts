import path from 'node:path'
import { fileURLToPath } from 'node:url'

const currentDir = path.dirname(fileURLToPath(import.meta.url))
const portalRoot = path.resolve(currentDir, '..', '..')

const isWindowsDriveAbsolute = (value: string) => /^[a-zA-Z]:[\\/]/.test(value)
const isUncPath = (value: string) => value.startsWith('\\\\')

export const resolveUploadsRoot = () => {
  const custom = process.env.UPLOADS_DIR?.trim()
  if (custom) {
    if (
      process.platform === 'win32' &&
      (custom.startsWith('/') || custom.startsWith('\\')) &&
      !isWindowsDriveAbsolute(custom) &&
      !isUncPath(custom)
    ) {
      const sanitized = custom.replace(/^[/\\]+/, '')
      return path.resolve(portalRoot, sanitized)
    }
    return path.isAbsolute(custom) ? custom : path.resolve(portalRoot, custom)
  }
  return path.join(portalRoot, 'uploads')
}
