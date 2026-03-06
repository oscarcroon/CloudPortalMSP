import { eq } from 'drizzle-orm'
import { ensureAuthState } from '~~/server/utils/session'
import { getDb } from '~~/server/utils/db'
import { getCertificatesModuleAccessForUser } from '../../../lib/certificates/access'
import { maskSecret } from '../../../lib/certificates/crypto'
import { certCredentialSets } from '~~/server/database/schema'

export default defineEventHandler(async (event) => {
  const auth = await ensureAuthState(event)
  if (!auth?.currentOrgId) {
    throw createError({ statusCode: 400, message: 'Organisation saknas i sessionen.' })
  }
  const orgId = auth.currentOrgId

  if (!auth.user.isSuperAdmin) {
    const access = await getCertificatesModuleAccessForUser(orgId, auth.user.id)
    if (!access.canView) {
      throw createError({ statusCode: 403, message: 'Missing permission to view credential sets.' })
    }
  }

  const db = getDb()
  const rows = await db
    .select()
    .from(certCredentialSets)
    .where(eq(certCredentialSets.organizationId, orgId))
    .orderBy(certCredentialSets.createdAt)

  return {
    credentialSets: rows.map(row => ({
      id: row.id,
      name: row.name,
      provider: row.provider,
      acmeDirectoryUrl: row.acmeDirectoryUrl,
      defaultValidationMethod: row.defaultValidationMethod,
      eabKid: row.eabKid,
      eabHmacMasked: maskSecret(row.eabKid), // We mask the KID as hint
      isDefault: row.isDefault,
      isActive: row.isActive,
      effectiveFrom: row.effectiveFrom,
      effectiveTo: row.effectiveTo,
      rotatedFromId: row.rotatedFromId,
      createdAt: row.createdAt,
      updatedAt: row.updatedAt
    }))
  }
})
