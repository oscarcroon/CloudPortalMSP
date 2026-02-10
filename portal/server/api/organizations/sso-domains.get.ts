import { defineEventHandler } from 'h3'
import { eq } from 'drizzle-orm'
import { organizationSsoDomains } from '~~/server/database/schema'
import { getDb } from '~~/server/utils/db'
import { requirePermission } from '~~/server/utils/rbac'
import {
  buildVerificationRecordName,
  buildVerificationRecordValue
} from '~~/server/utils/domain-verification'

export default defineEventHandler(async (event) => {
  const { orgId } = await requirePermission(event, 'org:manage')
  const db = getDb()

  const domains = await db
    .select()
    .from(organizationSsoDomains)
    .where(eq(organizationSsoDomains.organizationId, orgId))

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
