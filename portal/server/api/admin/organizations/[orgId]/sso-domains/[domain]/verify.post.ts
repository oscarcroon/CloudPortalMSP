import { createError, defineEventHandler, getRouterParam } from 'h3'
import { and, eq } from 'drizzle-orm'
import { organizationSsoDomains } from '~~/server/database/schema'
import { getDb } from '~~/server/utils/db'
import {
  parseOrgParam,
  requireOrganizationByIdentifier,
  requireOrganizationManageAccess
} from '../../../utils'
import {
  verifyDomainOwnership,
  buildVerificationRecordName,
  buildVerificationRecordValue
} from '~~/server/utils/domain-verification'

export default defineEventHandler(async (event) => {
  const orgParam = parseOrgParam(event)
  const domainParam = getRouterParam(event, 'domain')
  if (!domainParam) {
    throw createError({ statusCode: 400, message: 'Saknar domänparameter.' })
  }

  const db = getDb()
  const organization = await requireOrganizationByIdentifier(db, orgParam)
  await requireOrganizationManageAccess(event, organization)

  const [ssoDomain] = await db
    .select()
    .from(organizationSsoDomains)
    .where(
      and(
        eq(organizationSsoDomains.organizationId, organization.id),
        eq(organizationSsoDomains.domain, domainParam)
      )
    )
    .limit(1)

  if (!ssoDomain) {
    throw createError({ statusCode: 404, message: 'SSO-domänen hittades inte.' })
  }

  if (ssoDomain.verificationStatus === 'verified') {
    return { verified: true, message: 'Domänen är redan verifierad.' }
  }

  if (!ssoDomain.verificationToken) {
    throw createError({ statusCode: 400, message: 'Ingen verifieringstoken finns för denna domän.' })
  }

  const result = await verifyDomainOwnership(ssoDomain.domain, ssoDomain.verificationToken)

  if (result.verified) {
    await db
      .update(organizationSsoDomains)
      .set({
        verificationStatus: 'verified',
        verifiedAt: new Date()
      })
      .where(eq(organizationSsoDomains.id, ssoDomain.id))

    return { verified: true, message: 'Domänen har verifierats.' }
  }

  await db
    .update(organizationSsoDomains)
    .set({ verificationStatus: 'pending' })
    .where(eq(organizationSsoDomains.id, ssoDomain.id))

  return {
    verified: false,
    error: result.error,
    expected: {
      recordType: 'TXT',
      recordName: buildVerificationRecordName(ssoDomain.domain),
      recordValue: buildVerificationRecordValue(ssoDomain.verificationToken)
    },
    foundRecords: result.foundRecords ?? []
  }
})
