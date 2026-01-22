/**
 * POST /api/organizations/{orgId}/setup/complete
 * 
 * Marks the organization setup as complete.
 */
import { createError, defineEventHandler, getRouterParam } from 'h3'
import { requirePermission } from '~~/server/utils/rbac'
import { completeOrganizationSetup } from '~~/server/utils/orgSetup'
import { logOrganizationAction } from '~~/server/utils/audit'

export default defineEventHandler(async (event) => {
  const orgId = getRouterParam(event, 'orgId')
  if (!orgId) {
    throw createError({ statusCode: 400, message: 'Missing organization ID' })
  }

  await requirePermission(event, 'org:manage', orgId)

  // Mark setup as complete
  await completeOrganizationSetup(orgId)

  // Log audit event
  await logOrganizationAction(event, 'ORGANIZATION_SETUP_COMPLETED', {
    organizationId: orgId
  }, orgId)

  console.log(`[complete] Organization ${orgId} setup completed`)

  return {
    success: true,
    setupStatus: 'complete',
    setupCompletedAt: Date.now()
  }
})
