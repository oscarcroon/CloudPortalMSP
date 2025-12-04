import { eq } from 'drizzle-orm'
import type { SupportedLocaleCode } from '~/constants/i18n'
import { users } from '~~/server/database/schema'
import { getDb } from '~~/server/utils/db'

export const updateUserLocale = async (userId: string, locale: SupportedLocaleCode) => {
  const db = getDb()
  await db
    .update(users)
    .set({
      locale,
      updatedAt: new Date()
    })
    .where(eq(users.id, userId))
}

