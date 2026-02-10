import { defineEventHandler } from 'h3'
import { eq } from 'drizzle-orm'
import { organizationSsoDomains } from '~~/server/database/schema'
import { getDb } from '~~/server/utils/db'
import {
  buildVerificationRecordName,
  buildVerificationRecordValue
} from '~~/server/utils/domain-verification'
import {
  parseOrgParam,
  requireOrganizationByIdentifier,
  requireOrganizationManageAccess
} from '../utils'

export default defineEventHandler(async (event) => {
  const orgParam = parseOrgParam(event)
  const db = getDb()
  const organization = await requireOrganizationByIdentifier(db, orgParam)
  await requireOrganizationManageAccess(event, organization)

  const domains = await db
    .select()
    .from(organizationSsoDomains)
    .where(eq(organizationSsoDomains.organizationId, organization.id))

  return {
    domains: domains.map((d) => ({
      id: d.id,
      domain: d.domain,
      verificationStatus: d.verificationStatus,
      verifiedAt: d.verifiedAt?.toISOString() ?? null,
      createdAt: d.createdAt.toISOString(),
      verificationInstructions: d.verificationStatus !== 'verified' && d.verificationToken
        ? {
            recordName: buildVerificationRecordName(d.domain),
            recordValue: buildVerificationRecordValue(d.verificationToken)
          }
        : null
    }))
  }
})
