import type { EmailProviderProfile } from '@coreit/email-kit'
import { buildTestEmail, sendTemplatedEmail } from '@coreit/email-kit'
import { getEffectiveEmailSenderContext } from './emailProvider'
import { resolveEmailBranding, fetchOrganizationDisclaimer } from './mailer'
import type { EmailProviderLookupContext } from './emailProvider'

export const sendProviderTestEmail = async (
  profile: EmailProviderProfile,
  testEmail: string,
  context?: EmailProviderLookupContext,
  emailDarkMode?: boolean
) => {
  // Get branding from the effective email sender context
  const senderContext = context
    ? await getEffectiveEmailSenderContext(context)
    : await getEffectiveEmailSenderContext()
  
  // Fetch disclaimer if we have an organizationId
  const disclaimerMarkdown = context?.organizationId
    ? await fetchOrganizationDisclaimer(context.organizationId)
    : null
  
  // Use emailDarkMode from parameter if provided (from form), otherwise from sender context (from database)
  const isDarkMode = emailDarkMode !== undefined ? emailDarkMode : senderContext.emailDarkMode
  
  // Resolve branding with disclaimer and support contact
  const branding = await resolveEmailBranding({
    organizationId: context?.organizationId,
    tenantId: context?.tenantId,
    supportContact: senderContext.supportContact ?? undefined,
    disclaimerMarkdown: disclaimerMarkdown ?? undefined,
    isDarkMode
  })
  
  console.log('[email-test] Dark mode:', {
    emailDarkModeFromForm: emailDarkMode,
    emailDarkModeFromDb: senderContext.emailDarkMode,
    finalIsDarkMode: isDarkMode,
    brandingIsDarkMode: branding?.isDarkMode,
    context: context
  })
  
  const content = buildTestEmail(branding)
  try {
    return await sendTemplatedEmail({
      profile,
      to: [{ email: testEmail }],
      content
    })
  } catch (error) {
    // Log more details for debugging
    console.error('[email-test] Failed to send test email:', {
      providerType: profile.type,
      fromEmail: profile.fromEmail,
      error: error instanceof Error ? error.message : String(error),
      stack: error instanceof Error ? error.stack : undefined
    })
    throw error
  }
}

export const describeEmailSendError = (error: unknown) => {
  if (error instanceof Error) {
    const message = error.message
    const lower = message.toLowerCase()
    if (lower.includes('self-signed certificate') || lower.includes('unable to verify the first certificate')) {
      return 'TLS-handshake misslyckades: servern använder ett självsignerat certifikat. Aktivera “Tillåt osignerade certifikat” i SMTP-inställningen eller installera en betrodd rot-CA.'
    }
    if (lower.includes('wrong version number')) {
      return 'TLS-handshake misslyckades: servern avvisade vald port/TLS-version. Kontrollera att du använder rätt port (t.ex. 465 för SSL eller 587 för STARTTLS).'
    }
    if (lower.includes('certificate')) {
      return `Kunde inte validera certifikatet: ${message}`
    }
    return message
  }
  return 'Kunde inte skicka testmail (okänt fel).'
}

