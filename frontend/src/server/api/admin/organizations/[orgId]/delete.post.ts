import { eq } from 'drizzle-orm'
import { createError, defineEventHandler, readBody } from 'h3'
import { z } from 'zod'
import { organizations } from '../../../../database/schema'
import { getDb } from '../../../../utils/db'
import { requireSuperAdmin } from '../../../../utils/rbac'
import { parseOrgParam, requireOrganizationByIdentifier } from '../utils'
import { logOrganizationAction } from '../../../../utils/audit'

export const deleteSchema = z.object({
  confirmSlug: z.string().min(1, 'Ange sluggen för att bekräfta.'),
  acknowledgeImpact: z.literal(true, {
    errorMap: () => ({ message: 'Du måste bekräfta konsekvenserna.' })
  })
})

export default defineEventHandler(async (event) => {
  await requireSuperAdmin(event)
  const orgParam = parseOrgParam(event)
  const payload = deleteSchema.parse(await readBody(event))
  const db = getDb()
  const isSqlite =
    (process.env.DB_DIALECT ?? process.env.DRIZZLE_DIALECT ?? 'sqlite').toLowerCase() === 'sqlite'
  const organization = await requireOrganizationByIdentifier(db, orgParam)

  if (payload.confirmSlug !== organization.slug) {
    throw createError({
      statusCode: 400,
      message: 'Sluggen matchar inte organisationen.'
    })
  }

  // Store org info for audit log before deletion
  const orgInfo = {
    name: organization.name,
    slug: organization.slug,
    tenantId: organization.tenantId || undefined
  }

  if (isSqlite) {
    db.transaction((tx) => {
      tx.delete(organizations).where(eq(organizations.id, organization.id)).run()
    })
  } else {
    await db.transaction(async (tx) => {
      await tx.delete(organizations).where(eq(organizations.id, organization.id))
    })
  }

  // Log audit event
  await logOrganizationAction(event, 'ORGANIZATION_DELETED', {
    organizationName: orgInfo.name,
    organizationSlug: orgInfo.slug,
    tenantId: orgInfo.tenantId
  }, organization.id)

  return { success: true }
})


