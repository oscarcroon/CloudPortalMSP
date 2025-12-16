import type { AuthState } from '../types/auth'
import { getDb } from './db'
import { organizations, tenantMemberships, tenantMemberRoles, mspOrgDelegations, tenantMemberMspRoles, mspRoles } from '../database/schema'
import { eq, and, isNull, or, gt } from 'drizzle-orm'
import { canAccessTenant } from './rbac'

/**
 * Centralized function to check if a user can reach an organization.
 * 
 * Returns true if:
 * 1. User has direct organization membership, OR
 * 2. User has tenant membership with includeChildren=true AND at least one msp-* role, OR
 * 3. User has active LIST-scope delegation (source='msp_scope') for org AND at least one msp-* role, OR
 * 4. User has active ad-hoc org-delegation (source='ad_hoc' or null) for org (regardless of msp-role)
 * 
 * Important: includeChildren=true without msp-role must NEVER give reach.
 */
export async function canReachOrganization(
  auth: AuthState | null,
  organizationId: string
): Promise<boolean> {
  if (!auth) {
    return false
  }

  const db = getDb()

  // Get organization
  const [org] = await db
    .select()
    .from(organizations)
    .where(eq(organizations.id, organizationId))
    .limit(1)

  if (!org) {
    return false
  }

  // Check if organization is active (super admins can always access)
  if (org.status !== 'active' && !auth.user.isSuperAdmin) {
    return false
  }

  // Super admins can always access active organizations
  if (auth.user.isSuperAdmin) {
    return true
  }

  // 1. Check if user has direct organization membership
  if (auth.orgRoles[organizationId]) {
    return true
  }

  if (!org.tenantId) {
    return false
  }

  // 2. Check tenant membership with includeChildren + MSP roles (ALL scope)
  for (const tenantId of Object.keys(auth.tenantRoles)) {
    const includeChildren = auth.tenantIncludeChildren?.[tenantId] ?? false
    
    if (includeChildren) {
      // Check if user can access tenant hierarchy
      const canReachTenant = await canAccessTenant(auth, tenantId, org.tenantId)
      if (!canReachTenant) {
        continue
      }

      // Check if user has at least one msp-* role for this tenant
      const hasMspRole = await hasMspRoleForTenant(auth.user.id, tenantId)
      if (hasMspRole) {
        return true
      }
    } else {
      // Without includeChildren, can only access direct tenant
      if (tenantId === org.tenantId) {
        // Still need to check for MSP role if we want to allow reach
        // But for direct tenant access, we might allow it without MSP role
        // For now, let's require MSP role even for direct tenant
        const hasMspRole = await hasMspRoleForTenant(auth.user.id, tenantId)
        if (hasMspRole) {
          return true
        }
      }
    }
  }

  // 3. Check LIST-scope delegation (source='msp_scope') + MSP role
  const now = new Date()
  const [listScopeDelegation] = await db
    .select()
    .from(mspOrgDelegations)
    .where(
      and(
        eq(mspOrgDelegations.orgId, organizationId),
        eq(mspOrgDelegations.subjectType, 'user'),
        eq(mspOrgDelegations.subjectId, auth.user.id),
        eq(mspOrgDelegations.source, 'msp_scope'),
        isNull(mspOrgDelegations.revokedAt),
        or(
          isNull(mspOrgDelegations.expiresAt),
          gt(mspOrgDelegations.expiresAt, now)
        )
      )
    )
    .limit(1)

  if (listScopeDelegation && org.tenantId) {
    // Check if user has at least one msp-* role for the org's tenant
    const hasMspRole = await hasMspRoleForTenant(auth.user.id, org.tenantId)
    if (hasMspRole) {
      return true
    }
  }

  // 4. Check ad-hoc delegation (source='ad_hoc' or null for legacy) - no MSP role required
  const [adHocDelegation] = await db
    .select()
    .from(mspOrgDelegations)
    .where(
      and(
        eq(mspOrgDelegations.orgId, organizationId),
        eq(mspOrgDelegations.subjectType, 'user'),
        eq(mspOrgDelegations.subjectId, auth.user.id),
        or(
          eq(mspOrgDelegations.source, 'ad_hoc'),
          isNull(mspOrgDelegations.source) // Legacy delegations without source
        ),
        isNull(mspOrgDelegations.revokedAt),
        or(
          isNull(mspOrgDelegations.expiresAt),
          gt(mspOrgDelegations.expiresAt, now)
        )
      )
    )
    .limit(1)

  if (adHocDelegation) {
    return true
  }

  return false
}

/**
 * Check if user has at least one msp-* role for a tenant
 */
async function hasMspRoleForTenant(userId: string, tenantId: string): Promise<boolean> {
  const db = getDb()

  // Get tenant membership
  const [membership] = await db
    .select({ id: tenantMemberships.id, role: tenantMemberships.role })
    .from(tenantMemberships)
    .where(
      and(
        eq(tenantMemberships.tenantId, tenantId),
        eq(tenantMemberships.userId, userId)
      )
    )
    .limit(1)

  if (!membership) {
    return false
  }

  // Check if primary role is msp-*
  if (membership.role.startsWith('msp-')) {
    return true
  }

  // Check additional roles in tenantMemberRoles (legacy string-based roles)
  const additionalRoles = await db
    .select({ roleKey: tenantMemberRoles.roleKey })
    .from(tenantMemberRoles)
    .where(eq(tenantMemberRoles.membershipId, membership.id))

  if (additionalRoles.some((r) => r.roleKey.startsWith('msp-'))) {
    return true
  }

  // Check DB-based MSP roles from tenantMemberMspRoles
  const dbMspRoles = await db
    .select({ roleKey: mspRoles.key })
    .from(tenantMemberMspRoles)
    .innerJoin(mspRoles, eq(mspRoles.id, tenantMemberMspRoles.roleId))
    .where(
      and(
        eq(tenantMemberMspRoles.tenantMembershipId, membership.id),
        eq(mspRoles.tenantId, tenantId)
      )
    )

  return dbMspRoles.length > 0
}
