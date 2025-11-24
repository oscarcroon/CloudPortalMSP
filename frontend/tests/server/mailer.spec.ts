import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { EmailProviderProfile } from '@coreit/email-kit'

const emailKitMock = vi.hoisted(() => ({
  buildInvitationEmail: vi.fn(() => ({
    subject: 'Invitation',
    html: '<p>Invitation</p>',
    text: 'Invitation'
  })),
  buildPasswordResetEmail: vi.fn(() => ({
    subject: 'Reset',
    html: '<p>Reset</p>',
    text: 'Reset'
  })),
  sendTemplatedEmail: vi.fn(async () => ({ delivered: true, channel: 'smtp' as const })),
  writeOutboxPreview: vi.fn(async () => 'outbox/test.eml')
}))

const emailProviderMock = vi.hoisted(() => ({
  getEffectiveEmailProviderProfile: vi.fn(),
  getGlobalEmailProviderProfile: vi.fn()
}))

vi.mock('@coreit/email-kit', () => emailKitMock)
vi.mock('~/server/utils/emailProvider', () => emailProviderMock)

import { sendInvitationEmail } from '~/server/utils/mailer'
import { outboxDir } from '~/server/utils/outbox'

describe('sendInvitationEmail', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    emailProviderMock.getEffectiveEmailProviderProfile.mockReset()
  })

  it('skickar via vald provider när organisationen har en aktiv profil', async () => {
    const provider: EmailProviderProfile = {
      type: 'smtp',
      fromEmail: 'noreply@example.com',
      config: {
        host: 'smtp.example.com',
        port: 465,
        secure: true,
        auth: null
      }
    }
    emailProviderMock.getEffectiveEmailProviderProfile.mockResolvedValue(provider)

    const result = await sendInvitationEmail({
      organisationId: 'org-1',
      organisationName: 'Acme',
      invitedBy: 'Admin',
      role: 'member',
      to: 'user@example.com',
      expiresAt: Date.now() + 60_000,
      token: 'token-123'
    })

    expect(result.acceptUrl).toContain('token-123')
    expect(emailKitMock.sendTemplatedEmail).toHaveBeenCalledWith(
      expect.objectContaining({
        profile: provider,
        dryRunOutboxDir: outboxDir
      })
    )
  })

  it('skriver förhandsvisning till outbox när provider saknas', async () => {
    emailProviderMock.getEffectiveEmailProviderProfile.mockResolvedValue(null)

    const result = await sendInvitationEmail({
      organisationId: 'org-2',
      organisationName: 'Example Org',
      invitedBy: 'Owner',
      role: 'owner',
      to: 'owner@example.com',
      expiresAt: Date.now() + 60_000,
      token: 'token-xyz'
    })

    expect(result.storedAt).toBe('outbox/test.eml')
    expect(emailKitMock.writeOutboxPreview).toHaveBeenCalledWith(
      expect.objectContaining({
        to: [{ email: 'owner@example.com' }]
      }),
      outboxDir
    )
    expect(emailKitMock.sendTemplatedEmail).not.toHaveBeenCalled()
  })

  it('inkluderar organisationens logga i branding när den skickas in', async () => {
    emailProviderMock.getEffectiveEmailProviderProfile.mockResolvedValue(null)

    await sendInvitationEmail({
      organisationId: 'org-3',
      organisationName: 'Org with Logo',
      invitedBy: 'Owner',
      role: 'member',
      to: 'logo@example.com',
      expiresAt: Date.now() + 60_000,
      token: 'token-logo',
      organisationLogo: 'https://example.com/logo.png'
    })

    expect(emailKitMock.buildInvitationEmail).toHaveBeenCalledWith(
      expect.objectContaining({
        branding: expect.objectContaining({ logoUrl: 'https://example.com/logo.png' })
      })
    )
  })
})

