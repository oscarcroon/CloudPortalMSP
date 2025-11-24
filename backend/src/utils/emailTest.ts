import type { EmailProviderProfile } from '@coreit/email-kit'
import { buildTestEmail, sendTemplatedEmail } from '@coreit/email-kit'

export const sendProviderTestEmail = async (profile: EmailProviderProfile, testEmail: string) => {
  const content = buildTestEmail(profile.branding)
  return sendTemplatedEmail({
    profile,
    to: [{ email: testEmail }],
    content
  })
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

