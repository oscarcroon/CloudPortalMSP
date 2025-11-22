import { writeOutboxPreview } from './outbox.js'
import { renderBrandedTemplate, renderInvitationEmail, renderPasswordResetEmail } from './templates.js'
import { sendViaGraph, sendViaSmtp } from './transport.js'
import type {
  EmailBranding,
  EmailContent,
  EmailProviderProfile,
  EmailRecipient,
  InvitationTemplateInput,
  PasswordResetTemplateInput,
  SendTemplatedEmailOptions
} from './types.js'

const toArray = (value: EmailRecipient | EmailRecipient[]): EmailRecipient[] =>
  Array.isArray(value) ? value : [value]

const logSafeError = (error: unknown) =>
  error instanceof Error ? { message: error.message, name: error.name } : { message: String(error) }

export const sendTemplatedEmail = async (options: SendTemplatedEmailOptions) => {
  const recipients = toArray(options.to)
  const { profile, content, dryRunOutboxDir, logger } = options

  const deliver = async () => {
    if (profile.type === 'smtp') {
      await sendViaSmtp(profile, recipients, content.subject, content.html, content.text)
      return 'smtp'
    }
    await sendViaGraph(profile, recipients, content.subject, content.html, content.text)
    return 'graph'
  }

  try {
    const channel = await deliver()
    logger?.({
      level: 'info',
      message: `E-post skickades via ${channel}.`,
      context: { providerType: profile.type }
    })
    return { delivered: true, channel }
  } catch (error) {
    logger?.({
      level: 'error',
      message: 'E-postutskick misslyckades.',
      context: { providerType: profile.type, error: logSafeError(error) }
    })

    if (dryRunOutboxDir) {
      const storedAt = await writeOutboxPreview(
        {
          to: recipients,
          subject: content.subject,
          html: content.html,
          text: content.text,
          meta: { providerType: profile.type, fallback: true, error: logSafeError(error) }
        },
        dryRunOutboxDir
      )
      return { delivered: false, storedAt }
    }
    throw error
  }
}

export const buildInvitationEmail = (input: InvitationTemplateInput): EmailContent => {
  return renderInvitationEmail(input)
}

export const buildPasswordResetEmail = (input: PasswordResetTemplateInput): EmailContent => {
  return renderPasswordResetEmail(input)
}

export const buildTestEmail = (branding?: EmailBranding): EmailContent => {
  const timestamp = new Date().toLocaleString('sv-SE')
  return renderBrandedTemplate(
    {
      subject: 'Testmail från Cloud Portal',
      pretitle: 'Testutskick',
      title: 'Allt är kopplat!',
      intro: 'Hej!',
      body: [
        'Detta är ett testmail som låter dig verifiera att SMTP/OAuth-konfigurationen fungerar.',
        `Skickades ${timestamp}.`
      ],
      outro: [
        'Om leveransen lyckades ser du detta exakt som dina användare kommer göra (inklusive branding).'
      ]
    },
    branding
  )
}

