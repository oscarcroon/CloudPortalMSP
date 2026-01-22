/**
 * PUT /api/dns/windows/redirects/config
 * Update redirect configuration for the organization
 */
import { createError, defineEventHandler, readBody } from 'h3'
import { eq } from 'drizzle-orm'
import { ensureAuthState } from '~~/server/utils/session'
import { getDb } from '~~/server/utils/db'
import { windowsDnsRedirectOrgConfig } from '~~/server/database/schema'
import { getWindowsDnsModuleAccessForUser } from '@windows-dns/server/lib/windows-dns/access'

interface ConfigUpdateBody {
  traefikConfigPath?: string | null
}

export default defineEventHandler(async (event) => {
  const auth = await ensureAuthState(event)
  if (!auth?.currentOrgId) {
    throw createError({ statusCode: 400, message: 'Organization missing from session.' })
  }

  const orgId = auth.currentOrgId

  // Check module access and config edit permission
  const moduleRights = await getWindowsDnsModuleAccessForUser(orgId, auth.user.id)
  if (!moduleRights.canEditRedirectConfig) {
    throw createError({ statusCode: 403, message: 'No permission to edit redirect config.' })
  }

  const db = getDb()
  const body = await readBody<ConfigUpdateBody>(event)

  // Get or create config
  let [config] = await db
    .select()
    .from(windowsDnsRedirectOrgConfig)
    .where(eq(windowsDnsRedirectOrgConfig.organizationId, orgId))
    .limit(1)

  if (!config) {
    // Create config with provided values
    ;[config] = await db
      .insert(windowsDnsRedirectOrgConfig)
      .values({
        organizationId: orgId,
        traefikConfigPath: body.traefikConfigPath ?? null,
        lastConfigSync: null
      })
      .returning()
  } else {
    // Update existing config
    const updateData: Record<string, any> = {
      updatedAt: new Date()
    }

    if (body.traefikConfigPath !== undefined) {
      updateData.traefikConfigPath = body.traefikConfigPath
    }

    ;[config] = await db
      .update(windowsDnsRedirectOrgConfig)
      .set(updateData)
      .where(eq(windowsDnsRedirectOrgConfig.id, config.id))
      .returning()
  }

  return {
    config: {
      id: config.id,
      organizationId: config.organizationId,
      traefikConfigPath: config.traefikConfigPath,
      lastConfigSync: config.lastConfigSync?.toISOString?.() || config.lastConfigSync,
      createdAt: config.createdAt?.toISOString?.() || config.createdAt,
      updatedAt: config.updatedAt?.toISOString?.() || config.updatedAt
    }
  }
})
