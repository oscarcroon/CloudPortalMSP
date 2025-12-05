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
  getEffectiveEmailSenderContext: vi.fn()
}))

const brandingMock = vi.hoisted(() => {
  const resolution = {
    activeTheme: {
      logoUrl: null,
      appLogoLightUrl: null,
      appLogoDarkUrl: null,
      loginLogoLightUrl: null,
      loginLogoDarkUrl: null,
      loginBackgroundUrl: null,
      loginBackgroundTint: null,
      loginBackgroundTintOpacity: 0.85,
      navBackgroundColor: '#ffffff',
      accentColor: '#1C6DD0',
      paletteKey: null
    }
  }
  return {
    resolveBrandingChain: vi.fn(async () => resolution),
    resolveGlobalBranding: vi.fn(async () => resolution)
  }
})

vi.mock('@coreit/email-kit', () => emailKitMock)
vi.mock('~~/server/utils/emailProvider', () => emailProviderMock)
vi.mock('~~/server/utils/branding', () => brandingMock)

import { sendInvitationEmail } from '~~/server/utils/mailer'
import { outboxDir } from '~~/server/utils/outbox'

describe('sendInvitationEmail', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    emailProviderMock.getEffectiveEmailSenderContext.mockReset()
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
    emailProviderMock.getEffectiveEmailSenderContext.mockResolvedValue({
      profile: provider,
      subjectPrefix: '[Portal]',
      supportContact: null,
      source: null
    })

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
    const sent = emailKitMock.sendTemplatedEmail.mock.calls[0][0]
    expect(sent.content.subject).toMatch(/^\[Portal]/)
  })

  it('skriver förhandsvisning till outbox när provider saknas', async () => {
    emailProviderMock.getEffectiveEmailSenderContext.mockResolvedValue({
      profile: null,
      subjectPrefix: null,
      supportContact: null,
      source: null
    })

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
    emailProviderMock.getEffectiveEmailSenderContext.mockResolvedValue({
      profile: null,
      subjectPrefix: null,
      supportContact: null,
      source: null
    })

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

  it('hämtar branding via branding-resolvern', async () => {
    emailProviderMock.getEffectiveEmailSenderContext.mockResolvedValue({
      profile: null,
      subjectPrefix: null,
      supportContact: null,
      source: null
    })

    await sendInvitationEmail({
      organisationId: 'org-4',
      organisationName: 'Another Org',
      invitedBy: 'Owner',
      role: 'member',
      to: 'branding@example.com',
      expiresAt: Date.now() + 60_000,
      token: 'token-branding'
    })

    expect(brandingMock.resolveBrandingChain).toHaveBeenCalledWith({ organizationId: 'org-4' })
  })
})

