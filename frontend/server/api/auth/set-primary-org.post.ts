import { createError, defineEventHandler, readBody } from 'h3'
import { eq } from 'drizzle-orm'
import { z } from 'zod'
import { requireSession } from '../../utils/session'
import { getDb } from '../../utils/db'
import { users } from '../../database/schema'
import { canAccessOrganization } from '../../utils/rbac'
import { logSecurityEvent } from '../../utils/audit'

const schema = z.object({
  orgId: z.string().min(1)
})

export default defineEventHandler(async (event) => {
  const { orgId } = schema.parse(await readBody(event))
  const auth = await requireSession(event)
  
  // Validate that user can access the organization (direct membership OR via tenant hierarchy)
  const canAccess = await canAccessOrganization(auth, orgId)
  if (!canAccess) {
    throw createError({
      statusCode: 403,
      message: 'Du har inte åtkomst till denna organisation.'
    })
  }
  
  const db = getDb()
  const oldDefaultOrgId = auth.user.defaultOrgId
  
  // Update user's default organization
  await db
    .update(users)
    .set({ defaultOrgId: orgId })
    .where(eq(users.id, auth.user.id))
  
  // Log audit event
  await logSecurityEvent(
    event,
    'USER_SET_PRIMARY_ORGANIZATION',
    {
      userId: auth.user.id,
      oldDefaultOrgId: oldDefaultOrgId ?? null,
      newDefaultOrgId: orgId
    },
    {
      userId: auth.user.id
    }
  )
  
  return { success: true, defaultOrgId: orgId }
})

