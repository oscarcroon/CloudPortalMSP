import { and, eq } from 'drizzle-orm'
import { createError, defineEventHandler, getRouterParam } from 'h3'
import { tenantInvitations, tenants } from '~~/server/database/schema'
import { getDb } from '~~/server/utils/db'
import { requireTenantPermission } from '~~/server/utils/rbac'
import { sendDistributorInvitationEmail } from '~~/server/utils/mailer'
import { ensureAuthState } from '~~/server/utils/session'
import { logTenantAction } from '~~/server/utils/audit'

export default defineEventHandler(async (event) => {
  const tenantId = getRouterParam(event, 'id')
  const inviteId = getRouterParam(event, 'inviteId')

  if (!tenantId) {
    throw createError({ statusCode: 400, message: 'Tenant ID saknas.' })
  }
  if (!inviteId) {
    throw createError({ statusCode: 400, message: 'Inbjudnings-ID saknas.' })
  }

  await requireTenantPermission(event, 'tenants:manage-members', tenantId)
  const auth = await ensureAuthState(event)

  const db = getDb()
  const [tenant] = await db.select().from(tenants).where(eq(tenants.id, tenantId)).limit(1)
  if (!tenant) {
    throw createError({ statusCode: 404, message: 'Tenant hittades inte.' })
  }
  if (tenant.type !== 'provider' && tenant.type !== 'distributor') {
    throw createError({ statusCode: 400, message: 'Endast leverantörer och distributörer stöder inbjudningar.' })
  }

  const [invitation] = await db
    .select({
      id: tenantInvitations.id,
      email: tenantInvitations.email,
      role: tenantInvitations.role,
      status: tenantInvitations.status,
      token: tenantInvitations.token,
      expiresAt: tenantInvitations.expiresAt,
      organizationData: tenantInvitations.organizationData
    })
    .from(tenantInvitations)
    .where(
      and(eq(tenantInvitations.id, inviteId), eq(tenantInvitations.tenantId, tenantId))
    )
    .limit(1)

  if (!invitation) {
    throw createError({ statusCode: 404, message: 'Inbjudan hittades inte.' })
  }

  if (invitation.status !== 'pending') {
    throw createError({ statusCode: 409, message: 'Endast väntande inbjudningar kan skickas om.' })
  }

  const expiresAtMs =
    invitation.expiresAt instanceof Date
      ? invitation.expiresAt.getTime()
      : typeof invitation.expiresAt === 'number'
        ? invitation.expiresAt
        : new Date(invitation.expiresAt).getTime()

  if (!Number.isFinite(expiresAtMs)) {
    throw createError({ statusCode: 400, message: 'Inbjudan saknar giltigt utgångsdatum. Skapa en ny inbjudan istället.' })
  }

  if (expiresAtMs < Date.now()) {
    await db
      .update(tenantInvitations)
      .set({ status: 'expired', updatedAt: new Date() })
      .where(eq(tenantInvitations.id, inviteId))
    throw createError({ statusCode: 410, message: 'Inbjudan har gått ut. Skapa en ny inbjudan.' })
  }

  let organizationName: string | undefined
  let willCreateOrganization = false
  if (invitation.organizationData) {
    try {
      const data = JSON.parse(invitation.organizationData)
      organizationName = data?.name
      willCreateOrganization = Boolean(organizationName)
    } catch {
      // Ignore invalid JSON
    }
  }

  const invitedByLabel = auth?.user?.email ?? auth?.user?.fullName ?? 'System'

  await sendDistributorInvitationEmail({
    tenantId: tenant.id,
    tenantName: tenant.name,
    tenantType: tenant.type as 'provider' | 'distributor',
    to: invitation.email,
    expiresAt: expiresAtMs,
    token: invitation.token,
    invitedBy: invitedByLabel,
    willCreateOrganization,
    organizationName
  })

  await logTenantAction(
    event,
    'INVITE_RESENT',
    {
      inviteId: invitation.id,
      email: invitation.email,
      tenantName: tenant.name,
      role: invitation.role
    },
    tenant.id
  )

  return { success: true, message: 'Inbjudan skickades igen.' }
})

