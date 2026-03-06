import { eq, and } from 'drizzle-orm'
import { readBody } from 'h3'
import { ensureAuthState } from '~~/server/utils/session'
import { getDb } from '~~/server/utils/db'
import { getCertificatesModuleAccessForUser } from '../../../lib/certificates/access'
import { encryptSecret } from '../../../lib/certificates/crypto'
import { createCredentialSetSchema } from '../../../validation/schemas'
import { certCredentialSets } from '~~/server/database/schema'
import { logAuditEvent } from '~~/server/utils/audit'

export default defineEventHandler(async (event) => {
  const auth = await ensureAuthState(event)
  if (!auth?.currentOrgId) {
    throw createError({ statusCode: 400, message: 'Organisation saknas i sessionen.' })
  }
  const orgId = auth.currentOrgId

  if (!auth.user.isSuperAdmin) {
    const access = await getCertificatesModuleAccessForUser(orgId, auth.user.id)
    if (!access.canManageCredentials && !access.canAdmin) {
      throw createError({ statusCode: 403, message: 'Missing permission to manage credential sets.' })
    }
  }

  const body = await readBody(event)
  const parsed = createCredentialSetSchema.parse(body)

  const db = getDb()

  // If this is set as default, unset others
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

  // Encrypt EAB HMAC if provided
  let encryptedEabHmac: string | null = null
  let encryptionIv: string | null = null
  let encryptionAuthTag: string | null = null

  if (parsed.eabHmac) {
    const encrypted = encryptSecret(parsed.eabHmac)
    encryptedEabHmac = encrypted.cipherText
    encryptionIv = encrypted.iv
    encryptionAuthTag = encrypted.authTag
  }

  const [inserted] = await db
    .insert(certCredentialSets)
    .values({
      organizationId: orgId,
      name: parsed.name,
      provider: parsed.provider,
      acmeDirectoryUrl: parsed.acmeDirectoryUrl,
      defaultValidationMethod: parsed.defaultValidationMethod ?? null,
      eabKid: parsed.eabKid ?? null,
      encryptedEabHmac,
      encryptionIv,
      encryptionAuthTag,
      isDefault: parsed.isDefault ?? false,
      isActive: parsed.isActive ?? true,
      effectiveFrom: parsed.effectiveFrom ? new Date(parsed.effectiveFrom) : null,
      effectiveTo: parsed.effectiveTo ? new Date(parsed.effectiveTo) : null,
      createdByUserId: auth.user.id
    })
    .$returningId()

  await logAuditEvent(event, 'CERT_CREDENTIAL_SET_CREATED' as any, {
    moduleKey: 'certificates',
    entityType: 'cert_credential_set',
    credentialSetId: inserted.id,
    name: parsed.name,
    provider: parsed.provider
  })

  return { ok: true, id: inserted.id }
})
