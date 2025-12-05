import { createError, defineEventHandler, readBody } from 'h3'
import { z } from 'zod'
import { DEFAULT_LOCALE, SUPPORTED_LOCALE_CODES, type SupportedLocaleCode } from '~/constants/i18n'
import { updateUserLocale } from '~~/server/services/userProfile'
import { requireSession } from '~~/server/utils/session'
import { logUserAction } from '~~/server/utils/audit'

const localeEnumValues = SUPPORTED_LOCALE_CODES as [SupportedLocaleCode, ...SupportedLocaleCode[]]

const payloadSchema = z.object({
  locale: z.enum(localeEnumValues)
})

export default defineEventHandler(async (event) => {
  const auth = await requireSession(event)
  const rawBody = await readBody<{ locale?: string }>(event)
  const parsed = payloadSchema.safeParse(rawBody)

  if (!parsed.success) {
    throw createError({ statusCode: 400, statusMessage: 'Invalid locale' })
  }

  const nextLocale = parsed.data.locale ?? DEFAULT_LOCALE
  const previousLocale = auth.user.locale ?? DEFAULT_LOCALE

  if (nextLocale === previousLocale) {
    return { locale: nextLocale }
  }

  await updateUserLocale(auth.user.id, nextLocale)
  auth.user.locale = nextLocale

  await logUserAction(event, 'USER_UPDATED', { field: 'locale', from: previousLocale, to: nextLocale }, auth.user.id)

  return { locale: nextLocale }
})

