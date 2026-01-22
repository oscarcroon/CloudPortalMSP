import { createError, defineEventHandler, getRouterParam } from 'h3'
import { requireSuperAdmin } from '~~/server/utils/rbac'
import { fetchUserRecord } from '../helpers'
import { EmailDeliveryError, triggerPasswordReset } from '~~/server/utils/passwordReset'

export default defineEventHandler(async (event) => {
  await requireSuperAdmin(event)
  const userId = getRouterParam(event, 'userId')
  if (!userId) {
    throw createError({ statusCode: 400, message: 'Saknar användar-id.' })
  }
  const user = await fetchUserRecord(userId)
  try {
    await triggerPasswordReset(user.id, user.email)
  } catch (error) {
    if (error instanceof EmailDeliveryError) {
      throw createError({
        statusCode: 502,
        message: `Kunde inte skicka återställningsmail. ${error.message}`
      })
    }
    throw error
  }
  return { success: true }
})


