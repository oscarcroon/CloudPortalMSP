/**
 * Organization setup utilities.
 * 
 * Handles initialization of new organizations with:
 * - Blocked module policies (requires wizard to enable)
 * - Default organization groups
 * - Owner assignment to Admins group
 * - Default group for new members
 */

import { createId } from '@paralleldrive/cuid2'
import { eq, and } from 'drizzle-orm'
import { getDb } from './db'
import {
  organizations,
  organizationModulePolicies,
  orgGroups,
  orgGroupMembers
} from '../database/schema'
import { getAllRegistryModules } from '~~/server/modules/registry'
import { DEFAULT_ORG_GROUPS } from './orgRoleTemplates'

export interface InitializeOrgResult {
  /** Map of group slug -> group ID */
  groupIds: Record<string, string>
  /** ID of the default group (Members) */
  defaultGroupId: string
  /** Number of modules that were blocked */
  modulesBlocked: number
  /** Whether initialization actually ran (false if already initialized) */
  initialized: boolean
}

/**
 * Initialize a new organization with setup wizard requirements.
 * 
 * This function is idempotent - it can be called multiple times safely.
 * 
 * It will:
 * 1. Set organization setupStatus to 'pending' (only if not already set)
 * 2. Create standard organization groups (idempotent)
 * 3. Add the owner to the Org Admins group
 * 4. Set the default group for new members to "Members"
 * 5. Create blocked module policies for all modules (idempotent)
 * 
 * @param orgId - The organization ID
 * @param ownerUserId - The owner's user ID (will be added to Org Admins group)
 */
export async function initializeNewOrganization(params: {
  orgId: string
  ownerUserId: string
}): Promise<InitializeOrgResult> {
  const { orgId, ownerUserId } = params
  const db = getDb()
  
  // Check if organization already has setup complete
  const [existingOrg] = await db
    .select({ setupStatus: organizations.setupStatus })
    .from(organizations)
    .where(eq(organizations.id, orgId))
    .limit(1)

  // If already complete, skip initialization
  if (existingOrg?.setupStatus === 'complete') {
    console.log(`[orgSetup] Organization ${orgId} already has setupStatus=complete, skipping init`)
    return {
      groupIds: {},
      defaultGroupId: '',
      modulesBlocked: 0,
      initialized: false
    }
  }

  // Get all modules from registry
  const allModules = getAllRegistryModules()
  
  const groupIds: Record<string, string> = {}
  let defaultGroupId = ''
  let modulesBlocked = 0

  // Use transaction for atomic operations
  await db.transaction(async (tx) => {
    // 1. Set setupStatus to pending (if not already)
    await tx.update(organizations)
      .set({ setupStatus: 'pending' })
      .where(eq(organizations.id, orgId))

    // 2. Create default organization groups (idempotent - check if exists first)
    for (const groupTemplate of DEFAULT_ORG_GROUPS) {
      // Check if group already exists
      const [existingGroup] = await tx
        .select({ id: orgGroups.id })
        .from(orgGroups)
        .where(
          and(
            eq(orgGroups.organizationId, orgId),
            eq(orgGroups.slug, groupTemplate.slug)
          )
        )
        .limit(1)

      if (existingGroup) {
        groupIds[groupTemplate.slug] = existingGroup.id
      } else {
        const groupId = createId()
        groupIds[groupTemplate.slug] = groupId
        
        await tx.insert(orgGroups).values({
          id: groupId,
          organizationId: orgId,
          name: groupTemplate.name,
          slug: groupTemplate.slug,
          description: groupTemplate.description
        })
      }
    }

    // Set defaultGroupId to "members" group
    defaultGroupId = groupIds['members'] ?? ''

    // 3. Add owner to Org Admins group (idempotent)
    const adminsGroupId = groupIds['org-admins']
    if (adminsGroupId && ownerUserId) {
      // Check if membership already exists
      const [existingMembership] = await tx
        .select({ id: orgGroupMembers.id })
        .from(orgGroupMembers)
        .where(
          and(
            eq(orgGroupMembers.groupId, adminsGroupId),
            eq(orgGroupMembers.userId, ownerUserId)
          )
        )
        .limit(1)

      if (!existingMembership) {
        await tx.insert(orgGroupMembers).values({
          id: createId(),
          groupId: adminsGroupId,
          userId: ownerUserId
        })
      }
    }

    // 4. Update organization with default group (if not set)
    if (defaultGroupId) {
      await tx.update(organizations)
        .set({ defaultGroupId })
        .where(
          and(
            eq(organizations.id, orgId)
          )
        )
    }

    // 5. Create blocked module policies for all modules (idempotent)
    for (const module of allModules) {
      // Check if policy already exists
      const [existingPolicy] = await tx
        .select({ id: organizationModulePolicies.id })
        .from(organizationModulePolicies)
        .where(
          and(
            eq(organizationModulePolicies.organizationId, orgId),
            eq(organizationModulePolicies.moduleId, module.id)
          )
        )
        .limit(1)

      if (!existingPolicy) {
        await tx.insert(organizationModulePolicies).values({
          id: createId(),
          organizationId: orgId,
          moduleId: module.id,
          mode: 'blocked',
          enabled: false,
          disabled: true,
          allowedRoles: '[]',
          permissionOverrides: '{}'
        })
        modulesBlocked++
      }
    }
  })

  console.log(`[orgSetup] Initialized org ${orgId}: ${modulesBlocked} modules blocked, defaultGroupId=${defaultGroupId}`)

  return {
    groupIds,
    defaultGroupId,
    modulesBlocked,
    initialized: true
  }
}

/**
 * Mark an organization's setup as complete.
 * Called after the admin completes the setup wizard.
 */
export async function completeOrganizationSetup(orgId: string): Promise<void> {
  const db = getDb()
  
  await db.update(organizations)
    .set({
      setupStatus: 'complete',
      setupCompletedAt: new Date()
    })
    .where(eq(organizations.id, orgId))
    
  console.log(`[orgSetup] Marked org ${orgId} setup as complete`)
}

/**
 * Check if an organization requires setup wizard.
 */
export async function isOrganizationSetupPending(orgId: string): Promise<boolean> {
  const db = getDb()
  
  const [org] = await db
    .select({ setupStatus: organizations.setupStatus })
    .from(organizations)
    .where(eq(organizations.id, orgId))
    .limit(1)

  return org?.setupStatus === 'pending'
}

/**
 * Get the setup status of an organization.
 */
export async function getOrganizationSetupStatus(orgId: string): Promise<'pending' | 'complete' | null> {
  const db = getDb()
  
  const [org] = await db
    .select({ setupStatus: organizations.setupStatus })
    .from(organizations)
    .where(eq(organizations.id, orgId))
    .limit(1)

  return org?.setupStatus ?? null
}

/**
 * Assign a user to the organization's default group if one is configured.
 * This should be called when a new membership is created.
 * 
 * @param orgId - The organization ID
 * @param userId - The user ID to assign
 * @returns true if user was assigned to a group, false otherwise
 */
export async function assignUserToDefaultGroup(params: {
  orgId: string
  userId: string
}): Promise<boolean> {
  const { orgId, userId } = params
  const db = getDb()

  // Get organization's default group
  const [org] = await db
    .select({ defaultGroupId: organizations.defaultGroupId })
    .from(organizations)
    .where(eq(organizations.id, orgId))
    .limit(1)

  if (!org?.defaultGroupId) {
    return false
  }

  // Check if user is already in the group
  const [existingMembership] = await db
    .select({ id: orgGroupMembers.id })
    .from(orgGroupMembers)
    .where(
      and(
        eq(orgGroupMembers.groupId, org.defaultGroupId),
        eq(orgGroupMembers.userId, userId)
      )
    )
    .limit(1)

  if (existingMembership) {
    // Already a member
    return false
  }

  // Add user to default group
  await db.insert(orgGroupMembers).values({
    id: createId(),
    groupId: org.defaultGroupId,
    userId
  })

  console.log(`[orgSetup] Assigned user ${userId} to default group ${org.defaultGroupId} in org ${orgId}`)
  return true
}
