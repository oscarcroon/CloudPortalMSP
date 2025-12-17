import { createError, defineEventHandler, readBody } from 'h3'
import { ensureAuthState } from '~~/server/utils/session'
import { getWindowsDnsModuleAccessForUser } from '@windows-dns/server/lib/windows-dns/access'
import { saveOrgConfig, getOrgConfig } from '@windows-dns/server/lib/windows-dns/org-config'
import { adminRequest } from '@windows-dns/server/lib/windows-dns/client'

export default defineEventHandler(async (event) => {
  const auth = await ensureAuthState(event)
  if (!auth?.currentOrgId) {
    throw createError({ statusCode: 400, message: 'Organization missing from session.' })
  }

  const orgId = auth.currentOrgId
  const moduleRights = await getWindowsDnsModuleAccessForUser(orgId, auth.user.id)

  if (!moduleRights.canManageOrgConfig) {
    throw createError({ statusCode: 403, message: 'No permission to configure Windows DNS.' })
  }

  const body = await readBody(event)
  if (!body?.baseUrl) {
    throw createError({
      statusCode: 400,
      message: 'baseUrl is required.'
    })
  }

  // Validate connection by calling health endpoint
  try {
    const testConfig = { baseUrl: body.baseUrl, instanceId: body.instanceId ?? null }
    await adminRequest(testConfig, '/../health') // Health is at /health, not /admin/health
  } catch (error: any) {
    throw createError({
      statusCode: 400,
      message: `Failed to connect to Windows DNS API: ${error?.message ?? 'Unknown error'}`
    })
  }

  // Save config
  const config = await saveOrgConfig(orgId, {
    baseUrl: body.baseUrl,
    instanceId: body.instanceId ?? null,
    coreId: body.coreId ?? null,
    lastValidatedAt: new Date()
  })

  return {
    config,
    configured: true
  }
})

