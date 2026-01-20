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
 * Om det finns flera filer, väljer den den senaste (högsta timestamp i filnamnet)
 */
async function findLogoByOrgId(organisationId: string): Promise<string | null> {
  try {
    const currentDir = path.dirname(fileURLToPath(import.meta.url))
    const backendRoot = path.resolve(currentDir, '..', '..')
    
    // Använd samma sökvägslogik som convertLogoToDataUri
    let logosDirPrimary: string
    let logosDirFallback: string
    
    if (process.env.UPLOADS_DIR) {
      logosDirPrimary = path.join(process.env.UPLOADS_DIR, 'logos')
      logosDirFallback = path.join(backendRoot, 'uploads', 'logos')
    } else {
      // Försök först i frontend/uploads/logos (där filerna faktiskt sparas)
      const frontendRoot = path.resolve(backendRoot, '..', 'frontend')
      logosDirPrimary = path.join(frontendRoot, 'uploads', 'logos')
      logosDirFallback = path.join(backendRoot, 'uploads', 'logos')
    }

    // Hjälpfunktion för att hitta den senaste filen
    const findLatestMatchingFile = (files: string[], prefix: string): string | null => {
      const matchingFiles = files.filter((file) => file.startsWith(prefix))
      if (matchingFiles.length === 0) return null
      
      // Om det bara finns en fil, returnera den
      if (matchingFiles.length === 1) return matchingFiles[0]
      
      // Sortera filer efter timestamp i filnamnet (format: org-id-timestamp.ext)
      // Extrahera timestamp från filnamnet och sortera fallande (senaste först)
      const sorted = matchingFiles.sort((a, b) => {
        const extractTimestamp = (filename: string): number => {
          // Filnamn format: org-id-timestamp.ext
          const parts = filename.replace(/\.[^.]+$/, '').split('-')
          const timestamp = parts[parts.length - 1]
          return parseInt(timestamp, 10) || 0
        }
        return extractTimestamp(b) - extractTimestamp(a) // Fallande ordning (senaste först)
      })
      
      console.log('[mailer] Found multiple logo files for', organisationId, ':', matchingFiles)
      console.log('[mailer] Using latest:', sorted[0])
      return sorted[0]
    }

    // Försök i primär katalog först
    if (fs.existsSync(logosDirPrimary)) {
      const files = fs.readdirSync(logosDirPrimary)
      const matchingFile = findLatestMatchingFile(files, `${organisationId}-`)
      if (matchingFile) {
        const filePath = path.join(logosDirPrimary, matchingFile)
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
        console.log('[mailer] Found logo by org ID in primary dir:', matchingFile)
        return `data:${mimeType};base64,${base64}`
      }
    }

    // Fallback: försök i backend/uploads om primär katalog inte hittar den
    if (fs.existsSync(logosDirFallback)) {
      const files = fs.readdirSync(logosDirFallback)
      const matchingFile = findLatestMatchingFile(files, `${organisationId}-`)
      if (matchingFile) {
        const filePath = path.join(logosDirFallback, matchingFile)
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
        console.log('[mailer] Found logo by org ID in fallback dir:', matchingFile)
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
    console.log('[mailer] Original logo URL:', logoUrl)

    // Hitta filen på disk - använd EXAKT samma logik som vid uppladdning
    const currentDir = path.dirname(fileURLToPath(import.meta.url))
    const backendRoot = path.resolve(currentDir, '..', '..')
    const projectRoot = path.resolve(backendRoot, '..')
    
    // Försök hitta filen i flera möjliga platser (i prioritetsordning):
    // 1. UPLOADS_DIR (om satt) - där filerna faktiskt sparas
    // 2. Gå upp från projektets root och leta efter uploads/logos (för att hitta C:\Users\croons\Documents\_dev\uploads\logos\)
    // 3. Projektets root/uploads/logos (fallback)
    // 4. Frontend uploads dir (fallback)
    // 5. Backend uploads dir (fallback)
    const possiblePaths: Array<{ path: string; name: string }> = []
    
    // Först: UPLOADS_DIR (där filerna faktiskt sparas enligt loggen)
    if (process.env.UPLOADS_DIR) {
      const uploadsDirPath = path.join(process.env.UPLOADS_DIR, 'logos', filename)
      possiblePaths.push({ path: uploadsDirPath, name: 'UPLOADS_DIR' })
      console.log('[mailer] Trying UPLOADS_DIR path:', uploadsDirPath)
    }
    
    // Andra: Gå upp från projektets root och leta efter uploads/logos
    // Detta hittar C:\Users\croons\Documents\_dev\uploads\logos\ om projektet ligger i customerPortal_dev\CloudPortalMSP
    let parentDir = projectRoot
    for (let i = 0; i < 3; i++) {
      parentDir = path.resolve(parentDir, '..')
      const parentUploadsDir = path.join(parentDir, 'uploads', 'logos', filename)
      if (fs.existsSync(path.dirname(parentUploadsDir))) {
        possiblePaths.push({ path: parentUploadsDir, name: `parent-${i}/uploads` })
        console.log('[mailer] Trying parent uploads path:', parentUploadsDir)
      }
    }
    
    // Tredje: Projektets root/uploads/logos
    const projectUploadsDir = path.join(projectRoot, 'uploads', 'logos', filename)
    possiblePaths.push({ path: projectUploadsDir, name: 'project root/uploads' })
    console.log('[mailer] Trying project root/uploads path:', projectUploadsDir)
    
    // Fjärde: Frontend uploads dir
    const frontendRoot = path.resolve(backendRoot, '..', 'frontend')
    const frontendUploadsDir = path.join(frontendRoot, 'uploads', 'logos', filename)
    possiblePaths.push({ path: frontendUploadsDir, name: 'frontend/uploads' })
    console.log('[mailer] Trying frontend uploads path:', frontendUploadsDir)
    
    // Femte: Backend uploads dir
    const backendUploadsDir = path.join(backendRoot, 'uploads', 'logos', filename)
    possiblePaths.push({ path: backendUploadsDir, name: 'backend/uploads' })
    console.log('[mailer] Trying backend uploads path:', backendUploadsDir)
    
    // Hitta första sökväg där filen finns
    let filePath: string | null = null
    let logosDir: string | null = null
    for (const test of possiblePaths) {
      if (fs.existsSync(test.path)) {
        filePath = test.path
        logosDir = path.dirname(test.path)
        console.log('[mailer] ✓ Found logo file at:', test.path, `(${test.name})`)
        break
      } else {
        console.log('[mailer] ✗ File not found at:', test.path, `(${test.name})`)
      }
    }
    
    // Om ingen fil hittades, använd första möjliga sökvägen som primär för loggning
    if (!filePath) {
      logosDir = process.env.UPLOADS_DIR 
        ? path.join(process.env.UPLOADS_DIR, 'logos')
        : path.join(frontendRoot, 'uploads', 'logos')
      filePath = path.join(logosDir, filename)
    }

    // Om filen redan hittades i loopen ovan, läs den direkt
    if (filePath && fs.existsSync(filePath)) {
      console.log('[mailer] ✓ Reading logo file from found location:', filePath)
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
      console.log('[mailer] Successfully converted logo to base64. Filename:', filename, 'Size:', base64.length, 'chars')
      console.log('[mailer] Logo URL used:', logoUrl)
      console.log('[mailer] Organisation ID:', organisationId)
      return `data:${mimeType};base64,${base64}`
    }

    // Om filen inte hittades, logga information om var vi letade
    console.warn('[mailer] ✗ Logo file not found in any of the searched locations')
    console.warn('[mailer] Expected filename:', filename)
    console.warn('[mailer] Logo URL from database:', logoUrl)
    
    // Visa vilka filer som faktiskt finns i de sökta katalogerna
    for (const test of possiblePaths) {
      const testDir = path.dirname(test.path)
      if (fs.existsSync(testDir)) {
        const files = fs.readdirSync(testDir)
        console.log(`[mailer] Files in ${test.name} (${testDir}):`, files)
        if (organisationId) {
          const matchingFiles = files.filter(f => f.includes(organisationId))
          if (matchingFiles.length > 0) {
            console.log(`[mailer] Files matching organisation ID in ${test.name}:`, matchingFiles)
          }
        }
      }
    }
    
    // INTE använd findLogoByOrgId här eftersom det kan hitta fel fil
    // Om filen inte finns, returnera null så att fallback-texten används
    console.warn('[mailer] Could not find logo file. Will use fallback text "CloudPanel"')
    return null
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
  
  // Prioritera organisationLogo från input - använd INTE provider-branding som fallback för logotypen
  // eftersom provider kan komma från en annan organisation eller global profil
  const logoUrl = input.organisationLogo ?? null
  
  console.log('[mailer] ===== Sending invitation email =====')
  console.log('[mailer] Organisation ID:', input.organisationId)
  console.log('[mailer] Organisation Name:', input.organisationName)
  console.log('[mailer] Logo URL from input (organisation.branding?.logoUrl):', input.organisationLogo)
  console.log('[mailer] Logo URL from provider (ignored for logo):', provider?.branding?.logoUrl)
  console.log('[mailer] Final logo URL to use (from input only):', logoUrl)
  
  const logoDataUri = await convertLogoToDataUri(logoUrl, input.organisationId)
  
  console.log('[mailer] Logo data URI result:', logoDataUri ? `Yes (${logoDataUri.substring(0, 50)}...)` : 'No')
  
  console.log('[mailer] Logo data URI created:', logoDataUri ? 'Yes (length: ' + logoDataUri.length + ')' : 'No')
  if (!logoDataUri && logoUrl) {
    console.warn('[mailer] Failed to convert logo to data URI. Logo URL was:', logoUrl)
  }
  
  // Bygg branding: använd provider-branding för andra egenskaper (färger, etc)
  // men använd bara logoDataUri för logotypen (inte provider-branding.logoUrl)
  // Detta säkerställer att vi använder rätt organisations logotyp, inte en från provider-profilen
  const branding = logoDataUri
    ? {
        ...(provider?.branding ?? {}),
        logoUrl: logoDataUri
      }
    : provider?.branding
      ? (() => {
          // Använd provider-branding men ta bort logoUrl eftersom vi inte vill använda den
          // (den kan komma från fel organisation eller global profil)
          const { logoUrl: _, ...brandingWithoutLogo } = provider.branding
          return brandingWithoutLogo
        })()
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

  console.warn(
    `[mailer] Missing effective email provider for organisation ${input.organisationId}. Writing to outbox instead.`
  )
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
