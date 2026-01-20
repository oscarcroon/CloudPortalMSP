import { createError, defineEventHandler, getRouterParam, readBody } from 'h3'
import { eq } from 'drizzle-orm'
import { z } from 'zod'
import { tenants } from '../../../../database/schema'
import { getDb } from '../../../../utils/db'
import {
  getProviderTenantEmailProviderProfile,
  getDistributorTenantEmailProviderProfile,
  saveProviderTenantEmailProvider,
  saveDistributorTenantEmailProvider
} from '../../../../utils/emailProvider'
import {
  buildSecretsFromPayload,
  emailProviderPayloadSchema
} from '../../../../utils/emailProviderPayload'
import { formatZodError, isMissingCryptoKeyError, cryptoKeyHelpText } from '../../../../utils/errors'
import { requireTenantPermission } from '../../../../utils/rbac'

export default defineEventHandler(async (event) => {
  const tenantId = getRouterParam(event, 'id')
  if (!tenantId) {
    throw createError({ statusCode: 400, message: 'Missing tenant ID' })
  }

  await requireTenantPermission(event, 'tenants:manage', tenantId)

  const db = getDb()
  const [tenant] = await db.select().from(tenants).where(eq(tenants.id, tenantId))

  if (!tenant) {
    throw createError({ statusCode: 404, message: 'Tenant not found' })
  }

  if (tenant.type !== 'provider' && tenant.type !== 'distributor') {
    throw createError({ statusCode: 400, message: 'Email provider settings are only available for providers and distributors' })
  }

  try {
    const body = await readBody(event)
    const payload = emailProviderPayloadSchema.parse(body)
    
    const existing = tenant.type === 'provider'
      ? await getProviderTenantEmailProviderProfile(tenantId)
      : await getDistributorTenantEmailProviderProfile(tenantId)
    
    const provider = tenant.type === 'provider'
      ? await saveProviderTenantEmailProvider(tenantId, {
          fromEmail: payload.fromEmail,
          fromName: payload.fromName,
          replyToEmail: payload.replyToEmail,
          emailLanguage: payload.emailLanguage,
          subjectPrefix: payload.subjectPrefix?.trim() || null,
          supportContact: payload.supportContact?.trim() || null,
          emailDarkMode: payload.emailDarkMode,
          isActive: payload.isActive ?? false,
          provider: buildSecretsFromPayload(payload.provider, payload.fromEmail, existing)
        })
      : await saveDistributorTenantEmailProvider(tenantId, {
          fromEmail: payload.fromEmail,
          fromName: payload.fromName,
          replyToEmail: payload.replyToEmail,
          emailLanguage: payload.emailLanguage,
          subjectPrefix: payload.subjectPrefix?.trim() || null,
          supportContact: payload.supportContact?.trim() || null,
          emailDarkMode: payload.emailDarkMode,
          isActive: payload.isActive ?? false,
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
    console.error('[tenant-email-provider] Failed to save tenant provider', error)
    throw createError({ statusCode: 500, message: 'Kunde inte spara e-postinställningen.' })
  }
})

