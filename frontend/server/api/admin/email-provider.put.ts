import { createError, defineEventHandler, readBody } from 'h3'
import { z } from 'zod'
import { getGlobalEmailProviderProfile, saveGlobalEmailProvider } from '~~/server/utils/emailProvider'
import {
  buildSecretsFromPayload,
  emailProviderPayloadSchema
} from '~~/server/utils/emailProviderPayload'
import { cryptoKeyHelpText, formatZodError, isMissingCryptoKeyError } from '~~/server/utils/errors'
import { requireSuperAdmin } from '~~/server/utils/rbac'

export default defineEventHandler(async (event) => {
  await requireSuperAdmin(event)
  try {
    const body = await readBody(event)
    const payload = emailProviderPayloadSchema.parse(body)
    const existing = await getGlobalEmailProviderProfile()
    const provider = await saveGlobalEmailProvider({
      fromEmail: payload.fromEmail,
      fromName: payload.fromName,
      replyToEmail: payload.replyToEmail,
      subjectPrefix: payload.subjectPrefix?.trim() || null,
      supportContact: payload.supportContact?.trim() || null,
      isActive: payload.isActive ?? true,
      provider: buildSecretsFromPayload(payload.provider, payload.fromEmail, existing)
    })
    return { provider }
  } catch (error) {
    if (error instanceof z.ZodError) {
      throw createError({
        statusCode: 400,
        message: formatZodError(error)
      })
    }
    if (error instanceof Error && error.message.includes('krävs')) {
      throw createError({ statusCode: 400, message: error.message })
    }
    if (isMissingCryptoKeyError(error)) {
      throw createError({ statusCode: 500, message: cryptoKeyHelpText })
    }
    console.error('[admin-email] Failed to save provider', error)
    throw createError({ statusCode: 500, message: 'Kunde inte spara e-postprovider.' })
  }
})

