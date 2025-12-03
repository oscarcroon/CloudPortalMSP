import { createError, defineEventHandler, readBody } from 'h3'
import { eq } from 'drizzle-orm'
import { z } from 'zod'
import { getEffectiveEmailSenderContext } from '~~/server/utils/emailProvider'
import { resolveEmailBranding } from '~~/server/utils/mailer'
import { buildInvitationEmail, buildPasswordResetEmail } from '@coreit/email-kit'
import type { EmailProviderLookupContext } from '~~/server/utils/emailProvider'
import { requireSuperAdmin } from '~~/server/utils/rbac'
import { organizations } from '~~/server/database/schema'
import { getDb } from '~~/server/utils/db'

const previewSchema = z.object({
  type: z.enum(['invitation', 'password-reset']),
  organizationId: z.string().optional().nullable(),
  tenantId: z.string().optional().nullable(),
  disclaimerMarkdown: z.string().optional().nullable(),
  isDarkMode: z.boolean().optional().nullable()
})

export default defineEventHandler(async (event) => {
  await requireSuperAdmin(event)

  const body = await readBody(event)
  const input = previewSchema.parse(body)

  const context: EmailProviderLookupContext = {
    organizationId: input.organizationId ?? null,
    tenantId: input.tenantId ?? null
  }

  const senderContext = await getEffectiveEmailSenderContext(context)
  if (!senderContext.profile) {
    throw createError({
      statusCode: 400,
      message: 'Ingen aktiv e-postprovider hittades för denna kontext.'
    })
  }

  // Use disclaimer from request if provided (from form), otherwise fetch from database
  let disclaimerMarkdown: string | null = null
  if (input.disclaimerMarkdown !== undefined && input.disclaimerMarkdown !== null) {
    // Use disclaimer from form (may be unsaved)
    disclaimerMarkdown = input.disclaimerMarkdown.trim() || null
  } else if (input.organizationId) {
    // Fetch from database if not provided in request
    try {
      const db = getDb()
      const [organization] = await db
        .select({ disclaimer: organizations.emailDisclaimerMarkdown })
        .from(organizations)
        .where(eq(organizations.id, input.organizationId))
        .limit(1)
      disclaimerMarkdown = organization?.disclaimer ?? null
    } catch (error) {
      console.warn('[email-preview] Failed to load organization disclaimer', error)
    }
  }

  // For preview, we want to use the active organization's logo specifically
  // even if the email provider comes from a higher level in the chain
  // First, try to get the organization's own logo before resolving the branding chain
  let organizationLogoUrl: string | null = null
  if (input.organizationId) {
    try {
      const { brandingThemes } = await import('~~/server/database/schema')
      const db = getDb()
      // Get logo from branding_themes table for this organization
      const [theme] = await db
        .select({ 
          logoUrl: brandingThemes.logoUrl,
          appLogoLightUrl: brandingThemes.appLogoLightUrl
        })
        .from(brandingThemes)
        .where(eq(brandingThemes.organizationId, input.organizationId))
        .limit(1)
      
      organizationLogoUrl = theme?.appLogoLightUrl ?? theme?.logoUrl ?? null
      
      // Fallback to organizations.logoUrl if branding_themes doesn't have a logo
      if (!organizationLogoUrl) {
        const [organization] = await db
          .select({ 
            logoUrl: organizations.logoUrl
          })
          .from(organizations)
          .where(eq(organizations.id, input.organizationId))
          .limit(1)
        organizationLogoUrl = organization?.logoUrl ?? null
      }
    } catch (error) {
      console.warn('[email-preview] Failed to load organization logo for preview', error)
    }
  }

  // Resolve branding from chain (for accent color, background, etc.)
  // Use dark mode from request if provided (explicitly true/false), otherwise from sender context
  const isDarkMode = input.isDarkMode !== null && input.isDarkMode !== undefined 
    ? Boolean(input.isDarkMode) 
    : (senderContext.emailDarkMode ?? false)
  
  console.log('[email-preview] isDarkMode:', isDarkMode, 'input.isDarkMode:', input.isDarkMode, 'senderContext.emailDarkMode:', senderContext.emailDarkMode)
  
  let branding = await resolveEmailBranding({
    organizationId: input.organizationId ?? undefined,
    tenantId: input.tenantId ?? undefined,
    supportContact: senderContext.supportContact ?? undefined,
    disclaimerMarkdown: disclaimerMarkdown ?? undefined,
    isDarkMode,
    // Override logo with organization's own logo if available
    overrideLogoUrl: organizationLogoUrl ?? undefined
  })
  
  console.log('[email-preview] branding.isDarkMode:', branding?.isDarkMode)

  if (input.type === 'invitation') {
    const content = buildInvitationEmail({
      organisationName: 'Exempelorganisation',
      invitedBy: 'Exempel Användare',
      role: 'Medlem',
      expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toLocaleString('sv-SE'),
      acceptUrl: 'https://example.com/invite/accept?token=example-token',
      branding
    })
    return {
      subject: content.subject,
      html: content.html,
      text: content.text
    }
  }

  // password-reset
  const content = buildPasswordResetEmail({
    resetUrl: 'https://example.com/reset-password?token=example-token',
    expiresAt: new Date(Date.now() + 1 * 60 * 60 * 1000).toLocaleString('sv-SE'),
    branding
  })
  return {
    subject: content.subject,
    html: content.html,
    text: content.text
  }
})

