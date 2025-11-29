import { and, eq } from 'drizzle-orm'
import { createError, defineEventHandler, getRouterParam } from 'h3'
import { tenantInvitations, tenants } from '~/server/database/schema'
import { getDb } from '~/server/utils/db'
import { requireTenantPermission } from '~/server/utils/rbac'
import { logTenantAction } from '~/server/utils/audit'

export default defineEventHandler(async (event) => {
  const tenantId = getRouterParam(event, 'id')
  const inviteId = getRouterParam(event, 'inviteId')
  
  if (!tenantId) {
    throw createError({ statusCode: 400, message: 'Tenant ID saknas.' })
  }
  if (!inviteId) {
    throw createError({ statusCode: 400, message: 'Inbjudnings-ID saknas.' })
  }

  // Check permissions
  await requireTenantPermission(event, 'tenants:manage-members', tenantId)

  const db = getDb()
  const isSqlite =
    (process.env.DB_DIALECT ?? process.env.DRIZZLE_DIALECT ?? 'sqlite').toLowerCase() === 'sqlite'

  // Verify tenant exists
  const [tenant] = await db.select().from(tenants).where(eq(tenants.id, tenantId)).limit(1)
  if (!tenant) {
    throw createError({ statusCode: 404, message: 'Tenant hittades inte.' })
  }

  // Find the invitation
  const invitationRows = await db
    .select({
      id: tenantInvitations.id,
      email: tenantInvitations.email,
      role: tenantInvitations.role,
      status: tenantInvitations.status
    })
    .from(tenantInvitations)
    .where(
      and(
        eq(tenantInvitations.id, inviteId),
        eq(tenantInvitations.tenantId, tenantId)
      )
    )
    .limit(1)
  
  const invitation = isSqlite ? invitationRows[0] : invitationRows[0] ?? null

  if (!invitation) {
    throw createError({ statusCode: 404, message: 'Inbjudan hittades inte.' })
  }

  if (invitation.status !== 'pending') {
    throw createError({ statusCode: 409, message: 'Endast väntande inbjudningar kan avbrytas.' })
  }

  await db
    .update(tenantInvitations)
    .set({ status: 'cancelled', updatedAt: new Date() })
    .where(eq(tenantInvitations.id, inviteId))

  // SECURITY: Log cancellation for audit trail
  await logTenantAction(
    event,
    'INVITE_CANCELLED',
    {
      email: invitation.email,
      role: invitation.role,
      inviteId,
      tenantName: tenant.name
    },
    tenantId
  )

  return { success: true }
})
