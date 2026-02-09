import {
  buildInvitationEmail,
  buildPasswordResetEmail,
  renderBrandedTemplate,
  sendTemplatedEmail,
  writeOutboxPreview
} from '@coreit/email-kit'
import fs from 'node:fs'
import path from 'node:path'
import { eq } from 'drizzle-orm'
import { getEffectiveEmailSenderContext } from '~~/server/utils/emailProvider'
import { outboxDir } from './outbox'
import { resolveBrandingChain, resolveGlobalBranding } from '~~/server/utils/branding'
import { organizations } from '~~/server/database/schema'
import { getDb } from './db'
import { renderMarkdown } from '~~/shared/markdown'
import { resolveUploadsRoot } from '~~/server/utils/uploads'

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

type EmailLocale = 'sv' | 'en'

const normalizeEmailLocale = (value?: string | null): EmailLocale => (value === 'en' ? 'en' : 'sv')
const localeToDateString = (timestamp: number, locale: EmailLocale) =>
  new Date(timestamp).toLocaleString(locale === 'en' ? 'en-US' : 'sv-SE')

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
async function findLogoByOrgId(organizationId: string): Promise<string | null> {
  try {
    const uploadsDir = resolveUploadsRoot()
    const logosDir = path.join(uploadsDir, 'logos')

    if (!fs.existsSync(logosDir)) {
      console.warn('[mailer] Logos directory does not exist:', logosDir)
      return null
    }

    // Sök efter filer som matchar organizationId
    // Nya filer har formatet: organization-{orgId}-{variant}-{timestamp}.{ext}
    // Gamla filer kan ha formatet: {orgId}-{timestamp}.{ext}
    // Prioritera nya filer (organization-*) över gamla
    const files = fs.readdirSync(logosDir)
    const newFormatFile = files.find((file) => file.startsWith(`organization-${organizationId}-`))
    const matchingFile =
      newFormatFile ?? files.find((file) => file.startsWith(`${organizationId}-`))

    if (!matchingFile) {
      console.warn('[mailer] No logo found for organization:', organizationId)
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
  organizationId?: string
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
      // Om vi har organizationId, försök hitta filen direkt
      if (organizationId) {
        console.log('[mailer] Trying to find logo by organization ID:', organizationId)
        return await findLogoByOrgId(organizationId)
      }
      return null
    }

    console.log('[mailer] Extracted filename:', filename)

    // Hitta filen på disk (samma sökväg som branding.ts)
    const uploadsDir = resolveUploadsRoot()
    const logosDir = path.join(uploadsDir, 'logos')
    const filePath = path.join(logosDir, filename)

    console.log('[mailer] Looking for logo file:', filePath)
    console.log('[mailer] Logos dir exists:', fs.existsSync(logosDir))
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
      // Om vi har organizationId, försök hitta filen direkt
      if (organizationId) {
        console.log('[mailer] Trying to find logo by organization ID as fallback')
        return await findLogoByOrgId(organizationId)
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
  // Prioritera e-post-specifik logga, sedan falla tillbaka till app-logga
  // Detta möjliggör användning av SVG för app (webbläsare) och PNG/JPG för e-post (Outlook)
  const logoSource =
    options.overrideLogoUrl ??
    theme.emailLogoUrl ??
    theme.logoUrl ??
    theme.appLogoLightUrl ??
    theme.appLogoDarkUrl ??
    null
  
  // Konvertera logo till data URI för e-post
  // OBS: Vi faller INTE tillbaka till logoSource om konverteringen misslyckas,
  // eftersom URL:er inte fungerar i e-postklienter (ger trasiga bilder)
  const logoDataUri = await convertLogoToDataUri(logoSource, options.organizationId)

  const branding: EmailBranding = {
    logoUrl: logoDataUri ?? undefined,
    accentColor: theme.accentColor ?? undefined,
    backgroundColor: undefined, // Bakgrunden på e-postet ändras baserat på dark mode
    logoBackgroundColor: theme.navigationBackgroundColor ?? undefined, // Bakgrunden bakom loggan använder NavBar-färgen
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
  const senderContext = await getEffectiveEmailSenderContext()
  const locale = normalizeEmailLocale(senderContext.emailLanguage)
  const expiresLabel = localeToDateString(input.expiresAt, locale)
  const provider = senderContext.profile
  const branding = await resolveEmailBranding({
    supportContact: senderContext.supportContact,
    isDarkMode: senderContext.emailDarkMode
  })

  const content = buildPasswordResetEmail({
    resetUrl,
    expiresAt: expiresLabel,
    locale,
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
  organizationId: string
  organizationName: string
  invitedBy: string
  role: string
  to: string
  expiresAt: number
  token: string
  organizationLogo?: string | null
}) => {
  const acceptUrl = buildInviteAcceptUrl(input.token)
  const senderContext = await getEffectiveEmailSenderContext(input.organizationId)
  const locale = normalizeEmailLocale(senderContext.emailLanguage)
  const expiresLabel = localeToDateString(input.expiresAt, locale)
  const provider = senderContext.profile
  const disclaimerMarkdown = await fetchOrganizationDisclaimer(input.organizationId)
  const branding = await resolveEmailBranding({
    organizationId: input.organizationId,
    overrideLogoUrl: input.organizationLogo ?? null,
    disclaimerMarkdown,
    supportContact: senderContext.supportContact,
    isDarkMode: senderContext.emailDarkMode
  })
  const content = buildInvitationEmail({
    organisationName: input.organizationName,
    invitedBy: input.invitedBy,
    role: input.role,
    expiresAt: expiresLabel,
    acceptUrl,
    locale,
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
        organizationId: input.organizationId
      }
    },
    outboxDir
  )
  console.info(`[mail] Invitation email for ${input.to} stored at ${storedAt}`)
  return { acceptUrl, storedAt }
}

export const sendOrganizationCreatedEmail = async (input: {
  organizationId: string
  organizationName: string
  createdBy: string
  to: string
  organizationLogo?: string | null
}) => {
  const loginUrl = `${portalBaseUrl}/login`
  const senderContext = await getEffectiveEmailSenderContext(input.organizationId)
  const locale = normalizeEmailLocale(senderContext.emailLanguage)
  const provider = senderContext.profile
  const disclaimerMarkdown = await fetchOrganizationDisclaimer(input.organizationId)
  const branding = await resolveEmailBranding({
    organizationId: input.organizationId,
    overrideLogoUrl: input.organizationLogo ?? null,
    disclaimerMarkdown,
    supportContact: senderContext.supportContact,
    isDarkMode: senderContext.emailDarkMode
  })

  const copy: Record<EmailLocale, {
    subject: string
    pretitle: string
    intro: string
    body: string[]
    buttonLabel: string
    outro: string[]
  }> = {
    sv: {
      subject: `Din organisation "${input.organizationName}" har skapats`,
      pretitle: 'Välkommen!',
      intro: 'Hej!',
      body: [
        `${input.createdBy} har skapat organisationen **${input.organizationName}** åt dig.`,
        'Du är nu ägare av organisationen och kan börja använda portalen direkt.'
      ],
      buttonLabel: 'Logga in',
      outro: ['Välkommen!']
    },
    en: {
      subject: `Your organization "${input.organizationName}" has been created`,
      pretitle: 'Welcome!',
      intro: 'Hi!',
      body: [
        `${input.createdBy} has created the organization **${input.organizationName}** for you.`,
        'You are now the owner of the organization and can start using the portal right away.'
      ],
      buttonLabel: 'Log in',
      outro: ['Welcome!']
    }
  }

  const copyForLocale = copy[locale]
  const content = renderBrandedTemplate(
    {
      locale,
      subject: copyForLocale.subject,
      pretitle: copyForLocale.pretitle,
      title: input.organizationName,
      intro: copyForLocale.intro,
      body: copyForLocale.body,
      action: {
        label: copyForLocale.buttonLabel,
        url: loginUrl
      },
      outro: copyForLocale.outro
    },
    branding
  )
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
    return { loginUrl, delivery }
  }

  const storedAt = await writeOutboxPreview(
    {
      to: [{ email: input.to }],
      subject: finalContent.subject,
      html: finalContent.html,
      text: finalContent.text,
      meta: {
        reason: 'missing-provider',
        organizationId: input.organizationId,
        type: 'organization-created'
      }
    },
    outboxDir
  )
  console.info(`[mail] Organization created email for ${input.to} stored at ${storedAt}`)
  return { loginUrl, storedAt }
}

const buildDelegationAcceptUrl = (token: string) =>
  `${inviteBaseUrl}/invite/delegation?token=${encodeURIComponent(token)}`

export const sendDelegationInvitationEmail = async (input: {
  organizationId: string
  organizationName: string
  invitedBy: string
  permissionCount: number
  to: string
  expiresAt: number
  token?: string | null // Optional - if not provided, no action button will be shown
  note?: string | null
  organizationLogo?: string | null
}) => {
  const acceptUrl = input.token ? buildDelegationAcceptUrl(input.token) : null
  const senderContext = await getEffectiveEmailSenderContext(input.organizationId)
  const locale = normalizeEmailLocale(senderContext.emailLanguage)
  const expiresLabel = localeToDateString(input.expiresAt, locale)
  const provider = senderContext.profile
  const disclaimerMarkdown = await fetchOrganizationDisclaimer(input.organizationId)
  const branding = await resolveEmailBranding({
    organizationId: input.organizationId,
    overrideLogoUrl: input.organizationLogo ?? null,
    disclaimerMarkdown,
    supportContact: senderContext.supportContact,
    isDarkMode: senderContext.emailDarkMode
  })

  const copy: Record<EmailLocale, {
    subject: string
    pretitle: string
    intro: string
    body: string[]
    action: string
    outro: string[]
  }> = {
    sv: {
      subject: input.token 
        ? `Du har bjudits in till ${input.organizationName}`
        : `Du har fått delegerad åtkomst till ${input.organizationName}`,
      pretitle: input.token ? 'Inbjudan till delegerad åtkomst' : 'Delegerad åtkomst',
      intro: 'Hej!',
      body: input.token
        ? [
            `${input.invitedBy} har bjudit in dig till delegerad åtkomst för ${input.organizationName}.`,
            `Du får åtkomst till ${input.permissionCount} behörighet${input.permissionCount === 1 ? '' : 'er'}.`,
            ...(input.note ? [`Meddelande: "${input.note}"`] : []),
            `Inbjudan är giltig till ${expiresLabel}.`
          ]
        : [
            `${input.invitedBy} har gett dig delegerad åtkomst till ${input.organizationName}.`,
            `Du har nu åtkomst till ${input.permissionCount} behörighet${input.permissionCount === 1 ? '' : 'er'}.`,
            ...(input.note ? [`Meddelande: "${input.note}"`] : []),
            ...(input.expiresAt ? [`Åtkomsten är giltig till ${expiresLabel}.`] : [])
          ],
      action: 'Acceptera inbjudan',
      outro: input.token
        ? [
            'Klicka på knappen ovan för att skapa ditt konto och få åtkomst.',
            'Om du inte förväntade dig detta mejl kan du ignorera det.'
          ]
        : [
            'Du kan logga in med ditt befintliga konto för att komma åt dessa funktioner.',
            'Om du inte förväntade dig detta mejl kan du ignorera det.'
          ]
    },
    en: {
      subject: input.token
        ? `You've been invited to ${input.organizationName}`
        : `You've been granted delegated access to ${input.organizationName}`,
      pretitle: input.token ? 'Invitation to delegated access' : 'Delegated access',
      intro: 'Hi!',
      body: input.token
        ? [
            `${input.invitedBy} has invited you to have delegated access to ${input.organizationName}.`,
            `You will have access to ${input.permissionCount} permission${input.permissionCount === 1 ? '' : 's'}.`,
            ...(input.note ? [`Message: "${input.note}"`] : []),
            `The invitation is valid until ${expiresLabel}.`
          ]
        : [
            `${input.invitedBy} has granted you delegated access to ${input.organizationName}.`,
            `You now have access to ${input.permissionCount} permission${input.permissionCount === 1 ? '' : 's'}.`,
            ...(input.note ? [`Message: "${input.note}"`] : []),
            ...(input.expiresAt ? [`Access is valid until ${expiresLabel}.`] : [])
          ],
      action: 'Accept invitation',
      outro: input.token
        ? [
            'Click the button above to create your account and get access.',
            'If you were not expecting this email, you can ignore it.'
          ]
        : [
            'You can log in with your existing account to access these features.',
            'If you were not expecting this email, you can ignore it.'
          ]
    }
  }

  const copyForLocale = copy[locale]
  const content = renderBrandedTemplate(
    {
      locale,
      subject: copyForLocale.subject,
      pretitle: copyForLocale.pretitle,
      title: input.organizationName,
      intro: copyForLocale.intro,
      body: copyForLocale.body,
      ...(acceptUrl ? { action: { label: copyForLocale.action, url: acceptUrl } } : {}),
      outro: copyForLocale.outro
    },
    branding
  )
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
        organizationId: input.organizationId,
        type: 'delegation-invitation'
      }
    },
    outboxDir
  )
  console.info(`[mail] Delegation invitation email for ${input.to} stored at ${storedAt}`)
  return { acceptUrl, storedAt }
}

export const sendInviteAcceptedNotification = async (input: {
  organizationId: string
  organizationName: string
  invitedByEmail: string
  memberEmail: string
  memberName?: string | null
  role: string
}) => {
  const senderContext = await getEffectiveEmailSenderContext(input.organizationId)
  const locale = normalizeEmailLocale(senderContext.emailLanguage)
  const provider = senderContext.profile
  const disclaimerMarkdown = await fetchOrganizationDisclaimer(input.organizationId)
  const branding = await resolveEmailBranding({
    organizationId: input.organizationId,
    disclaimerMarkdown,
    supportContact: senderContext.supportContact,
    isDarkMode: senderContext.emailDarkMode
  })

  const copy: Record<EmailLocale, {
    subject: string
    pretitle: string
    intro: string
    accepted: (name: string) => string
    emailLabel: string
    roleLabel: string
    outro: string
  }> = {
    sv: {
      subject: 'Inbjudan accepterad',
      pretitle: 'Inbjudan accepterad',
      intro: 'Hej!',
      accepted: (name) => `${name} har accepterat din inbjudan.`,
      emailLabel: 'E-post',
      roleLabel: 'Roll',
      outro: 'Du kan nu hantera personen under Inställningar → Medlemmar.'
    },
    en: {
      subject: 'Invitation accepted',
      pretitle: 'Invitation accepted',
      intro: 'Hi!',
      accepted: (name) => `${name} has accepted your invitation.`,
      emailLabel: 'Email',
      roleLabel: 'Role',
      outro: 'You can now manage the person under Settings → Members.'
    }
  }

  const copyForLocale = copy[locale]
  const memberDisplay = input.memberName ?? input.memberEmail
  const content = renderBrandedTemplate(
    {
      locale,
      subject: copyForLocale.subject,
      pretitle: copyForLocale.pretitle,
      title: input.organizationName,
      intro: copyForLocale.intro,
      body: [
        copyForLocale.accepted(memberDisplay),
        `${copyForLocale.emailLabel}: ${input.memberEmail}`,
        `${copyForLocale.roleLabel}: ${input.role}`
      ],
      outro: [copyForLocale.outro]
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
        organizationId: input.organizationId,
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
  const senderContext = await getEffectiveEmailSenderContext({ tenantId: input.tenantId })
  const locale = normalizeEmailLocale(senderContext.emailLanguage)
  const expiresLabel = localeToDateString(input.expiresAt, locale)
  const provider = senderContext.profile
  const branding = await resolveEmailBranding({
    tenantId: input.tenantId,
    supportContact: senderContext.supportContact,
    isDarkMode: senderContext.emailDarkMode
  })

  const tenantTypeLabel = input.tenantType === 'provider' ? 'provider' : 'distributor'
  const tenantLabelByLocale: Record<EmailLocale, Record<typeof input.tenantType, string>> = {
    sv: { provider: 'Leverantör', distributor: 'Distributör' },
    en: { provider: 'Provider', distributor: 'Distributor' }
  }
  const tenantLabel = tenantLabelByLocale[locale][input.tenantType]
  const copy = {
    sv: {
      pretitle: `Grattis! Du är nu ${tenantLabel}! 🎉`,
      intro: 'Hej!',
      baseBody: [
        `Grattis! Du har blivit utsedd till ${tenantLabel.toLowerCase()} för ${input.tenantName}!`,
        'Detta är ett stort ansvar och vi är glada att ha dig med oss.',
        `Inbjudan är giltig till ${expiresLabel}.`
      ],
      autoCreate: input.willCreateOrganization && input.organizationName
        ? [
            '',
            `När du slutför registreringen kommer organisationen "${input.organizationName}" att skapas åt dig automatiskt.`
          ]
        : [],
      outro: [
        'Med denna roll får du hantera och administrera alla organisationer under din distributör.',
        'Om du inte förväntade dig mejlet kan du ignorera det.'
      ],
      action: 'Acceptera inbjudan',
      subject: `Grattis! Du är nu ${tenantLabel} för ${input.tenantName}!`
    },
    en: {
      pretitle: `Congratulations! You are now ${tenantLabel}! 🎉`,
      intro: 'Hi!',
      baseBody: [
        `Congratulations! You have been selected as ${tenantLabel.toLowerCase()} for ${input.tenantName}!`,
        'This is a big responsibility and we are happy to have you with us.',
        `The invitation is valid until ${expiresLabel}.`
      ],
      autoCreate: input.willCreateOrganization && input.organizationName
        ? [
            '',
            `When you complete the registration, the organization "${input.organizationName}" will be created for you automatically.`
          ]
        : [],
      outro: [
        `With this role you can manage and administer all organizations under your ${tenantLabel.toLowerCase()}.`,
        'If you were not expecting this email, you can ignore it.'
      ],
      action: 'Accept invitation',
      subject: `Congratulations! You are now ${tenantLabel} for ${input.tenantName}!`
    }
  } as const

  const copyForLocale = copy[locale]
  const bodyLines = [
    ...copyForLocale.baseBody,
    ...copyForLocale.autoCreate
  ]
  
  const content = renderBrandedTemplate(
    {
      locale,
      subject: copyForLocale.subject,
      pretitle: copyForLocale.pretitle,
      title: input.tenantName,
      intro: copyForLocale.intro,
      body: bodyLines,
      action: { label: copyForLocale.action, url: acceptUrl },
      outro: [...copyForLocale.outro] as string[]
    },
    branding
  )
  const finalContent = {
    ...content,
    subject: formatSubject(copyForLocale.subject, senderContext.subjectPrefix)
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
  const locale = normalizeEmailLocale(senderContext.emailLanguage)
  const provider = senderContext.profile
  const branding = await resolveEmailBranding({
    tenantId: input.tenantId,
    supportContact: senderContext.supportContact,
    isDarkMode: senderContext.emailDarkMode
  })

  const tenantLabelByLocale: Record<EmailLocale, Record<typeof input.tenantType, string>> = {
    sv: { provider: 'Leverantör', distributor: 'Distributör' },
    en: { provider: 'Provider', distributor: 'Distributor' }
  }
  const tenantLabel = tenantLabelByLocale[locale][input.tenantType]
  const copy = {
    sv: {
      subject: `Grattis! Du är nu ${tenantLabel} för ${input.tenantName}!`,
      pretitle: `Grattis! Du är nu ${tenantLabel}!`,
      intro: 'Hej!',
      body: [
        `Grattis! Du har nu fått rollen som ${tenantLabel.toLowerCase()} för ${input.tenantName}! 🎊`,
        'Detta är ett stort ansvar och vi är glada att ha dig med oss.',
        `Med denna roll får du hantera och administrera alla organisationer under din ${tenantLabel.toLowerCase()}.`
      ],
      action: 'Öppna portalen',
      outro: [
        'Du kan nu logga in och börja hantera din distributör.',
        'Om du inte förväntade dig mejlet kan du ignorera det.'
      ]
    },
    en: {
      subject: `Congratulations! You are now ${tenantLabel} for ${input.tenantName}!`,
      pretitle: `Congratulations! You are now ${tenantLabel}!`,
      intro: 'Hi!',
      body: [
        `Congratulations! You now have the role of ${tenantLabel.toLowerCase()} for ${input.tenantName}! 🎊`,
        'This is a big responsibility and we are happy to have you with us.',
        `With this role you can manage and administer all organizations under your ${tenantLabel.toLowerCase()}.`
      ],
      action: 'Open the portal',
      outro: [
        'You can now sign in and start managing your distributor.',
        'If you were not expecting this email, you can ignore it.'
      ]
    }
  } as const
  const copyForLocale = copy[locale]

  const content = renderBrandedTemplate(
    {
      locale,
      subject: copyForLocale.subject,
      pretitle: copyForLocale.pretitle,
      title: input.tenantName,
      intro: copyForLocale.intro,
      body: [...copyForLocale.body] as string[],
      action: { label: copyForLocale.action, url: portalUrl },
      outro: [...copyForLocale.outro] as string[]
    },
    branding
  )
  const finalContent = {
    ...content,
    subject: formatSubject(copyForLocale.subject, senderContext.subjectPrefix)
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