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
import { getClientForOrg } from '@windows-dns/server/lib/windows-dns/client'
import { normalizeRedirectHost } from '@windows-dns-redirects/server/utils/normalizeHost'
import {
  buildDnsPlan,
  buildRecordKey,
  getManagedComment,
  isDnsIntegrationEnabled,
  trackManagedRecord
} from '@windows-dns-redirects/server/utils/dnsPlanRedirectRecords'
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

  const zoneName = allowedZone.zoneName || ''

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
  const applyDnsChanges = body?.applyDnsChanges === true

  // Build update object
  const updateData: Record<string, any> = {
    updatedAt: new Date()
  }

  // Handle host update
  let newHost: string | undefined
  if (body.host !== undefined) {
    try {
      newHost = normalizeRedirectHost(body.host, zoneName)
    } catch (e: any) {
      throw createError({ statusCode: 400, message: e?.message ?? 'Invalid host.' })
    }

    // Check for duplicate (host + sourcePath) if host is changing
    const finalSourcePath = body.sourcePath !== undefined ? body.sourcePath : existing.sourcePath
    if (newHost !== existing.host || finalSourcePath !== existing.sourcePath) {
      const [duplicate] = await db
        .select({ id: windowsDnsRedirects.id })
        .from(windowsDnsRedirects)
        .where(
          and(
            eq(windowsDnsRedirects.organizationId, orgId),
            eq(windowsDnsRedirects.zoneId, zoneId),
            eq(windowsDnsRedirects.host, newHost),
            eq(windowsDnsRedirects.sourcePath, finalSourcePath)
          )
        )
        .limit(1)

      if (duplicate && duplicate.id !== redirectId) {
        throw createError({
          statusCode: 409,
          message: `A redirect for host "${newHost}" with source path "${finalSourcePath}" already exists.`
        })
      }
    }

    updateData.host = newHost
  }

  if (body.sourcePath !== undefined) {
    if (!body.sourcePath.startsWith('/')) {
      throw createError({ statusCode: 400, message: 'sourcePath must start with /.' })
    }

    // Check for duplicate (if only changing source path, not host)
    const finalHost = newHost ?? existing.host
    if (body.sourcePath !== existing.sourcePath) {
      const [duplicate] = await db
        .select({ id: windowsDnsRedirects.id })
        .from(windowsDnsRedirects)
        .where(
          and(
            eq(windowsDnsRedirects.organizationId, orgId),
            eq(windowsDnsRedirects.zoneId, zoneId),
            eq(windowsDnsRedirects.host, finalHost),
            eq(windowsDnsRedirects.sourcePath, body.sourcePath)
          )
        )
        .limit(1)

      if (duplicate && duplicate.id !== redirectId) {
        throw createError({
          statusCode: 409,
          message: `A redirect for host "${finalHost}" with source path "${body.sourcePath}" already exists.`
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

  // Handle DNS changes if host is being updated
  if (newHost && newHost !== existing.host && isDnsIntegrationEnabled()) {
    const client = await getClientForOrg(orgId)
    const existingRecords = await client.listRecordsForZone(zoneId)

    const plan = buildDnsPlan(newHost, zoneName, existingRecords)

    if (plan.hasConflicts && !applyDnsChanges) {
      throw createError({
        statusCode: 409,
        message: `DNS record conflict for "${plan.recordName}".`,
        data: {
          code: 'DNS_RECORD_CONFLICT',
          recordName: plan.recordName,
          before: plan.conflicts.map(c => c.existing).filter(Boolean),
          after: plan.entries
            .filter(e => e.action === 'create')
            .map(e => ({
              name: e.record.name,
              type: e.record.type,
              content: e.record.content,
              ttl: e.record.ttl
            }))
        }
      })
    }

    // Auto-apply if no conflicts, require explicit confirmation if conflicts exist
    const needsChanges = plan.entries.some(e => e.action !== 'noop')
    const shouldApply = needsChanges && (applyDnsChanges || !plan.hasConflicts)
    if (shouldApply) {
      if (!moduleRights.canEditRecords) {
        throw createError({
          statusCode: 403,
          message: 'No permission to modify DNS records for redirects.'
        })
      }

      const managedComment = getManagedComment()

      // Delete conflicting records
      for (const entry of plan.entries.filter(e => e.action === 'delete')) {
        try {
          await client.deleteRecord(zoneId, {
            name: entry.existing?.name || entry.record.name,
            type: entry.existing?.type || entry.record.type,
            content: entry.existing?.content || entry.record.content
          })
        } catch (e: any) {
          console.error('[windows-dns-redirects] Failed to delete conflicting DNS record:', e?.message || e)
          throw createError({
            statusCode: 502,
            message: 'Failed to remove conflicting DNS record(s).'
          })
        }
      }

      // Create new records
      for (const entry of plan.entries.filter(e => e.action === 'create')) {
        try {
          await client.createRecord(zoneId, {
            name: entry.record.name,
            type: entry.record.type,
            content: entry.record.content,
            ttl: entry.record.ttl,
            comment: managedComment
          })

          const recordKey = buildRecordKey(entry.record.type, entry.record.name)
          await trackManagedRecord({
            zoneId,
            recordKey,
            managedBy: plan.isApex ? 'redirects_shared' : 'redirects',
            managedId: plan.isApex ? null : redirectId,
            userId: auth.user.id
          })
        } catch (e: any) {
          console.error('[windows-dns-redirects] Failed to create DNS record:', e?.message || e)
          throw createError({
            statusCode: 502,
            message: 'Failed to create DNS record required for redirects.'
          })
        }
      }
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
