import {
  buildInvitationEmail,
  buildPasswordResetEmail,
  renderBrandedTemplate,
  sendTemplatedEmail,
  writeOutboxPreview
} from '@coreit/email-kit'
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { eq } from 'drizzle-orm'
import { getEffectiveEmailSenderContext } from '~~/server/utils/emailProvider'
import { outboxDir } from './outbox'
import { resolveBrandingChain, resolveGlobalBranding } from '~~/server/utils/branding'
import { organizations } from '~~/server/database/schema'
import { getDb } from './db'
import { renderMarkdown } from '~~/shared/markdown'

const DEFAULT_PORTAL_URL = 'http://localhost:3000'

const portalBaseUrl = (
  process.env.PASSWORD_RESET_BASE_URL ||
  process.env.PORTAL_BASE_URL ||
  process.env.NUXT_PUBLIC_APP_URL ||
  DEFAULT_PORTAL_URL
).replace(/\/$/, '')

const inviteBaseUrl = (
  process.env.INVITE_ACCEPT_BASE_URL ||
  process.env.PORTAL_BASE_URL ||
  process.env.NUXT_PUBLIC_APP_URL ||
  DEFAULT_PORTAL_URL
).replace(/\/$/, '')

const htmlEscapeMap: Record<string, string> = {
  '&': '&amp;',
  '<': '&lt;',
  '>': '&gt;',
  '"': '&quot;',
  "'": '&#39;'
}

const escapeHtml = (value: string) => value.replace(/[&<>"']/g, (char) => htmlEscapeMap[char] ?? char)

interface FooterOptions {
  disclaimerMarkdown?: string | null
  supportContact?: string | null
}

const buildFooterContent = (options: FooterOptions) => {
  const htmlParts: string[] = []
  const textParts: string[] = []

  if (options.disclaimerMarkdown) {
    const rendered = renderMarkdown(options.disclaimerMarkdown)
    if (rendered.html) {
      htmlParts.push(rendered.html)
    }
    if (rendered.text) {
      textParts.push(rendered.text)
    }
  }

  if (options.supportContact?.trim()) {
    const contact = options.supportContact.trim()
    htmlParts.push(
      `<p style="margin:0;">${escapeHtml(contact)}</p>`
    )
    textParts.push(contact)
  }

  return {
    html: htmlParts.join(
      '<hr style="border:none;border-top:1px solid rgba(148,163,184,0.35);margin:12px 0;" />'
    ),
    text: textParts.join('\n\n')
  }
}

const formatSubject = (subject: string, prefix?: string | null) => {
  if (!prefix) return subject
  const trimmed = prefix.trim()
  if (!trimmed) return subject
  return `${trimmed} ${subject}`.trim()
}

export const fetchOrganizationDisclaimer = async (organizationId?: string | null) => {
  if (!organizationId) return null
  try {
    const db = getDb()
    const [record] = await db
      .select({ disclaimer: organizations.emailDisclaimerMarkdown })
      .from(organizations)
      .where(eq(organizations.id, organizationId))
      .limit(1)
    return record?.disclaimer ?? null
  } catch (error) {
    console.warn('[mailer] Failed to load organization disclaimer', error)
    return null
  }
}

/**
 * Hittar en logotyp baserat på organisationens ID genom att söka i uploads/logos
 */
async function findLogoByOrgId(organisationId: string): Promise<string | null> {
  try {
    const currentDir = path.dirname(fileURLToPath(import.meta.url))
    const frontendRoot = path.resolve(currentDir, '..', '..')
    const uploadsDir = process.env.UPLOADS_DIR || path.join(frontendRoot, 'uploads')
    const logosDir = path.join(uploadsDir, 'logos')

    if (!fs.existsSync(logosDir)) {
      console.warn('[mailer] Logos directory does not exist:', logosDir)
      return null
    }

    // Sök efter filer som matchar organisationId
    // Nya filer har formatet: organization-{orgId}-{variant}-{timestamp}.{ext}
    // Gamla filer kan ha formatet: {orgId}-{timestamp}.{ext}
    // Prioritera nya filer (organization-*) över gamla
    const files = fs.readdirSync(logosDir)
    const newFormatFile = files.find((file) => file.startsWith(`organization-${organisationId}-`))
    const matchingFile =
      newFormatFile ?? files.find((file) => file.startsWith(`${organisationId}-`))

    if (!matchingFile) {
      console.warn('[mailer] No logo found for organisation:', organisationId)
      console.log('[mailer] Available files:', files)
      return null
    }

    const filePath = path.join(logosDir, matchingFile)
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
    console.log('[mailer] Found logo by org ID:', matchingFile)
    return `data:${mimeType};base64,${base64}`
  } catch (error) {
    console.error('[mailer] Failed to find logo by org ID:', error)
    return null
  }
}

export const buildPortalUrl = (pathname: string) => {
  if (!pathname) return portalBaseUrl
  return `${portalBaseUrl}${pathname.startsWith('/') ? pathname : `/${pathname}`}`
}

const buildInviteAcceptUrl = (token: string) =>
  `${inviteBaseUrl}/invite/accept?token=${encodeURIComponent(token)}`

/**
 * Konverterar en logotyp-URL till base64-data URI för användning i e-post.
 * Detta krävs eftersom e-postklienter ofta blockerar externa bilder.
 */
async function convertLogoToDataUri(
  logoUrl: string | null | undefined,
  organisationId?: string
): Promise<string | null> {
  if (!logoUrl) {
    console.log('[mailer] No logo URL provided')
    return null
  }

  try {
    // Om det redan är en data URI, returnera som den är
    if (logoUrl.startsWith('data:')) {
      console.log('[mailer] Logo is already a data URI')
      return logoUrl
    }

    console.log('[mailer] Converting logo URL to data URI:', logoUrl)

    // Extrahera filnamnet från URL:en
    let filename: string | null = null
    
    // Hantera olika URL-format
    if (logoUrl.includes('/api/uploads/logos/')) {
      const parts = logoUrl.split('/api/uploads/logos/')
      if (parts.length > 1 && parts[1]) {
        const segment = parts[1].split('?')[0] ?? parts[1]
        filename = path.basename(segment)
      }
    } else if (logoUrl.includes('uploads/logos/')) {
      const parts = logoUrl.split('uploads/logos/')
      if (parts.length > 1 && parts[1]) {
        const segment = parts[1].split('?')[0] ?? parts[1]
        filename = path.basename(segment)
      }
    } else if (logoUrl.includes('/uploads/logos/')) {
      const parts = logoUrl.split('/uploads/logos/')
      if (parts.length > 1 && parts[1]) {
        const segment = parts[1].split('?')[0] ?? parts[1]
        filename = path.basename(segment)
      }
    } else {
      // Försök extrahera från URL pathname
      try {
        const urlObj = new URL(logoUrl)
        const urlPath = urlObj.pathname
        if (urlPath.includes('logos/')) {
          const part = urlPath.split('logos/')[1]
          filename = part ? path.basename(part) : null
        } else {
          filename = path.basename(urlPath)
        }
      } catch {
        // Om det inte är en giltig URL, försök behandla det som ett filnamn
        filename = path.basename(logoUrl)
      }
    }

    if (!filename || filename === '/' || filename === '' || filename === logoUrl) {
      console.warn('[mailer] Could not extract filename from logo URL:', logoUrl)
      // Om vi har organisationId, försök hitta filen direkt
      if (organisationId) {
        console.log('[mailer] Trying to find logo by organisation ID:', organisationId)
        return await findLogoByOrgId(organisationId)
      }
      return null
    }

    console.log('[mailer] Extracted filename:', filename)

    // Hitta filen på disk (samma sökväg som branding.ts)
    const currentDir = path.dirname(fileURLToPath(import.meta.url))
    const frontendRoot = path.resolve(currentDir, '..', '..')
    const uploadsDir = process.env.UPLOADS_DIR || path.join(frontendRoot, 'uploads')
    const logosDir = path.join(uploadsDir, 'logos')
    const filePath = path.join(logosDir, filename)

    console.log('[mailer] Looking for logo file:', filePath)
    console.log('[mailer] Logos dir exists:', fs.existsSync(logosDir))
    console.log('[mailer] Frontend root:', frontendRoot)
    console.log('[mailer] Uploads dir:', uploadsDir)
    
    if (fs.existsSync(logosDir)) {
      const files = fs.readdirSync(logosDir)
      console.log('[mailer] Files in logos dir:', files)
    } else {
      console.warn('[mailer] Logos directory does not exist:', logosDir)
    }

    if (!fs.existsSync(filePath)) {
      console.warn('[mailer] Logo file not found:', filePath)
      console.warn('[mailer] Logo URL was:', logoUrl)
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

interface EmailBrandingOptions {
  organizationId?: string
  tenantId?: string
  overrideLogoUrl?: string | null
  disclaimerMarkdown?: string | null
  supportContact?: string | null
  isDarkMode?: boolean
}

interface EmailBranding {
  logoUrl?: string
  accentColor?: string
  backgroundColor?: string
  logoBackgroundColor?: string
  isDarkMode: boolean
  footerText?: string
  footerTextPlain?: string
}

export async function resolveEmailBranding(options: EmailBrandingOptions = {}) {
  const resolution = options.organizationId
    ? await resolveBrandingChain({ organizationId: options.organizationId })
    : options.tenantId
      ? await resolveBrandingChain({ tenantId: options.tenantId })
      : await resolveGlobalBranding()

  const theme = resolution.activeTheme
  const logoSource =
    options.overrideLogoUrl ??
    theme.logoUrl ??
    theme.appLogoLightUrl ??
    theme.appLogoDarkUrl ??
    null
  const logoDataUri = await convertLogoToDataUri(logoSource, options.organizationId)

  const branding: EmailBranding = {
    logoUrl: logoDataUri ?? logoSource ?? undefined,
    accentColor: theme.accentColor ?? undefined,
    backgroundColor: undefined, // Bakgrunden på e-postet ändras baserat på dark mode
    logoBackgroundColor: theme.navBackgroundColor ?? undefined, // Bakgrunden bakom loggan använder NavBar-färgen
    isDarkMode: options.isDarkMode === true
  }
  const footer = buildFooterContent({
    disclaimerMarkdown: options.disclaimerMarkdown,
    supportContact: options.supportContact
  })
  if (footer.html) {
    branding.footerText = footer.html
    if (footer.text) {
      branding.footerTextPlain = footer.text
    }
  }

  if (!branding.logoUrl && !branding.accentColor && !branding.backgroundColor && !footer.html) {
    return undefined
  }

  return branding
}

export const sendPasswordResetEmail = async (input: {
  to: string
  token: string
  expiresAt: number
}) => {
  const resetUrl = `${buildPortalUrl('/reset-password')}?token=${encodeURIComponent(input.token)}`
  const expiresLabel = new Date(input.expiresAt).toLocaleString('sv-SE')
  const senderContext = await getEffectiveEmailSenderContext()
  const provider = senderContext.profile
  const branding = await resolveEmailBranding({
    supportContact: senderContext.supportContact,
    isDarkMode: senderContext.emailDarkMode
  })

  const content = buildPasswordResetEmail({
    resetUrl,
    expiresAt: expiresLabel,
    branding
  })
  const finalContent = {
    ...content,
    subject: formatSubject(content.subject, senderContext.subjectPrefix)
  }

  if (provider) {
    const delivery = await sendTemplatedEmail({
      profile: provider,
      to: [{ email: input.to }],
      content: finalContent,
      dryRunOutboxDir: outboxDir
    })
    return { resetUrl, delivery }
  }

  const storedAt = await writeOutboxPreview(
    {
      to: [{ email: input.to }],
      subject: finalContent.subject,
      html: finalContent.html,
      text: finalContent.text,
      meta: { reason: 'missing-global-provider' }
    },
    outboxDir
  )
  console.info(`[mail] Password reset email for ${input.to} stored at ${storedAt}`)
  return { resetUrl, storedAt }
}

export const sendInvitationEmail = async (input: {
  organisationId: string
  organisationName: string
  invitedBy: string
  role: string
  to: string
  expiresAt: number
  token: string
  organisationLogo?: string | null
}) => {
  const acceptUrl = buildInviteAcceptUrl(input.token)
  const expiresLabel = new Date(input.expiresAt).toLocaleString('sv-SE')
  const senderContext = await getEffectiveEmailSenderContext(input.organisationId)
  const provider = senderContext.profile
  const disclaimerMarkdown = await fetchOrganizationDisclaimer(input.organisationId)
  const branding = await resolveEmailBranding({
    organizationId: input.organisationId,
    overrideLogoUrl: input.organisationLogo ?? null,
    disclaimerMarkdown,
    supportContact: senderContext.supportContact,
    isDarkMode: senderContext.emailDarkMode
  })
  const content = buildInvitationEmail({
    organisationName: input.organisationName,
    invitedBy: input.invitedBy,
    role: input.role,
    expiresAt: expiresLabel,
    acceptUrl,
    branding
  })
  const finalContent = {
    ...content,
    subject: formatSubject(content.subject, senderContext.subjectPrefix)
  }

  if (provider) {
    const delivery = await sendTemplatedEmail({
      profile: provider,
      to: [{ email: input.to }],
      content: finalContent,
      dryRunOutboxDir: outboxDir
    })
    return { acceptUrl, delivery }
  }

  const storedAt = await writeOutboxPreview(
    {
      to: [{ email: input.to }],
      subject: finalContent.subject,
      html: finalContent.html,
      text: finalContent.text,
      meta: {
        reason: 'missing-provider',
        organisationId: input.organisationId
      }
    },
    outboxDir
  )
  console.info(`[mail] Invitation email for ${input.to} stored at ${storedAt}`)
  return { acceptUrl, storedAt }
}

export const sendInviteAcceptedNotification = async (input: {
  organisationId: string
  organisationName: string
  invitedByEmail: string
  memberEmail: string
  memberName?: string | null
  role: string
}) => {
  const senderContext = await getEffectiveEmailSenderContext(input.organisationId)
  const provider = senderContext.profile
  const disclaimerMarkdown = await fetchOrganizationDisclaimer(input.organisationId)
  const branding = await resolveEmailBranding({
    organizationId: input.organisationId,
    disclaimerMarkdown,
    supportContact: senderContext.supportContact,
    isDarkMode: senderContext.emailDarkMode
  })

  const content = renderBrandedTemplate(
    {
      pretitle: 'Inbjudan accepterad',
      title: input.organisationName,
      intro: 'Hej!',
      body: [
        `${input.memberName ?? input.memberEmail} har accepterat din inbjudan.`,
        `E-post: ${input.memberEmail}`,
        `Roll: ${input.role}`
      ],
      outro: ['Du kan nu hantera personen under Inställningar → Medlemmar.']
    },
    branding
  )
  const finalContent = {
    ...content,
    subject: formatSubject(content.subject, senderContext.subjectPrefix)
  }

  if (provider) {
    return sendTemplatedEmail({
      profile: provider,
      to: [{ email: input.invitedByEmail }],
      content: finalContent,
      dryRunOutboxDir: outboxDir
    })
  }

  const storedAt = await writeOutboxPreview(
    {
      to: [{ email: input.invitedByEmail }],
      subject: finalContent.subject,
      html: finalContent.html,
      text: finalContent.text,
      meta: {
        reason: 'missing-provider',
        organisationId: input.organisationId,
        type: 'invite-accepted'
      }
    },
    outboxDir
  )
  console.info(`[mail] Invite accepted notification for ${input.invitedByEmail} stored at ${storedAt}`)
  return { storedAt }
}

export const sendDistributorInvitationEmail = async (input: {
  willCreateOrganization?: boolean
  organizationName?: string
  tenantId: string
  tenantName: string
  tenantType: 'provider' | 'distributor'
  to: string
  expiresAt: number
  token: string
  invitedBy?: string
}) => {
  const acceptUrl = buildInviteAcceptUrl(input.token)
  const expiresLabel = new Date(input.expiresAt).toLocaleString('sv-SE')
  const senderContext = await getEffectiveEmailSenderContext({ tenantId: input.tenantId })
  const provider = senderContext.profile
  const branding = await resolveEmailBranding({
    tenantId: input.tenantId,
    supportContact: senderContext.supportContact,
    isDarkMode: senderContext.emailDarkMode
  })

  const tenantTypeLabel = input.tenantType === 'provider' ? 'Leverantör' : 'Distributör'
  const bodyLines = [
    `Grattis! Du har blivit utsedd till ${tenantTypeLabel.toLowerCase()} för ${input.tenantName}!`,
    `Detta är ett stort ansvar och vi är glada att ha dig med oss.`,
    `Inbjudan är giltig till ${expiresLabel}.`
  ]
  
  if (input.willCreateOrganization && input.organizationName) {
    bodyLines.push(
      '',
      `När du slutför registreringen kommer organisationen "${input.organizationName}" att skapas åt dig automatiskt.`
    )
  }
  
  const content = renderBrandedTemplate(
    {
      pretitle: `Grattis! Du är nu ${tenantTypeLabel}! 🎉`,
      title: input.tenantName,
      intro: 'Hej!',
      body: bodyLines,
      action: { label: 'Acceptera inbjudan', url: acceptUrl },
      outro: [
        'Med denna roll får du hantera och administrera alla organisationer under din distributör.',
        'Om du inte förväntade dig mejlet kan du ignorera det.'
      ]
    },
    branding
  )
  const finalContent = {
    ...content,
    subject: formatSubject(
      `Grattis! Du är nu ${tenantTypeLabel} för ${input.tenantName}!`,
      senderContext.subjectPrefix
    )
  }

  if (provider) {
    const delivery = await sendTemplatedEmail({
      profile: provider,
      to: [{ email: input.to }],
      content: finalContent,
      dryRunOutboxDir: outboxDir
    })
    return { acceptUrl, delivery }
  }

  const storedAt = await writeOutboxPreview(
    {
      to: [{ email: input.to }],
      subject: finalContent.subject,
      html: finalContent.html,
      text: finalContent.text,
      meta: {
        reason: 'missing-provider',
        tenantId: input.tenantId,
        type: 'distributor-invitation'
      }
    },
    outboxDir
  )
  console.info(`[mail] Distributor invitation email for ${input.to} stored at ${storedAt}`)
  return { acceptUrl, storedAt }
}

export const sendDistributorConfirmationEmail = async (input: {
  tenantId: string
  tenantName: string
  tenantType: 'provider' | 'distributor'
  to: string
  invitedBy?: string
}) => {
  const portalUrl = buildPortalUrl('/admin/tenants')
  const senderContext = await getEffectiveEmailSenderContext({ tenantId: input.tenantId })
  const provider = senderContext.profile
  const branding = await resolveEmailBranding({
    tenantId: input.tenantId,
    supportContact: senderContext.supportContact,
    isDarkMode: senderContext.emailDarkMode
  })

  const tenantTypeLabel = input.tenantType === 'provider' ? 'Leverantör' : 'Distributör'
  const content = renderBrandedTemplate(
    {
      pretitle: `Grattis! Du är nu ${tenantTypeLabel}!`,
      title: input.tenantName,
      intro: 'Hej!',
      body: [
        `Grattis! Du har nu fått rollen som ${tenantTypeLabel.toLowerCase()} för ${input.tenantName}! 🎊`,
        `Detta är ett stort ansvar och vi är glada att ha dig med oss.`,
        `Med denna roll får du hantera och administrera alla organisationer under din ${tenantTypeLabel.toLowerCase()}.`
      ],
      action: { label: 'Öppna portalen', url: portalUrl },
      outro: [
        'Du kan nu logga in och börja hantera din distributör.',
        'Om du inte förväntade dig mejlet kan du ignorera det.'
      ]
    },
    branding
  )
  const finalContent = {
    ...content,
    subject: formatSubject(
      `Grattis! Du är nu ${tenantTypeLabel} för ${input.tenantName}!`,
      senderContext.subjectPrefix
    )
  }

  if (provider) {
    const delivery = await sendTemplatedEmail({
      profile: provider,
      to: [{ email: input.to }],
      content: finalContent,
      dryRunOutboxDir: outboxDir
    })
    return { delivery }
  }

  const storedAt = await writeOutboxPreview(
    {
      to: [{ email: input.to }],
      subject: finalContent.subject,
      html: finalContent.html,
      text: finalContent.text,
      meta: {
        reason: 'missing-provider',
        tenantId: input.tenantId,
        type: 'distributor-confirmation'
      }
    },
    outboxDir
  )
  console.info(`[mail] Distributor confirmation email for ${input.to} stored at ${storedAt}`)
  return { storedAt }
}