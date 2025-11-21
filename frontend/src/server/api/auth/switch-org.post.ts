import { createError, defineEventHandler, readBody } from 'h3'
import { z } from 'zod'
import { ensureMembership } from '../../utils/auth'
import { refreshSession, requireSession } from '../../utils/session'

const schema = z.object({
  organizationId: z.string().min(1)
})

export default defineEventHandler(async (event) => {
  const { organizationId } = schema.parse(await readBody(event))
  const auth = await requireSession(event)
  await ensureMembership(auth.user.id, organizationId)
  const updated = await refreshSession(event, organizationId)
  return updated
})

