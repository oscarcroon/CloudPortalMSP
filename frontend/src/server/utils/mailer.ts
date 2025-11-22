import {
  buildPasswordResetEmail,
  sendTemplatedEmail,
  writeOutboxPreview
} from '@coreit/email-kit'
import { getGlobalEmailProviderProfile } from './emailProvider'
import { outboxDir } from './outbox'

const DEFAULT_PORTAL_URL = 'http://localhost:3000'

const portalBaseUrl = (
  process.env.PASSWORD_RESET_BASE_URL ||
  process.env.PORTAL_BASE_URL ||
  process.env.NUXT_PUBLIC_APP_URL ||
  DEFAULT_PORTAL_URL
).replace(/\/$/, '')

export const buildPortalUrl = (pathname: string) => {
  if (!pathname) return portalBaseUrl
  return `${portalBaseUrl}${pathname.startsWith('/') ? pathname : `/${pathname}`}`
}

export const sendPasswordResetEmail = async (input: {
  to: string
  token: string
  expiresAt: number
}) => {
  const resetUrl = `${buildPortalUrl('/reset-password')}?token=${encodeURIComponent(input.token)}`
  const expiresLabel = new Date(input.expiresAt).toLocaleString('sv-SE')
  const provider = await getGlobalEmailProviderProfile()
  const content = buildPasswordResetEmail({
    resetUrl,
    expiresAt: expiresLabel,
    branding: provider?.branding
  })

  if (provider) {
    const delivery = await sendTemplatedEmail({
      profile: provider,
      to: [{ email: input.to }],
      content,
      dryRunOutboxDir: outboxDir
    })
    return { resetUrl, delivery }
  }

  const storedAt = await writeOutboxPreview(
    {
      to: [{ email: input.to }],
      subject: content.subject,
      html: content.html,
      text: content.text,
      meta: { reason: 'missing-global-provider' }
    },
    outboxDir
  )
  console.info(`[mail] Password reset email for ${input.to} stored at ${storedAt}`)
  return { resetUrl, storedAt }
}
