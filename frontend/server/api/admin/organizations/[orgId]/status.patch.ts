import { eq } from 'drizzle-orm'
import { createError, defineEventHandler, readBody } from 'h3'
import { z } from 'zod'
import { getDb } from '../../../../utils/db'
import { canAccessOrganization, requireTenantPermission } from '../../../../utils/rbac'
import { ensureAuthState } from '../../../../utils/session'
import { organizations } from '../../../../database/schema'
import { parseOrgParam, requireOrganizationByIdentifier } from '../utils'
import { logOrganizationAction } from '../../../../utils/audit'

const statusSchema = z.object({
  status: z.enum(['active', 'inactive'])
})

export default defineEventHandler(async (event) => {
  const orgParam = parseOrgParam(event)
  const { status } = statusSchema.parse(await readBody(event))
  const db = getDb()
  const auth = await ensureAuthState(event)
  
  if (!auth) {
    throw createError({ statusCode: 401, message: 'Not authenticated' })
  }

  const organization = await requireOrganizationByIdentifier(db, orgParam)

  // Super admins can always change status
  if (!auth.user.isSuperAdmin) {
    // Check if user has access to the organization
    const hasAccess = await canAccessOrganization(auth, organization.id)
    if (!hasAccess) {
      throw createError({
        statusCode: 403,
        message: 'Du har inte behörighet att ändra denna organisations status.'
      })
    }

    // If organization belongs to a provider tenant, user must be admin of that tenant
    if (organization.tenantId) {
      try {
        await requireTenantPermission(event, 'tenants:manage', organization.tenantId)
      } catch {
        throw createError({
          statusCode: 403,
          message: 'Du måste vara admin för leverantören som organisationen tillhör för att ändra status.'
        })
      }
    } else {
      // Organization without tenant - only super admins can manage
      throw createError({
        statusCode: 403,
        message: 'Endast superadmins kan hantera organisationer utan leverantör.'
      })
    }
  }

  if (organization.status === status) {
    return {
      organization: {
        ...organization,
        status
      }
    }
  }

  const oldStatus = organization.status

  await db
    .update(organizations)
    .set({
      status,
      updatedAt: new Date()
    })
    .where(eq(organizations.id, organization.id))

  // Log audit event
  await logOrganizationAction(event, 'ORGANIZATION_UPDATED', {
    changedFields: {
      status: {
        old: oldStatus,
        new: status
      }
    }
  }, organization.id)

  return {
    organization: {
      ...organization,
      status
    }
  }
})

