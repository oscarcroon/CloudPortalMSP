import { and, eq } from 'drizzle-orm'
import { createId } from '@paralleldrive/cuid2'
import { cloudflareDnsZoneAcls } from '~~/server/database/schema'
import { getDb } from '~~/server/utils/db'
import type { CloudflareZoneRole } from './types'

export type CloudflareZoneAclEntry = {
  principalType: 'user' | 'org-role'
  principalId: string
  role: CloudflareZoneRole
}

export const listZoneAcl = async (orgId: string, zoneId: string) => {
  const db = getDb()
  const rows = await db
    .select()
    .from(cloudflareDnsZoneAcls)
    .where(
      and(eq(cloudflareDnsZoneAcls.organizationId, orgId), eq(cloudflareDnsZoneAcls.zoneId, zoneId))
    )

  return rows.map((row) => ({
    id: row.id,
    principalType: row.principalType as 'user' | 'org-role',
    principalId: row.principalId,
    role: row.role as CloudflareZoneRole
  }))
}

export const replaceZoneAcl = async (
  orgId: string,
  zoneId: string,
  entries: CloudflareZoneAclEntry[]
) => {
  const db = getDb()
  await db
    .delete(cloudflareDnsZoneAcls)
    .where(and(eq(cloudflareDnsZoneAcls.organizationId, orgId), eq(cloudflareDnsZoneAcls.zoneId, zoneId)))

  if (!entries.length) return

  const now = new Date()
  await db.insert(cloudflareDnsZoneAcls).values(
    entries.map((entry) => ({
      id: createId(),
      organizationId: orgId,
      zoneId,
      principalType: entry.principalType,
      principalId: entry.principalId,
      role: entry.role,
      createdAt: now,
      updatedAt: now
    }))
  )
}


