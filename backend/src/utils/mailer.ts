import {
  buildInvitationEmail,
  sendTemplatedEmail,
  writeOutboxPreview
} from '@coreit/email-kit'
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import type { OrganisationMemberRole } from '../types/domain.js'
import { getEffectiveEmailProviderProfile } from '../services/emailProviders.js'
import { outboxDir } from './outbox.js'

const DEFAULT_PORTAL_URL = 'http://localhost:3000'

const acceptBaseUrl = (process.env.INVITE_ACCEPT_BASE_URL || DEFAULT_PORTAL_URL).replace(/\/$/, '')

/**
 * Hittar en logotyp baserat på organisationens ID genom att söka i uploads/logos
 */
async function findLogoByOrgId(organisationId: string): Promise<string | null> {
  try {
    const currentDir = path.dirname(fileURLToPath(import.meta.url))
    const backendRoot = path.resolve(currentDir, '..', '..')
    const uploadsDir = process.env.UPLOADS_DIR || path.join(backendRoot, 'uploads')
    const logosDirBackend = path.join(uploadsDir, 'logos')
    const frontendUploadsDir = path.join(backendRoot, '..', 'frontend', 'uploads', 'logos')

    // Försök i backend först
    if (fs.existsSync(logosDirBackend)) {
      const files = fs.readdirSync(logosDirBackend)
      const matchingFile = files.find((file) => file.startsWith(`${organisationId}-`))
      if (matchingFile) {
        const filePath = path.join(logosDirBackend, matchingFile)
        const fileBuffer = fs.readFileSync(filePath)
        const extension = path.extname(matchingFile).toLowerCase()
        const mimeTypes: Record<string, string> = {
          '.png': 'image/png',
          '.jpg': 'image/jpeg',
          '.jpeg': 'image/jpeg',
          '.svg': 'image/svg+xml',
          '.webp': 'image/webp'
        }
        const mimeType = mimeTypes[extension] || 'image/png'
        const base64 = fileBuffer.toString('base64')
        console.log('[mailer] Found logo by org ID in backend:', matchingFile)
        return `data:${mimeType};base64,${base64}`
      }
    }

    // Försök i frontend
    if (fs.existsSync(frontendUploadsDir)) {
      const files = fs.readdirSync(frontendUploadsDir)
      const matchingFile = files.find((file) => file.startsWith(`${organisationId}-`))
      if (matchingFile) {
        const filePath = path.join(frontendUploadsDir, matchingFile)
        const fileBuffer = fs.readFileSync(filePath)
        const extension = path.extname(matchingFile).toLowerCase()
        const mimeTypes: Record<string, string> = {
          '.png': 'image/png',
          '.jpg': 'image/jpeg',
          '.jpeg': 'image/jpeg',
          '.svg': 'image/svg+xml',
          '.webp': 'image/webp'
        }
        const mimeType = mimeTypes[extension] || 'image/png'
        const base64 = fileBuffer.toString('base64')
        console.log('[mailer] Found logo by org ID in frontend:', matchingFile)
        return `data:${mimeType};base64,${base64}`
      }
    }

    console.warn('[mailer] No logo found for organisation:', organisationId)
    return null
  } catch (error) {
    console.error('[mailer] Failed to find logo by org ID:', error)
    return null
  }
}

/**
 * Konverterar en logotyp-URL till base64-data URI för användning i e-post.
 * Detta krävs eftersom e-postklienter ofta blockerar externa bilder.
 */
async function convertLogoToDataUri(
  logoUrl: string | null | undefined,
  organisationId?: string
): Promise<string | null> {
  if (!logoUrl) return null

  try {
    // Om det redan är en data URI, returnera som den är
    if (logoUrl.startsWith('data:')) {
      return logoUrl
    }

    // Extrahera filnamnet från URL:en
    let filename: string | null = null
    if (logoUrl.includes('/api/uploads/logos/')) {
      const parts = logoUrl.split('/api/uploads/logos/')
      if (parts.length > 1) {
        filename = path.basename(parts[1].split('?')[0])
      }
    } else if (logoUrl.includes('uploads/logos/')) {
      const parts = logoUrl.split('uploads/logos/')
      if (parts.length > 1) {
        filename = path.basename(parts[1].split('?')[0])
      }
    } else if (logoUrl.includes('/uploads/logos/')) {
      const parts = logoUrl.split('/uploads/logos/')
      if (parts.length > 1) {
        filename = path.basename(parts[1].split('?')[0])
      }
    }

    if (!filename || filename === '/' || filename === '') {
      console.warn('[mailer] Could not extract filename from logo URL:', logoUrl)
      // Om vi har organisationId, försök hitta filen direkt
      if (organisationId) {
        console.log('[mailer] Trying to find logo by organisation ID:', organisationId)
        return await findLogoByOrgId(organisationId)
      }
      return null
    }

    console.log('[mailer] Extracted filename from URL:', filename)

    // Hitta filen på disk (backend använder backend/uploads/logos)
    const currentDir = path.dirname(fileURLToPath(import.meta.url))
    const backendRoot = path.resolve(currentDir, '..', '..')
    const uploadsDir = process.env.UPLOADS_DIR || path.join(backendRoot, 'uploads')
    const logosDir = path.join(uploadsDir, 'logos')
    const filePath = path.join(logosDir, filename)

    console.log('[mailer] Looking for logo file at:', filePath)
    console.log('[mailer] Logos dir exists:', fs.existsSync(logosDir))
    if (fs.existsSync(logosDir)) {
      const files = fs.readdirSync(logosDir)
      console.log('[mailer] Files in backend logos dir:', files)
    }

    if (!fs.existsSync(filePath)) {
      // Försök också i frontend/uploads om backend inte hittar den
      const frontendUploadsDir = path.join(backendRoot, '..', 'frontend', 'uploads', 'logos')
      const frontendFilePath = path.join(frontendUploadsDir, filename)
      console.log('[mailer] Trying frontend path:', frontendFilePath)
      console.log('[mailer] Frontend logos dir exists:', fs.existsSync(frontendUploadsDir))
      if (fs.existsSync(frontendUploadsDir)) {
        const files = fs.readdirSync(frontendUploadsDir)
        console.log('[mailer] Files in frontend logos dir:', files)
      }
      if (fs.existsSync(frontendFilePath)) {
        console.log('[mailer] Found logo in frontend directory')
        const fileBuffer = fs.readFileSync(frontendFilePath)
        const extension = path.extname(filename).toLowerCase()
        const mimeTypes: Record<string, string> = {
          '.png': 'image/png',
          '.jpg': 'image/jpeg',
          '.jpeg': 'image/jpeg',
          '.svg': 'image/svg+xml',
          '.webp': 'image/webp'
        }
        const mimeType = mimeTypes[extension] || 'image/png'
        const base64 = fileBuffer.toString('base64')
        return `data:${mimeType};base64,${base64}`
      }
      console.warn('[mailer] Logo file not found in backend or frontend:', filePath, frontendFilePath)
      // Om vi har organisationId, försök hitta filen direkt
      if (organisationId) {
        console.log('[mailer] Trying to find logo by organisation ID as fallback')
        return await findLogoByOrgId(organisationId)
      }
      return null
    }

    // Läs filen och konvertera till base64
    const fileBuffer = fs.readFileSync(filePath)
    const extension = path.extname(filename).toLowerCase()
    const mimeTypes: Record<string, string> = {
      '.png': 'image/png',
      '.jpg': 'image/jpeg',
      '.jpeg': 'image/jpeg',
      '.svg': 'image/svg+xml',
      '.webp': 'image/webp'
    }

    const mimeType = mimeTypes[extension] || 'image/png'
    const base64 = fileBuffer.toString('base64')
    return `data:${mimeType};base64,${base64}`
  } catch (error) {
    console.error('[mailer] Failed to convert logo to data URI:', error)
    return null
  }
}

interface InvitationEmailInput {
  to: string
  role: OrganisationMemberRole
  organisationId: string
  organisationName: string
  invitedBy: string
  expiresAt: number
  token: string
  organisationLogo?: string | null
}

export async function sendInvitationEmail(input: InvitationEmailInput) {
  const link = `${acceptBaseUrl}/invite/accept?token=${encodeURIComponent(input.token)}`
  const provider = await getEffectiveEmailProviderProfile(input.organisationId)
  const expiresAtLabel = new Date(input.expiresAt).toLocaleString('sv-SE')
  
  // Konvertera logotyp till base64-data URI för e-post
  const logoUrl = input.organisationLogo || provider?.branding?.logoUrl
  
  console.log('[mailer] Logo URL from input:', input.organisationLogo)
  console.log('[mailer] Logo URL from provider:', provider?.branding?.logoUrl)
  console.log('[mailer] Final logo URL:', logoUrl)
  console.log('[mailer] Organisation ID:', input.organisationId)
  
  const logoDataUri = await convertLogoToDataUri(logoUrl, input.organisationId)
  
  console.log('[mailer] Logo data URI created:', logoDataUri ? 'Yes (length: ' + logoDataUri.length + ')' : 'No')
  if (!logoDataUri) {
    console.warn('[mailer] Failed to convert logo to data URI. Logo URL was:', logoUrl)
  }
  
  const branding =
    provider?.branding || logoDataUri
      ? {
          ...(provider?.branding ?? {}),
          ...(logoDataUri ? { logoUrl: logoDataUri } : {})
        }
      : undefined
  const content = buildInvitationEmail({
    organisationName: input.organisationName,
    invitedBy: input.invitedBy,
    role: input.role,
    expiresAt: expiresAtLabel,
    acceptUrl: link,
    branding
  })

  if (provider) {
    const delivery = await sendTemplatedEmail({
      profile: provider,
      to: [{ email: input.to }],
      content,
      dryRunOutboxDir: outboxDir
    })
    return { link, delivery }
  }

  const storedAt = await writeOutboxPreview(
    {
      to: [{ email: input.to }],
      subject: content.subject,
      html: content.html,
      text: content.text,
      meta: {
        reason: 'missing-provider',
        organisationId: input.organisationId
      }
    },
    outboxDir
  )
  return { link, storedAt }
}
