import { createError, defineEventHandler } from 'h3'
import { getDb } from '../../../../utils/db'
import { canAccessOrganization, requireTenantPermission } from '../../../../utils/rbac'
import { ensureAuthState } from '../../../../utils/session'
import {
  buildOrganizationDetailPayload,
  parseOrgParam,
  requireOrganizationByIdentifier
} from '../utils'

export default defineEventHandler(async (event) => {
  const orgParam = parseOrgParam(event)
  const db = getDb()
  const auth = await ensureAuthState(event)
  
  if (!auth) {
    throw createError({ statusCode: 401, message: 'Not authenticated' })
  }

  const organization = await requireOrganizationByIdentifier(db, orgParam)

  // Super admins can always access
  if (!auth.user.isSuperAdmin) {
    // Check if user has access to the organization
    const hasAccess = await canAccessOrganization(auth, organization.id)
    if (!hasAccess) {
      throw createError({
        statusCode: 403,
        message: 'Du har inte behörighet att se denna organisation.'
      })
    }

    // If organization belongs to a provider tenant, user must have read permission for that tenant
    if (organization.tenantId) {
      try {
        await requireTenantPermission(event, 'tenants:read', organization.tenantId)
      } catch {
        throw createError({
          statusCode: 403,
          message: 'Du måste ha läsbehörighet för leverantören som organisationen tillhör.'
        })
      }
    } else {
      // Organization without tenant - only super admins can access
      throw createError({
        statusCode: 403,
        message: 'Endast superadmins kan se organisationer utan leverantör.'
      })
    }
  }

  const detail = await buildOrganizationDetailPayload(db, organization.id)
  return detail
})

