/**
 * PATCH /api/dns/windows/zones/:zoneId/redirects/:redirectId
 * Update an existing redirect
 */
import { createError, defineEventHandler, getRouterParam, readBody } from 'h3'
import { eq, and } from 'drizzle-orm'
import { ensureAuthState } from '~~/server/utils/session'
import { getDb } from '~~/server/utils/db'
import { windowsDnsRedirects, windowsDnsAllowedZones } from '~~/server/database/schema'
import { getWindowsDnsModuleAccessForUser } from '@windows-dns/server/lib/windows-dns/access'
import type { WindowsDnsRedirectUpdateInput } from '../../../../types'

export default defineEventHandler(async (event) => {
  const auth = await ensureAuthState(event)
  if (!auth?.currentOrgId) {
    throw createError({ statusCode: 400, message: 'Organization missing from session.' })
  }

  const orgId = auth.currentOrgId
  const zoneId = getRouterParam(event, 'zoneId')
  const redirectId = getRouterParam(event, 'redirectId')

  if (!zoneId) {
    throw createError({ statusCode: 400, message: 'zoneId is required.' })
  }

  if (!redirectId) {
    throw createError({ statusCode: 400, message: 'redirectId is required.' })
  }

  // Check module access and edit permission
  const moduleRights = await getWindowsDnsModuleAccessForUser(orgId, auth.user.id)
  if (!moduleRights.canEditRedirects) {
    throw createError({ statusCode: 403, message: 'No permission to edit redirects.' })
  }

  const db = getDb()

  // Verify zone is allowed for this organization
  const [allowedZone] = await db
    .select()
    .from(windowsDnsAllowedZones)
    .where(
      and(
        eq(windowsDnsAllowedZones.organizationId, orgId),
        eq(windowsDnsAllowedZones.zoneId, zoneId)
      )
    )
    .limit(1)

  if (!allowedZone) {
    throw createError({ statusCode: 404, message: 'Zone not found or not accessible.' })
  }

  // Get existing redirect
  const [existing] = await db
    .select()
    .from(windowsDnsRedirects)
    .where(
      and(
        eq(windowsDnsRedirects.id, redirectId),
        eq(windowsDnsRedirects.organizationId, orgId),
        eq(windowsDnsRedirects.zoneId, zoneId)
      )
    )
    .limit(1)

  if (!existing) {
    throw createError({ statusCode: 404, message: 'Redirect not found.' })
  }

  const body = await readBody<WindowsDnsRedirectUpdateInput>(event)

  // Build update object
  const updateData: Record<string, any> = {
    updatedAt: new Date()
  }

  if (body.sourcePath !== undefined) {
    if (!body.sourcePath.startsWith('/')) {
      throw createError({ statusCode: 400, message: 'sourcePath must start with /.' })
    }

    // Check for duplicate (if changing source path)
    if (body.sourcePath !== existing.sourcePath) {
      const [duplicate] = await db
        .select({ id: windowsDnsRedirects.id })
        .from(windowsDnsRedirects)
        .where(
          and(
            eq(windowsDnsRedirects.organizationId, orgId),
            eq(windowsDnsRedirects.zoneId, zoneId),
            eq(windowsDnsRedirects.sourcePath, body.sourcePath)
          )
        )
        .limit(1)

      if (duplicate) {
        throw createError({
          statusCode: 409,
          message: `A redirect with source path "${body.sourcePath}" already exists.`
        })
      }
    }

    updateData.sourcePath = body.sourcePath
  }

  if (body.destinationUrl !== undefined) {
    try {
      new URL(body.destinationUrl)
    } catch {
      throw createError({ statusCode: 400, message: 'destinationUrl must be a valid URL.' })
    }
    updateData.destinationUrl = body.destinationUrl
  }

  if (body.redirectType !== undefined) {
    const validTypes = ['simple', 'wildcard', 'regex']
    if (!validTypes.includes(body.redirectType)) {
      throw createError({ statusCode: 400, message: 'Invalid redirect type.' })
    }
    updateData.redirectType = body.redirectType
  }

  if (body.statusCode !== undefined) {
    const validStatusCodes = [301, 302, 307, 308]
    if (!validStatusCodes.includes(body.statusCode)) {
      throw createError({ statusCode: 400, message: 'Invalid status code.' })
    }
    updateData.statusCode = body.statusCode
  }

  if (body.isActive !== undefined) {
    updateData.isActive = body.isActive
  }

  // If regex type, validate the regex
  const finalType = updateData.redirectType || existing.redirectType
  const finalPath = updateData.sourcePath || existing.sourcePath
  if (finalType === 'regex') {
    try {
      new RegExp(finalPath)
    } catch {
      throw createError({ statusCode: 400, message: 'Invalid regex pattern in sourcePath.' })
    }
  }

  // Update the redirect
  const [redirect] = await db
    .update(windowsDnsRedirects)
    .set(updateData)
    .where(eq(windowsDnsRedirects.id, redirectId))
    .returning()

  return {
    redirect: {
      ...redirect,
      createdAt: redirect.createdAt?.toISOString?.() || redirect.createdAt,
      updatedAt: redirect.updatedAt?.toISOString?.() || redirect.updatedAt,
      lastHitAt: redirect.lastHitAt?.toISOString?.() || redirect.lastHitAt
    }
  }
})
