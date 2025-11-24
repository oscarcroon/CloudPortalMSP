import { Router } from 'express'
import type { Request } from 'express'
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import multer from 'multer'
import { eq } from 'drizzle-orm'
import { db } from '../db/client.js'
import { organisationsTable } from '../db/schema.js'
import { currentOrgId, ensurePermission } from '../utils/authz.js'

const LOGO_FIELD = 'logo'
const MAX_FILE_SIZE_BYTES = 2 * 1024 * 1024
const ALLOWED_EXTENSIONS = new Set(['.png', '.jpg', '.jpeg', '.svg', '.webp'])
const ALLOWED_MIME_TYPES = new Set([
  'image/png',
  'image/jpeg',
  'image/jpg',
  'image/svg+xml',
  'image/webp'
])

const currentDir = path.dirname(fileURLToPath(import.meta.url))
const backendRoot = path.resolve(currentDir, '..', '..')
const uploadsRoot = path.join(backendRoot, 'uploads')
const logoUploadDir = path.join(uploadsRoot, 'logos')
fs.mkdirSync(logoUploadDir, { recursive: true })

const storage = multer.diskStorage({
  destination: (_req, _file, cb) => {
    cb(null, logoUploadDir)
  },
  filename: (req, file, cb) => {
    const extension = getSafeExtension(file.originalname)
    const orgId = req.params.organisationId || 'organisation'
    const filename = `${orgId}-${Date.now()}${extension}`
    cb(null, filename)
  }
})

const upload = multer({
  storage,
  limits: {
    fileSize: MAX_FILE_SIZE_BYTES
  },
  fileFilter: (_req, file, cb) => {
    const extension = getSafeExtension(file.originalname)
    if (!ALLOWED_EXTENSIONS.has(extension) || !ALLOWED_MIME_TYPES.has(file.mimetype)) {
      cb(new Error('Unsupported file type. Allowed formats: .jpg, .png, .svg, .webp'))
      return
    }
    cb(null, true)
  }
})

const singleLogoUpload = upload.single(LOGO_FIELD)

export const organisationsRouter = Router()

organisationsRouter.get('/', (req, res) => {
  if (!ensurePermission(req, res, 'org:read')) {
    return
  }
  const organisationId = currentOrgId(req)
  const result = organisationId ? organisations.filter((org) => org.id === organisationId) : []
  res.json(result)
})

organisationsRouter.post('/:organisationId/logo', async (req, res) => {
  if (!ensurePermission(req, res, 'org:manage')) {
    return
  }
  const organisationId = currentOrgId(req)
  if (req.params.organisationId !== organisationId) {
    res.status(403).json({ message: 'Cannot upload logo for this organisation' })
    return
  }
  singleLogoUpload(req, res, async (error) => {
    if (error) {
      const message =
        error instanceof multer.MulterError && error.code === 'LIMIT_FILE_SIZE'
          ? 'Logo must be 2MB or smaller.'
          : error.message || 'Failed to upload logo.'
      res.status(400).json({ message })
      return
    }

    const { organisationId } = req.params
    const organisation = await db
      .select()
      .from(organisationsTable)
      .where(eq(organisationsTable.id, organisationId))
      .get()

    if (!organisation) {
      if (req.file?.path) {
        removeFile(req.file.path)
      }
      res.status(404).json({ message: 'Organisation not found.' })
      return
    }

    if (!req.file) {
      res.status(400).json({ message: 'Logo file is required.' })
      return
    }

    deleteExistingLogo(organisation.logoUrl)

    const logoUrl = buildLogoUrl(req, req.file.path)

    await db
      .update(organisationsTable)
      .set({ logoUrl, updatedAt: new Date() })
      .where(eq(organisationsTable.id, organisationId))

    res.json({ logoUrl })
  })
})

function getSafeExtension(filename: string) {
  const extension = path.extname(filename).toLowerCase()
  return extension || '.png'
}

function buildLogoUrl(req: Request, absolutePath: string) {
  const relativePath = path.relative(uploadsRoot, absolutePath).replace(/\\/g, '/')
  const baseUrl = process.env.PUBLIC_BASE_URL || `${req.protocol}://${req.get('host')}`
  return `${baseUrl}/uploads/${relativePath}`
}

function deleteExistingLogo(logoUrl?: string) {
  if (!logoUrl) return

  try {
    const parsedUrl = new URL(logoUrl)
    const relativePath = parsedUrl.pathname.replace(/^\/+/, '')
    if (!relativePath.startsWith('uploads/')) {
      return
    }
    const filePath = path.join(uploadsRoot, relativePath.replace(/^uploads\//, ''))
    if (fs.existsSync(filePath)) {
      fs.unlinkSync(filePath)
    }
  } catch (error) {
    console.warn('Failed to delete previous logo', error)
  }
}

function removeFile(absolutePath: string) {
  try {
    if (fs.existsSync(absolutePath)) {
      fs.unlinkSync(absolutePath)
    }
  } catch (error) {
    console.warn('Failed to cleanup uploaded logo', error)
  }
}

