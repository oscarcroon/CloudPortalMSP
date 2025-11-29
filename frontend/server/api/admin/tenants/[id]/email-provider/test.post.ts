import { createError, defineEventHandler, getRouterParam, readBody } from 'h3'
import { eq } from 'drizzle-orm'
import { z } from 'zod'
import { tenants } from '../../../../../database/schema'
import { getDb } from '../../../../../utils/db'
import { recordTestResult } from '../../../../../utils/emailProvider'
import { describeEmailSendError, sendProviderTestEmail } from '../../../../../utils/emailTest'
import {
  buildProfileFromPayload,
  emailProviderPayloadSchema
} from '../../../../../utils/emailProviderPayload'
import { requireTenantPermission } from '../../../../../utils/rbac'

const testSchema = emailProviderPayloadSchema.extend({
  testEmail: z.string().email()
})

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

  const body = await readBody(event)
  const payload = testSchema.parse(body)
  const profile = buildProfileFromPayload(payload)

  try {
    await sendProviderTestEmail(profile, payload.testEmail)
    await recordTestResult(tenantId, 'success')
    return { success: true }
  } catch (error) {
    const errorMessage = describeEmailSendError(error)
    await recordTestResult(tenantId, 'failure', errorMessage)
    throw createError({
      statusCode: 502,
      message: `Testmail kunde inte skickas. ${errorMessage}`
    })
  }
})

