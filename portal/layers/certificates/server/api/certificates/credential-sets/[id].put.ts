import { eq, and } from 'drizzle-orm'
import { readBody, getRouterParam } from 'h3'
import { ensureAuthState } from '~~/server/utils/session'
import { getDb } from '~~/server/utils/db'
import { getCertificatesModuleAccessForUser } from '../../../lib/certificates/access'
import { encryptSecret } from '../../../lib/certificates/crypto'
import { updateCredentialSetSchema } from '../../../validation/schemas'
import { certCredentialSets } from '~~/server/database/schema'
import { logAuditEvent } from '~~/server/utils/audit'

export default defineEventHandler(async (event) => {
  const auth = await ensureAuthState(event)
  if (!auth?.currentOrgId) {
    throw createError({ statusCode: 400, message: 'Organisation saknas i sessionen.' })
  }
  const orgId = auth.currentOrgId
  const id = getRouterParam(event, 'id')
  if (!id) throw createError({ statusCode: 400, message: 'Missing credential set ID.' })

  if (!auth.user.isSuperAdmin) {
    const access = await getCertificatesModuleAccessForUser(orgId, auth.user.id)
    if (!access.canManageCredentials && !access.canAdmin) {
      throw createError({ statusCode: 403, message: 'Missing permission to manage credential sets.' })
    }
  }

  const db = getDb()
  const [existing] = await db
    .select()
    .from(certCredentialSets)
    .where(and(eq(certCredentialSets.id, id), eq(certCredentialSets.organizationId, orgId)))

  if (!existing) {
    throw createError({ statusCode: 404, message: 'Credential set not found.' })
  }

  const body = await readBody(event)
  const parsed = updateCredentialSetSchema.parse(body)

  const updates: Record<string, any> = {}

  if (parsed.name !== undefined) updates.name = parsed.name
  if (parsed.provider !== undefined) updates.provider = parsed.provider
  if (parsed.acmeDirectoryUrl !== undefined) updates.acmeDirectoryUrl = parsed.acmeDirectoryUrl
  if (parsed.defaultValidationMethod !== undefined) updates.defaultValidationMethod = parsed.defaultValidationMethod
  if (parsed.eabKid !== undefined) updates.eabKid = parsed.eabKid
  if (parsed.isActive !== undefined) updates.isActive = parsed.isActive
  if (parsed.effectiveFrom !== undefined) updates.effectiveFrom = parsed.effectiveFrom ? new Date(parsed.effectiveFrom) : null
  if (parsed.effectiveTo !== undefined) updates.effectiveTo = parsed.effectiveTo ? new Date(parsed.effectiveTo) : null

  // Re-encrypt EAB HMAC if provided
  if (parsed.eabHmac !== undefined) {
    if (parsed.eabHmac) {
      const encrypted = encryptSecret(parsed.eabHmac)
      updates.encryptedEabHmac = encrypted.cipherText
      updates.encryptionIv = encrypted.iv
      updates.encryptionAuthTag = encrypted.authTag
    } else {
      updates.encryptedEabHmac = null
      updates.encryptionIv = null
      updates.encryptionAuthTag = null
    }
  }

  // Handle default flag
  if (parsed.isDefault !== undefined) {
    if (parsed.isDefault) {
      await db
        .update(certCredentialSets)
        .set({ isDefault: false })
        .where(
          and(
            eq(certCredentialSets.organizationId, orgId),
            eq(certCredentialSets.isDefault, true)
          )
        )
    }
    updates.isDefault = parsed.isDefault
  }

  if (Object.keys(updates).length > 0) {
    await db
      .update(certCredentialSets)
      .set(updates)
      .where(eq(certCredentialSets.id, id))
  }

  await logAuditEvent(event, 'CERT_CREDENTIAL_SET_UPDATED' as any, {
    moduleKey: 'certificates',
    entityType: 'cert_credential_set',
    credentialSetId: id,
    updates: Object.keys(updates)
  })

  return { ok: true }
})
