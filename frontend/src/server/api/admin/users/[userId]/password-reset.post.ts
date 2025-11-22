import { createError, defineEventHandler, getRouterParam } from 'h3'
import { requireSuperAdmin } from '~/server/utils/rbac'
import { fetchUserRecord } from '../helpers'
import { triggerPasswordReset } from '~/server/utils/passwordReset'

export default defineEventHandler(async (event) => {
  await requireSuperAdmin(event)
  const userId = getRouterParam(event, 'userId')
  if (!userId) {
    throw createError({ statusCode: 400, message: 'Saknar användar-id.' })
  }
  const user = await fetchUserRecord(userId)
  await triggerPasswordReset(user.id, user.email)
  return { success: true }
})


