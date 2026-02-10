import { createError, defineEventHandler, readBody } from 'h3'
import { eq } from 'drizzle-orm'
import { z } from 'zod'
import { createId } from '@paralleldrive/cuid2'
import { organizationSsoDomains } from '~~/server/database/schema'
import { getDb } from '~~/server/utils/db'
import {
  parseOrgParam,
  requireOrganizationByIdentifier,
  requireOrganizationManageAccess
} from '../utils'
import {
  normalizeDomain,
  generateDomainVerificationToken,
  buildVerificationRecordName,
  buildVerificationRecordValue
} from '~~/server/utils/domain-verification'

const bodySchema = z.object({
  domain: z.string().min(1).max(255)
})

export default defineEventHandler(async (event) => {
  const orgParam = parseOrgParam(event)
  const db = getDb()
  const organization = await requireOrganizationByIdentifier(db, orgParam)
  await requireOrganizationManageAccess(event, organization)

  const body = bodySchema.parse(await readBody(event))
  const normalizedDomain = normalizeDomain(body.domain)

  if (!normalizedDomain) {
    throw createError({ statusCode: 400, message: 'Ogiltigt domännamn.' })
  }

  // Check uniqueness — domain can only belong to one org
  const [existing] = await db
    .select({ id: organizationSsoDomains.id })
    .from(organizationSsoDomains)
    .where(eq(organizationSsoDomains.domain, normalizedDomain))
    .limit(1)

  if (existing) {
    throw createError({
      statusCode: 409,
      message: 'Denna domän är redan registrerad för en organisation.'
    })
  }

  const token = generateDomainVerificationToken()
  const id = createId()

  await db.insert(organizationSsoDomains).values({
    id,
    organizationId: organization.id,
    domain: normalizedDomain,
    verificationStatus: 'pending',
    verificationToken: token
  })

  return {
    id,
    domain: normalizedDomain,
    verificationStatus: 'pending',
    verificationInstructions: {
      recordType: 'TXT',
      recordName: buildVerificationRecordName(normalizedDomain),
      recordValue: buildVerificationRecordValue(token),
      note: 'Lägg till denna TXT-post i din DNS för att verifiera domänägandeskap.'
    }
  }
})
