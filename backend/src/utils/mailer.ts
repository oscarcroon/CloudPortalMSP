import {
  buildInvitationEmail,
  sendTemplatedEmail,
  writeOutboxPreview
} from '@coreit/email-kit'
import type { OrganisationMemberRole } from '../types/domain.js'
import { getEffectiveEmailProviderProfile } from '../services/emailProviders.js'
import { outboxDir } from './outbox.js'

const DEFAULT_PORTAL_URL = 'http://localhost:3000'

const acceptBaseUrl = (process.env.INVITE_ACCEPT_BASE_URL || DEFAULT_PORTAL_URL).replace(/\/$/, '')

interface InvitationEmailInput {
  to: string
  role: OrganisationMemberRole
  organisationId: string
  organisationName: string
  invitedBy: string
  expiresAt: number
  token: string
}

export async function sendInvitationEmail(input: InvitationEmailInput) {
  const link = `${acceptBaseUrl}/invite/accept?token=${encodeURIComponent(input.token)}`
  const provider = await getEffectiveEmailProviderProfile(input.organisationId)
  const expiresAtLabel = new Date(input.expiresAt).toLocaleString('sv-SE')
  const content = buildInvitationEmail({
    organisationName: input.organisationName,
    invitedBy: input.invitedBy,
    role: input.role,
    expiresAt: expiresAtLabel,
    acceptUrl: link,
    branding: provider?.branding
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
