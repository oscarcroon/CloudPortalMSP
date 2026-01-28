import { eq } from 'drizzle-orm'
import { createError, defineEventHandler, getRouterParam } from 'h3'
import {
  mspOrgDelegationInvitations,
  organizations,
  users
} from '~~/server/database/schema'
import { getDb } from '~~/server/utils/db'

export default defineEventHandler(async (event) => {
  const token = getRouterParam(event, 'token')
  if (!token) {
    throw createError({ statusCode: 400, message: 'Missing token' })
  }

  const db = getDb()

  // Find the invitation
  const [invite] = await db
    .select({
      id: mspOrgDelegationInvitations.id,
      orgId: mspOrgDelegationInvitations.orgId,
      email: mspOrgDelegationInvitations.email,
      permissionKeys: mspOrgDelegationInvitations.permissionKeys,
      note: mspOrgDelegationInvitations.note,
      status: mspOrgDelegationInvitations.status,
      expiresAt: mspOrgDelegationInvitations.expiresAt,
      invitedByUserId: mspOrgDelegationInvitations.invitedByUserId
    })
    .from(mspOrgDelegationInvitations)
    .where(eq(mspOrgDelegationInvitations.token, token))
    .limit(1)

  if (!invite) {
    throw createError({ statusCode: 404, message: 'Invitation not found' })
  }

  // Check if expired
  const now = Date.now()
  const expiresAt = invite.expiresAt instanceof Date ? invite.expiresAt.getTime() : invite.expiresAt
  if (expiresAt && expiresAt < now && invite.status === 'pending') {
    // Update status to expired
    await db
      .update(mspOrgDelegationInvitations)
      .set({ status: 'expired' })
      .where(eq(mspOrgDelegationInvitations.id, invite.id))
    invite.status = 'expired'
  }

  // Get organization info
  const [org] = await db
    .select({ id: organizations.id, name: organizations.name })
    .from(organizations)
    .where(eq(organizations.id, invite.orgId))
    .limit(1)

  if (!org) {
    throw createError({ statusCode: 404, message: 'Organization not found' })
  }

  // Get inviter info
  let invitedByName: string | null = null
  if (invite.invitedByUserId) {
    const [inviter] = await db
      .select({ fullName: users.fullName, email: users.email })
      .from(users)
      .where(eq(users.id, invite.invitedByUserId))
      .limit(1)
    invitedByName = inviter?.fullName || inviter?.email || null
  }

  // Check if user already exists
  const [existingUser] = await db
    .select({ id: users.id, passwordHash: users.passwordHash })
    .from(users)
    .where(eq(users.email, invite.email))
    .limit(1)

  const permissionKeys = JSON.parse(invite.permissionKeys || '[]') as string[]

  return {
    invitation: {
      id: invite.id,
      email: invite.email,
      organizationId: org.id,
      organizationName: org.name,
      permissionCount: permissionKeys.length,
      note: invite.note,
      status: invite.status,
      expiresAt: new Date(expiresAt).toISOString(),
      invitedBy: invitedByName
    },
    emailExists: Boolean(existingUser),
    hasPassword: Boolean(existingUser?.passwordHash)
  }
})
