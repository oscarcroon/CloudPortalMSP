import { eq } from 'drizzle-orm'
import { defineEventHandler, readBody } from 'h3'
import {
  organizationAuthSettings,
  organizations
} from '../../../../database/schema'
import { getDb } from '../../../../utils/db'
import {
  buildOrganizationDetailPayload,
  ensureOrganizationAuthSettings,
  parseOrgParam,
  requireOrganizationByIdentifier,
  requireOrganizationManageAccess,
  stringifyIdpConfig
} from '../utils'
import type { OrganizationIdpType } from '~/types/admin'
import { organizationAuthUpdateSchema } from '../../../organizations/auth.schema'
import {
  assertRequireSsoAllowed,
  prepareIdpConfigForStorage
} from '~~/server/utils/idp'
import { logOrganizationAction } from '../../../../utils/audit'

export default defineEventHandler(async (event) => {
  const orgParam = parseOrgParam(event)
  const payload = organizationAuthUpdateSchema.parse(await readBody(event))
  const db = getDb()
  const organization = await requireOrganizationByIdentifier(db, orgParam)
  
  // Validate access - allows superadmins and tenant admins
  await requireOrganizationManageAccess(event, organization)
  const authSettings = await ensureOrganizationAuthSettings(db, organization.id)

  // Store old values for audit log
  const oldIdpType = authSettings.idpType as OrganizationIdpType
  const oldRequireSso = Boolean(organization.requireSso)
  const oldAllowLocalLogin = Boolean(authSettings.allowLocalLoginForOwners)

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

  // Log audit event
  const changedFields: Record<string, { old: any; new: any }> = {}
  if (payload.idpType !== undefined && payload.idpType !== oldIdpType) {
    changedFields.idpType = { old: oldIdpType, new: payload.idpType }
  }
  if (payload.requireSso !== undefined && payload.requireSso !== oldRequireSso) {
    changedFields.requireSso = { old: oldRequireSso, new: payload.requireSso }
  }
  if (payload.allowLocalLoginForOwners !== undefined && payload.allowLocalLoginForOwners !== oldAllowLocalLogin) {
    changedFields.allowLocalLoginForOwners = { old: oldAllowLocalLogin, new: payload.allowLocalLoginForOwners }
  }
  if (payload.idpConfig !== undefined) {
    changedFields.idpConfig = { old: '***', new: '***' } // Don't log actual config
  }

  if (Object.keys(changedFields).length > 0) {
    await logOrganizationAction(event, 'ORG_AUTH_SETTINGS_UPDATED', {
      changedFields
    }, organization.id)
  }

  return buildOrganizationDetailPayload(db, organization.id)
})

