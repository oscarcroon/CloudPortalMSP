import { eq } from 'drizzle-orm'
import { defineEventHandler, readBody } from 'h3'
import {
  organizationAuthSettings,
  organizations
} from '../../../../database/schema'
import { getDb } from '../../../../utils/db'
import { requireSuperAdmin } from '../../../../utils/rbac'
import {
  buildOrganizationDetailPayload,
  ensureOrganizationAuthSettings,
  parseOrgParam,
  requireOrganizationByIdentifier,
  stringifyIdpConfig
} from '../utils'
import type { OrganizationIdpType } from '~/types/admin'
import { organizationAuthUpdateSchema } from '../../../organizations/auth.schema'
import {
  assertRequireSsoAllowed,
  prepareIdpConfigForStorage
} from '~/server/utils/idp'

export default defineEventHandler(async (event) => {
  await requireSuperAdmin(event)
  const orgParam = parseOrgParam(event)
  const payload = organizationAuthUpdateSchema.parse(await readBody(event))
  const db = getDb()
  const isSqlite =
    (process.env.DB_DIALECT ?? process.env.DRIZZLE_DIALECT ?? 'sqlite').toLowerCase() === 'sqlite'
  const organization = await requireOrganizationByIdentifier(db, orgParam)
  const authSettings = await ensureOrganizationAuthSettings(db, organization.id)

  const currentIdpType = authSettings.idpType as OrganizationIdpType
  let nextIdpType = currentIdpType
  if (payload.idpType !== undefined) {
    nextIdpType = payload.idpType
  }

  const parseExistingConfig = () => {
    if (!authSettings.idpConfig) return null
    try {
      return JSON.parse(authSettings.idpConfig) as Record<string, unknown>
    } catch {
      return null
    }
  }

  let nextIdpConfig = parseExistingConfig()
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
        tx.update(organizations).set(orgUpdates).where(eq(organizations.id, organization.id)).run()
      }
      if (Object.keys(authUpdates).length) {
        tx
          .update(organizationAuthSettings)
          .set(authUpdates)
          .where(eq(organizationAuthSettings.organizationId, organization.id))
          .run()
      }
    })
  } else {
    await db.transaction(async (tx) => {
      if (Object.keys(orgUpdates).length) {
        await tx.update(organizations).set(orgUpdates).where(eq(organizations.id, organization.id))
      }
      if (Object.keys(authUpdates).length) {
        await tx
          .update(organizationAuthSettings)
          .set(authUpdates)
          .where(eq(organizationAuthSettings.organizationId, organization.id))
      }
    })
  }

  return buildOrganizationDetailPayload(db, organization.id)
})

