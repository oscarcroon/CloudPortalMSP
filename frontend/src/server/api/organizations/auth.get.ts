import { defineEventHandler } from 'h3'
import { getDb } from '~/server/utils/db'
import { requirePermission } from '~/server/utils/rbac'
import { buildOrganizationDetailPayload } from '../admin/organizations/utils'

export default defineEventHandler(async (event) => {
  const { orgId } = await requirePermission(event, 'org:manage')
  const db = getDb()
  return buildOrganizationDetailPayload(db, orgId)
})

