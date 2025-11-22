import { eq } from 'drizzle-orm'
import { createError, defineEventHandler, readBody } from 'h3'
import {
  organizationAuthSettings,
  organizations
} from '~/server/database/schema'
import { getDb } from '~/server/utils/db'
import {
  assertRequireSsoAllowed,
  prepareIdpConfigForStorage
} from '~/server/utils/idp'
import { requirePermission } from '~/server/utils/rbac'
import {
  buildOrganizationDetailPayload,
  ensureOrganizationAuthSettings,
  stringifyIdpConfig
} from '../admin/organizations/utils'
import type { OrganizationIdpType } from '~/types/admin'
import { organizationAuthUpdateSchema } from './auth.schema'

const parseConfig = (raw: string | null) => {
  if (!raw) {
    return null
  }
  try {
    return JSON.parse(raw) as Record<string, unknown>
  } catch {
    return null
  }
}

export default defineEventHandler(async (event) => {
  const { orgId } = await requirePermission(event, 'org:manage')
  const payload = organizationAuthUpdateSchema.parse(await readBody(event))
  const db = getDb()
  const isSqlite =
    (process.env.DB_DIALECT ?? process.env.DRIZZLE_DIALECT ?? 'sqlite').toLowerCase() === 'sqlite'

  const [organization] = await db
    .select()
    .from(organizations)
    .where(eq(organizations.id, orgId))
    .limit(1)
  if (!organization) {
    throw createError({ statusCode: 404, message: 'Organisationen kunde inte hittas.' })
  }

  const authSettings = await ensureOrganizationAuthSettings(db, orgId)

  const currentIdpType = authSettings.idpType as OrganizationIdpType
  let nextIdpType = currentIdpType
  if (payload.idpType !== undefined) {
    nextIdpType = payload.idpType
  }

  let nextIdpConfig = parseConfig(authSettings.idpConfig)
  if (payload.idpConfig !== undefined) {
    nextIdpConfig = prepareIdpConfigForStorage(
      payload.idpType !== undefined ? payload.idpType : nextIdpType,
      payload.idpConfig
    )
  } else if (payload.idpType === 'none') {
    nextIdpConfig = null
  }

  const nextRequireSso =
    payload.requireSso !== undefined ? payload.requireSso : Boolean(organization.requireSso)

  assertRequireSsoAllowed({
    requireSso: nextRequireSso,
    idpType: nextIdpType,
    idpConfig: nextIdpConfig
  })

  const orgUpdates: Partial<typeof organizations.$inferInsert> = {}
  if (payload.requireSso !== undefined) orgUpdates.requireSso = payload.requireSso
  if (payload.allowSelfSignup !== undefined) orgUpdates.allowSelfSignup = payload.allowSelfSignup

  const authUpdates: Partial<typeof organizationAuthSettings.$inferInsert> = {}
  if (payload.requireSso !== undefined) authUpdates.ssoEnforced = payload.requireSso
  if (payload.idpType !== undefined) authUpdates.idpType = payload.idpType
  if (payload.allowLocalLoginForOwners !== undefined) {
    authUpdates.allowLocalLoginForOwners = payload.allowLocalLoginForOwners
  }
  if (payload.idpConfig !== undefined) {
    authUpdates.idpConfig = stringifyIdpConfig(nextIdpConfig) ?? null
  } else if (payload.idpType === 'none') {
    authUpdates.idpConfig = null
  }

  if (isSqlite) {
    db.transaction((tx) => {
      if (Object.keys(orgUpdates).length) {
        tx.update(organizations).set(orgUpdates).where(eq(organizations.id, orgId)).run()
      }
      if (Object.keys(authUpdates).length) {
        tx
          .update(organizationAuthSettings)
          .set(authUpdates)
          .where(eq(organizationAuthSettings.organizationId, orgId))
          .run()
      }
    })
  } else {
    await db.transaction(async (tx) => {
      if (Object.keys(orgUpdates).length) {
        await tx.update(organizations).set(orgUpdates).where(eq(organizations.id, orgId))
      }
      if (Object.keys(authUpdates).length) {
        await tx
          .update(organizationAuthSettings)
          .set(authUpdates)
          .where(eq(organizationAuthSettings.organizationId, orgId))
      }
    })
  }

  return buildOrganizationDetailPayload(db, orgId)
})

