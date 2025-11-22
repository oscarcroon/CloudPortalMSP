import { eq } from 'drizzle-orm'
import { defineEventHandler, readBody } from 'h3'
import { z } from 'zod'
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

const authSchema = z
  .object({
    requireSso: z.boolean().optional(),
    allowSelfSignup: z.boolean().optional(),
    idpType: z.enum(['none', 'saml', 'oidc']).optional(),
    allowLocalLoginForOwners: z.boolean().optional(),
    idpConfig: z.record(z.any()).nullable().optional()
  })
  .refine(
    (payload) =>
      payload.requireSso !== undefined ||
      payload.allowSelfSignup !== undefined ||
      payload.idpType !== undefined ||
      payload.allowLocalLoginForOwners !== undefined ||
      payload.idpConfig !== undefined,
    { message: 'Inga ändringar angavs.' }
  )

export default defineEventHandler(async (event) => {
  await requireSuperAdmin(event)
  const orgParam = parseOrgParam(event)
  const payload = authSchema.parse(await readBody(event))
  const db = getDb()
  const isSqlite =
    (process.env.DB_DIALECT ?? process.env.DRIZZLE_DIALECT ?? 'sqlite').toLowerCase() === 'sqlite'
  const organization = await requireOrganizationByIdentifier(db, orgParam)
  await ensureOrganizationAuthSettings(db, organization.id)

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
    authUpdates.idpConfig = stringifyIdpConfig(payload.idpConfig) ?? null
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

