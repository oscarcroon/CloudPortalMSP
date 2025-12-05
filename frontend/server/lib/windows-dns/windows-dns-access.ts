import { getModuleAccessForUser, type ModuleAccess } from '~~/server/lib/modules/module-access'

export type WindowsDnsModuleRole = 'viewer' | 'editor' | 'admin'

export type WindowsDnsModuleAccess = ModuleAccess<'windows-dns'>

export async function getWindowsDnsModuleAccessForUser(
  orgId: string,
  userId: string
): Promise<WindowsDnsModuleAccess> {
  return getModuleAccessForUser(orgId, userId, 'windows-dns')
}


