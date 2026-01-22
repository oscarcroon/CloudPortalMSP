import { createId } from '@paralleldrive/cuid2'
import { eq } from 'drizzle-orm'
import { createError, defineEventHandler, getRouterParam, readBody } from 'h3'
import { z } from 'zod'
import {
  mspOrgDelegationInvitations,
  mspOrgDelegations,
  mspOrgDelegationPermissions,
  users
} from '~~/server/database/schema'
import { getDb } from '~~/server/utils/db'
import { hashPassword } from '~~/server/utils/crypto'
import { createSession } from '~~/server/utils/session'
import { passwordSchema } from '~~/server/utils/password'
import { logUserAction } from '~~/server/utils/audit'

const registerSchema = z.object({
  fullName: z.string().min(1, 'Full name is required'),
  password: passwordSchema
})

export default defineEventHandler(async (event) => {
  const token = getRouterParam(event, 'token')
  if (!token) {
    throw createError({ statusCode: 400, message: 'Missing token' })
  }

  const payload = registerSchema.parse(await readBody(event))
  const db = getDb()

  // Find the invitation
  const [invite] = await db
    .select()
    .from(mspOrgDelegationInvitations)
    .where(eq(mspOrgDelegationInvitations.token, token))
    .limit(1)

  if (!invite) {
    throw createError({ statusCode: 404, message: 'Invitation not found' })
  }

  // Check status
  if (invite.status !== 'pending') {
    throw createError({ statusCode: 410, message: 'Invitation is no longer valid' })
  }

  // Check if expired
  const now = Date.now()
  const expiresAt = invite.expiresAt instanceof Date ? invite.expiresAt.getTime() : invite.expiresAt
  if (expiresAt && expiresAt < now) {
    await db
      .update(mspOrgDelegationInvitations)
      .set({ status: 'expired' })
      .where(eq(mspOrgDelegationInvitations.id, invite.id))
    throw createError({ statusCode: 410, message: 'Invitation has expired' })
  }

  // Check if user already exists
  const [existingUser] = await db
    .select()
    .from(users)
    .where(eq(users.email, invite.email))
    .limit(1)

  let userId: string

  if (existingUser) {
    // User exists but doesn't have password - update it
    if (existingUser.passwordHash) {
      throw createError({ statusCode: 409, message: 'User already has an account. Please log in instead.' })
    }

    const passwordHash = await hashPassword(payload.password)
    await db
      .update(users)
      .set({
        passwordHash,
        fullName: payload.fullName.trim(),
        updatedAt: new Date()
      })
      .where(eq(users.id, existingUser.id))
    
    userId = existingUser.id
  } else {
    // Create new user
    userId = createId()
    const passwordHash = await hashPassword(payload.password)
    
    await db.insert(users).values({
      id: userId,
      email: invite.email,
      fullName: payload.fullName.trim(),
      passwordHash,
      status: 'active',
      defaultOrgId: null // No default org for delegation users
    })
  }

  // Create the delegation
  const delegationId = createId()
  const nowDate = new Date()
  const permissionKeys = JSON.parse(invite.permissionKeys || '[]') as string[]
  const delegationExpiresAt = invite.delegationExpiresAt instanceof Date 
    ? invite.delegationExpiresAt 
    : (invite.delegationExpiresAt ? new Date(invite.delegationExpiresAt) : null)

  await db.insert(mspOrgDelegations).values({
    id: delegationId,
    orgId: invite.orgId,
    subjectType: 'user',
    subjectId: userId,
    createdBy: invite.invitedByUserId,
    expiresAt: delegationExpiresAt,
    note: invite.note,
    revokedAt: null,
    revokedBy: null,
    createdAt: nowDate,
    updatedAt: nowDate
  })

  // Add permissions
  if (permissionKeys.length > 0) {
    await db.insert(mspOrgDelegationPermissions).values(
      permissionKeys.map((permissionKey) => ({
        delegationId,
        permissionKey
      }))
    )
  }

  // Update invitation status
  await db
    .update(mspOrgDelegationInvitations)
    .set({
      status: 'accepted',
      acceptedAt: nowDate,
      delegationId
    })
    .where(eq(mspOrgDelegationInvitations.id, invite.id))

  // Create session and log in the user (createSession handles the cookie automatically)
  await createSession(event, userId)

  // Log the action
  await logUserAction(event, 'DELEGATION_INVITE_ACCEPTED', {
    inviteId: invite.id,
    organizationId: invite.orgId,
    delegationId,
    permissionKeys,
    userCreated: !existingUser
  }, userId)

  return {
    success: true,
    userId,
    delegationId,
    message: 'Account created and delegation activated'
  }
})
