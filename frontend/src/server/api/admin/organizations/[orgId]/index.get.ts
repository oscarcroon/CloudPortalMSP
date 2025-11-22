import { defineEventHandler } from 'h3'
import { getDb } from '../../../../utils/db'
import { requireSuperAdmin } from '../../../../utils/rbac'
import {
  buildOrganizationDetailPayload,
  parseOrgParam,
  requireOrganizationByIdentifier
} from '../utils'

export default defineEventHandler(async (event) => {
  await requireSuperAdmin(event)
  const orgParam = parseOrgParam(event)
  const db = getDb()
  const organization = await requireOrganizationByIdentifier(db, orgParam)
  const detail = await buildOrganizationDetailPayload(db, organization.id)
  return detail
})

