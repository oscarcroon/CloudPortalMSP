import { createError, defineEventHandler, readBody } from 'h3'
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
import { cryptoKeyHelpText, formatZodError, isMissingCryptoKeyError } from '~~/server/utils/errors'
import { requireSuperAdmin } from '~~/server/utils/rbac'
import { parseOrgParam, requireOrganizationByIdentifier } from '../utils'

export default defineEventHandler(async (event) => {
  await requireSuperAdmin(event)
  const orgParam = parseOrgParam(event)
  const db = getDb()
  const organization = await requireOrganizationByIdentifier(db, orgParam)
  try {
    const body = await readBody(event)
    const payload = emailProviderPayloadSchema.parse(body)
    const existing = await getOrganisationEmailProviderProfile(organization.id)
    const provider = await saveOrganisationEmailProvider(organization.id, {
      fromEmail: payload.fromEmail,
      fromName: payload.fromName,
      replyToEmail: payload.replyToEmail,
      branding: payload.branding ?? null,
      isActive: payload.isActive ?? true,
      provider: buildSecretsFromPayload(payload.provider, payload.fromEmail, existing)
    })
    return { organization, provider }
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
    console.error('[admin-email] Failed to save org provider', error)
    throw createError({ statusCode: 500, message: 'Kunde inte spara e-postprovider.' })
  }
})

