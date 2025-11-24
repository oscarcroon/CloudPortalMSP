import {
  buildInvitationEmail,
  buildPasswordResetEmail,
  renderBrandedTemplate,
  sendTemplatedEmail,
  writeOutboxPreview
} from '@coreit/email-kit'
import { getEffectiveEmailProviderProfile, getGlobalEmailProviderProfile } from './emailProvider'
import { outboxDir } from './outbox'

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

export const buildPortalUrl = (pathname: string) => {
  if (!pathname) return portalBaseUrl
  return `${portalBaseUrl}${pathname.startsWith('/') ? pathname : `/${pathname}`}`
}

const buildInviteAcceptUrl = (token: string) =>
  `${inviteBaseUrl}/invite/accept?token=${encodeURIComponent(token)}`

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

export const sendInvitationEmail = async (input: {
  organisationId: string
  organisationName: string
  invitedBy: string
  role: string
  to: string
  expiresAt: number
  token: string
}) => {
  const acceptUrl = buildInviteAcceptUrl(input.token)
  const expiresLabel = new Date(input.expiresAt).toLocaleString('sv-SE')
  const provider = await getEffectiveEmailProviderProfile(input.organisationId)
  const content = buildInvitationEmail({
    organisationName: input.organisationName,
    invitedBy: input.invitedBy,
    role: input.role,
    expiresAt: expiresLabel,
    acceptUrl,
    branding: provider?.branding
  })

  if (provider) {
    const delivery = await sendTemplatedEmail({
      profile: provider,
      to: [{ email: input.to }],
      content,
      dryRunOutboxDir: outboxDir
    })
    return { acceptUrl, delivery }
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
  const provider = await getEffectiveEmailProviderProfile(input.organisationId)
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
    provider?.branding
  )

  if (provider) {
    return sendTemplatedEmail({
      profile: provider,
      to: [{ email: input.invitedByEmail }],
      content,
      dryRunOutboxDir: outboxDir
    })
  }

  const storedAt = await writeOutboxPreview(
    {
      to: [{ email: input.invitedByEmail }],
      subject: content.subject,
      html: content.html,
      text: content.text,
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
