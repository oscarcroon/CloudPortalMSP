import { createError, defineEventHandler, readBody } from 'h3'
import { eq } from 'drizzle-orm'
import { z } from 'zod'
import {
  getOrganisationEmailProviderProfile,
  saveOrganisationEmailProvider
} from '~~/server/utils/emailProvider'
import {
  buildSecretsFromPayload,
  emailProviderPayloadSchema
} from '~~/server/utils/emailProviderPayload'
import { getDb } from '~~/server/utils/db'
import { organizations } from '~~/server/database/schema'
import { cryptoKeyHelpText, formatZodError, isMissingCryptoKeyError } from '~~/server/utils/errors'
import { requirePermission } from '~~/server/utils/rbac'

export default defineEventHandler(async (event) => {
  const { orgId } = await requirePermission(event, 'org:manage')
  const db = getDb()
  try {
    const body = await readBody(event)
    const payload = emailProviderPayloadSchema.parse(body)
    const existing = await getOrganisationEmailProviderProfile(orgId)
    const disclaimer = payload.disclaimerMarkdown?.trim() || null
    const provider = await saveOrganisationEmailProvider(orgId, {
      fromEmail: payload.fromEmail,
      fromName: payload.fromName,
      replyToEmail: payload.replyToEmail,
      subjectPrefix: payload.subjectPrefix?.trim() || null,
      supportContact: payload.supportContact?.trim() || null,
      isActive: payload.isActive ?? false,
      provider: buildSecretsFromPayload(payload.provider, payload.fromEmail, existing)
    })
    await db
      .update(organizations)
      .set({
        emailDisclaimerMarkdown: disclaimer,
        updatedAt: new Date()
      })
      .where(eq(organizations.id, orgId))
    provider.disclaimerMarkdown = disclaimer
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
    console.error('[settings-email] Failed to save org provider', error)
    throw createError({ statusCode: 500, message: 'Kunde inte spara e-postinställningen.' })
  }
})

