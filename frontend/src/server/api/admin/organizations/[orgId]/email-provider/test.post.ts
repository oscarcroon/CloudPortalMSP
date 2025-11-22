import { createError, defineEventHandler, readBody } from 'h3'
import { z } from 'zod'
import { recordTestResult } from '~/server/utils/emailProvider'
import { describeEmailSendError, sendProviderTestEmail } from '~/server/utils/emailTest'
import {
  buildProfileFromPayload,
  emailProviderPayloadSchema
} from '~/server/utils/emailProviderPayload'
import { getDb } from '~/server/utils/db'
import { cryptoKeyHelpText, formatZodError, isMissingCryptoKeyError } from '~/server/utils/errors'
import { requireSuperAdmin } from '~/server/utils/rbac'
import { parseOrgParam, requireOrganizationByIdentifier } from '../../utils'

const testSchema = emailProviderPayloadSchema.extend({
  testEmail: z.string().email()
})

export default defineEventHandler(async (event) => {
  await requireSuperAdmin(event)
  const orgParam = parseOrgParam(event)
  const db = getDb()
  const organization = await requireOrganizationByIdentifier(db, orgParam)
  try {
    const body = await readBody(event)
    const payload = testSchema.parse(body)
    const profile = buildProfileFromPayload(payload)
    await sendProviderTestEmail(profile, payload.testEmail)
    await recordTestResult(organization.id, 'success')
    return { delivered: true }
  } catch (error) {
    console.error('[admin-email] Org test send failed', error)
    const friendly = describeEmailSendError(error)
    await recordTestResult(organization.id, 'failure', friendly)
    if (error instanceof z.ZodError) {
      throw createError({
        statusCode: 400,
        message: formatZodError(error)
      })
    }
    if (isMissingCryptoKeyError(error)) {
      throw createError({ statusCode: 500, message: cryptoKeyHelpText })
    }
    throw createError({
      statusCode: 502,
      message: friendly
    })
  }
})

