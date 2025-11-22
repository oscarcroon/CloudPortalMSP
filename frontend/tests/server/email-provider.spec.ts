import { describe, expect, it } from 'vitest'
import type { EmailProviderProfile } from '@coreit/email-kit'
import { buildSecretsFromPayload } from '../../src/server/utils/emailProviderPayload'

describe('buildSecretsFromPayload', () => {
  it('bevarar tidigare SMTP-lösenord när fältet lämnas tomt', () => {
    const existing: EmailProviderProfile = {
      type: 'smtp',
      fromEmail: 'noreply@example.com',
      config: {
        host: 'smtp.example.com',
        port: 465,
        secure: true,
        ignoreTls: false,
        auth: {
          user: 'mailer',
          pass: 'secret123'
        }
      }
    }

    const result = buildSecretsFromPayload(
      {
        type: 'smtp',
        host: 'smtp.example.com',
        port: 465,
        secure: true,
        ignoreTls: false,
        auth: {
          user: 'mailer',
          pass: ''
        }
      },
      'noreply@example.com',
      existing
    )

    expect(result.config.auth?.pass).toBe('secret123')
  })

  it('kastar fel om nytt Graph-secret saknas och inget tidigare finns', () => {
    expect(() =>
      buildSecretsFromPayload(
        {
          type: 'graph',
          tenantId: 'tenant',
          clientId: 'client',
          clientSecret: '',
          scope: undefined,
          endpoint: undefined,
          senderUserId: undefined
        },
        'noreply@example.com',
        null
      )
    ).toThrow(/Client Secret/i)
  })

  it('tillåter att koppla bort SMTP-auth genom att skicka tomt användarnamn', () => {
    const existing: EmailProviderProfile = {
      type: 'smtp',
      fromEmail: 'noreply@example.com',
      config: {
        host: 'smtp.example.com',
        port: 587,
        secure: false,
        ignoreTls: false,
        auth: {
          user: 'mailer',
          pass: 'secret123'
        }
      }
    }

    const result = buildSecretsFromPayload(
      {
        type: 'smtp',
        host: 'smtp.example.com',
        port: 587,
        secure: false,
        ignoreTls: false,
        auth: {
          user: '',
          pass: ''
        }
      },
      'noreply@example.com',
      existing
    )

    expect(result.config.auth).toBeNull()
  })
})

