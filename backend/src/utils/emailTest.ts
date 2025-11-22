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

