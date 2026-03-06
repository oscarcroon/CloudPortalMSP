/**
 * Certificates Layer Access Control
 *
 * Maps module permissions to capability booleans.
 */

import { resolveEffectiveModulePermissions } from '../../../../../server/utils/modulePermissions'
import type { CertificatesModuleRights } from './types'

const PERMISSION_TO_CAPABILITY: Record<string, keyof CertificatesModuleRights> = {
  'certificates:view': 'canView',
  'certificates:order': 'canOrder',
  'certificates:manage_agents': 'canManageAgents',
  'certificates:manage_credentials': 'canManageCredentials',
  'certificates:admin': 'canAdmin'
}

const buildRightsFromPermissions = (perms: Set<string>): CertificatesModuleRights => ({
  canView: perms.has('certificates:view'),
  canOrder: perms.has('certificates:order'),
  canManageAgents: perms.has('certificates:manage_agents'),
  canManageCredentials: perms.has('certificates:manage_credentials'),
  canAdmin: perms.has('certificates:admin')
})

export const getCertificatesModuleAccessForUser = async (
  orgId: string,
  userId: string
): Promise<CertificatesModuleRights> => {
  const perms = await resolveEffectiveModulePermissions({
    orgId,
    moduleKey: 'certificates',
    userId
  })
  return buildRightsFromPermissions(perms.effectivePermissions)
}

export { PERMISSION_TO_CAPABILITY }
