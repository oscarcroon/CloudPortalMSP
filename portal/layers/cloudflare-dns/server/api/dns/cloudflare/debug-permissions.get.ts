import { createError, defineEventHandler } from 'h3'
import { and, eq } from 'drizzle-orm'
import { ensureAuthState } from '~~/server/utils/session'
import { resolveEffectiveModulePermissions } from '~~/server/utils/modulePermissions'
import { getDb } from '~~/server/utils/db'
import { organizationMemberships } from '~~/server/database/schema'

/**
 * Diagnostic endpoint: returns full permission resolution details for the
 * current user on the cloudflare-dns module. Helps debug "Access Denied"
 * issues on the admin page.
 *
 * Restricted to org owners, admins, and super admins.
 */
export default defineEventHandler(async (event) => {
  const auth = await ensureAuthState(event)
  if (!auth?.currentOrgId) {
    throw createError({ statusCode: 400, message: 'Organisation saknas i sessionen.' })
  }

  const orgId = auth.currentOrgId
  const userId = auth.user.id

  // Only allow super admins, org owners, and org admins
  if (!auth.user.isSuperAdmin) {
    const db = getDb()
    const [membership] = await db
      .select({ role: organizationMemberships.role })
      .from(organizationMemberships)
      .where(
        and(
          eq(organizationMemberships.organizationId, orgId),
          eq(organizationMemberships.userId, userId)
        )
      )

    const allowedRoles = ['owner', 'admin']
    if (!membership || !allowedRoles.includes(membership.role)) {
      throw createError({
        statusCode: 403,
        message: 'Only org owners, admins, or super admins can access permission diagnostics.'
      })
    }
  }

  const perms = await resolveEffectiveModulePermissions({
    orgId,
    moduleKey: 'cloudflare-dns',
    userId
  })

  return {
    userId,
    orgId,
    isSuperAdmin: auth.user.isSuperAdmin ?? false,
    policy: {
      mode: perms.policy.mode,
      enabled: perms.policy.enabled,
      disabled: perms.policy.disabled,
      allowedPermissions: perms.policy.allowedPermissions,
      allowedRoles: perms.policy.allowedRoles
    },
    baselinePermissions: [...perms.baselinePermissions],
    allowedPermissions: [...perms.allowedPermissions],
    effectivePermissions: [...perms.effectivePermissions],
    delegatedGrants: perms.delegatedGrants ? [...perms.delegatedGrants] : [],
    userGrants: [...perms.userGrants],
    userDenies: [...perms.userDenies],
    groupGrants: Object.fromEntries(
      [...perms.groupGrants.entries()].map(([k, v]) => [k, [...v]])
    ),
    groupDenies: Object.fromEntries(
      [...perms.groupDenies.entries()].map(([k, v]) => [k, [...v]])
    )
  }
})
