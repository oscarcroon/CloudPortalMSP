import type { EmailProviderProfile, ProviderSecrets } from '@coreit/email-kit'
import { z } from 'zod'

const emailLike = z
  .string()
  .trim()
  .regex(/^[^@\s]+@[^@\s]+$/, 'Invalid email')

const smtpSchema = z.object({
  type: z.literal('smtp'),
  host: z.string().min(1),
  port: z.coerce.number().int().positive(),
  secure: z.boolean().optional(),
  auth: z
    .object({
      user: z.string().optional(),
      pass: z.string().optional()
    })
    .optional()
    .nullable(),
  ignoreTls: z.boolean().optional()
})

const graphSchema = z.object({
  type: z.literal('graph'),
  tenantId: z.string().min(1),
  clientId: z.string().min(1),
  clientSecret: z.string().optional(),
  scope: z.string().optional(),
  endpoint: z.string().url().optional(),
  senderUserId: z.string().optional()
})

const emailLanguageSchema = z.enum(['sv', 'en'])

export const providerSchema = z.discriminatedUnion('type', [smtpSchema, graphSchema])

export const emailProviderPayloadSchema = z.object({
  fromEmail: emailLike,
  fromName: z.string().max(120).optional(),
  replyToEmail: emailLike.optional(),
  emailLanguage: emailLanguageSchema.optional().default('sv'),
  subjectPrefix: z.string().max(120).optional().nullable(),
  supportContact: z.string().max(160).optional().nullable(),
  emailDarkMode: z.boolean().optional().default(false),
  disclaimerMarkdown: z.string().max(2000).optional().nullable(),
  isActive: z.boolean().optional().default(true),
  provider: providerSchema
})

export type EmailProviderPayload = z.infer<typeof emailProviderPayloadSchema>
export type ProviderConfigPayload = z.infer<typeof providerSchema>

export const buildSecretsFromPayload = (
  provider: ProviderConfigPayload,
  fromEmail: string,
  existing?: EmailProviderProfile | null
): ProviderSecrets => {
  if (provider.type === 'smtp') {
    const smtpProvider = provider as Extract<ProviderConfigPayload, { type: 'smtp' }>
    const previous = existing && existing.type === 'smtp' ? existing.config : null
    let auth: any = null
    if (smtpProvider.auth && smtpProvider.auth.user) {
      const pass =
        smtpProvider.auth.pass && smtpProvider.auth.pass.length > 0
          ? smtpProvider.auth.pass
          : previous?.auth?.pass ?? ''
      if (!pass) {
        throw new Error('SMTP-lösenord krävs.')
      }
      auth = {
        user: smtpProvider.auth.user,
        pass
      }
    } else if (smtpProvider.auth && !smtpProvider.auth.user) {
      auth = null
    } else {
      auth = previous?.auth ?? null
    }
    return {
      type: 'smtp',
      config: {
        host: smtpProvider.host,
        port: smtpProvider.port,
        secure: smtpProvider.secure ?? smtpProvider.port === 465,
        auth,
        ignoreTls: smtpProvider.ignoreTls ?? false
      }
    }
  }
  const previous = existing && existing.type === 'graph' ? existing.config : null
  const clientSecret =
    provider.clientSecret && provider.clientSecret.length > 0
      ? provider.clientSecret
      : previous?.clientSecret ?? ''
  if (!clientSecret) {
    throw new Error('Microsoft Graph Client Secret krävs.')
  }
  return {
    type: 'graph',
    config: {
      tenantId: provider.tenantId,
      clientId: provider.clientId,
      clientSecret,
      fromEmail,
      scope: provider.scope ?? previous?.scope,
      endpoint: provider.endpoint ?? previous?.endpoint,
      senderUserId: provider.senderUserId ?? previous?.senderUserId
    }
  }
}

export const buildProfileFromPayload = (payload: EmailProviderPayload): EmailProviderProfile => {
  const secrets = buildSecretsFromPayload(payload.provider, payload.fromEmail)
  return {
    ...secrets,
    fromEmail: payload.fromEmail,
    fromName: payload.fromName ?? undefined,
    replyToEmail: payload.replyToEmail ?? undefined
  }
}

