/**
 * POST /api/dns/windows/zones/:zoneId/redirects/bulk-delete
 * Delete multiple redirects at once, including DNS record cleanup
 */
import { createError, defineEventHandler, getRouterParam, readBody } from 'h3'
import { eq, and, inArray, notInArray } from 'drizzle-orm'
import { ensureAuthState } from '~~/server/utils/session'
import { getDb } from '~~/server/utils/db'
import { windowsDnsRedirects, windowsDnsAllowedZones, windowsDnsRedirectHits } from '~~/server/database/schema'
import { getWindowsDnsModuleAccessForUser } from '@windows-dns/server/lib/windows-dns/access'
import { getClientForOrg } from '@windows-dns/server/lib/windows-dns/client'
import {
  buildDesiredRecords,
  buildRecordKey,
  isDnsIntegrationEnabled,
  untrackManagedRecord
} from '@windows-dns-redirects/server/utils/dnsPlanRedirectRecords'
import { hostToZoneRecordName } from '@windows-dns-redirects/server/utils/normalizeHost'
import { logAuditEvent } from '~~/server/utils/audit'

export default defineEventHandler(async (event) => {
  const auth = await ensureAuthState(event)
  if (!auth?.currentOrgId) {
    throw createError({ statusCode: 400, message: 'Organization missing from session.' })
  }

  const orgId = auth.currentOrgId
  const zoneId = getRouterParam(event, 'zoneId')

  if (!zoneId) {
    throw createError({ statusCode: 400, message: 'zoneId is required.' })
  }

  // Check module access and delete permission
  const moduleRights = await getWindowsDnsModuleAccessForUser(orgId, auth.user.id)
  if (!moduleRights.canDeleteRedirects) {
    throw createError({ statusCode: 403, message: 'No permission to delete redirects.' })
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
  const body = await readBody<{ ids: string[] }>(event)

  if (!body.ids || !Array.isArray(body.ids) || body.ids.length === 0) {
    throw createError({ statusCode: 400, message: 'ids array is required.' })
  }

  // Limit bulk delete to 100 items at a time
  if (body.ids.length > 100) {
    throw createError({ statusCode: 400, message: 'Maximum 100 redirects can be deleted at once.' })
  }

  // Get all redirects to be deleted (with host info for DNS cleanup)
  const toDelete = await db
    .select({
      id: windowsDnsRedirects.id,
      host: windowsDnsRedirects.host
    })
    .from(windowsDnsRedirects)
    .where(
      and(
        inArray(windowsDnsRedirects.id, body.ids),
        eq(windowsDnsRedirects.organizationId, orgId),
        eq(windowsDnsRedirects.zoneId, zoneId)
      )
    )

  const existingIds = toDelete.map(r => r.id)
  const notFoundIds = body.ids.filter(id => !existingIds.includes(id))

  if (notFoundIds.length > 0) {
    throw createError({
      statusCode: 404,
      message: `Some redirects not found: ${notFoundIds.join(', ')}`
    })
  }

  /**
   * DNS record cleanup
   *
   * For each unique host being deleted, check if other redirects still use it.
   * If not, delete the DNS record (unless it's apex).
   */
  let dnsRecordsDeleted = 0
  if (isDnsIntegrationEnabled() && zoneName && moduleRights.canEditRecords) {
    // Get unique hosts from redirects being deleted
    const hostsToDelete = [...new Set(toDelete.map(r => r.host).filter(Boolean))]

    // For each host, check if other redirects (not being deleted) use it
    for (const host of hostsToDelete) {
      if (!host) continue

      const recordName = hostToZoneRecordName(host, zoneName)
      const isApex = recordName === '@'

      // Check if any other redirect (not in delete list) uses this host
      const [otherRedirect] = await db
        .select({ id: windowsDnsRedirects.id })
        .from(windowsDnsRedirects)
        .where(
          and(
            eq(windowsDnsRedirects.zoneId, zoneId),
            eq(windowsDnsRedirects.host, host),
            notInArray(windowsDnsRedirects.id, body.ids)
          )
        )
        .limit(1)

      if (!otherRedirect) {
        // No other redirects use this host - delete DNS record
        try {
          const client = await getClientForOrg(orgId)
          const desiredRecords = buildDesiredRecords(host, zoneName)

          for (const record of desiredRecords) {
            try {
              await client.deleteRecord(zoneId, {
                name: record.name,
                type: record.type,
                content: record.content
              })
              dnsRecordsDeleted++
            } catch (e: any) {
              console.warn('[windows-dns-redirects] Bulk delete: Failed to delete DNS record:', record.name, e?.message || e)
            }
          }
        } catch (e: any) {
          console.warn('[windows-dns-redirects] Bulk delete: Failed to get DNS client:', e?.message || e)
        }
      }

      // Untrack managed records for all redirects being deleted
      const redirectIdsForHost = toDelete.filter(r => r.host === host).map(r => r.id)
      for (const redirectId of redirectIdsForHost) {
        const desiredRecords = buildDesiredRecords(host, zoneName)
        for (const record of desiredRecords) {
          const recordKey = buildRecordKey(record.type, record.name)
          try {
            await untrackManagedRecord({
              zoneId,
              recordKey,
              managedBy: isApex ? 'redirects_shared' : 'redirects',
              managedId: isApex ? undefined : redirectId
            })
          } catch (e: any) {
            console.warn('[windows-dns-redirects] Bulk delete: Failed to untrack record:', e?.message || e)
          }
        }
      }
    }
  }

  // Delete associated hits first
  await db
    .delete(windowsDnsRedirectHits)
    .where(inArray(windowsDnsRedirectHits.redirectId, body.ids))

  // Delete the redirects
  await db
    .delete(windowsDnsRedirects)
    .where(inArray(windowsDnsRedirects.id, body.ids))

  // Log audit event for bulk delete (do not log redirect contents)
  await logAuditEvent(event, 'WINDOWS_DNS_REDIRECTS_BULK_DELETED', {
    moduleKey: 'windows-dns-redirects',
    entityType: 'windows_dns_redirect',
    zoneId,
    zoneName,
    deletedCount: body.ids.length,
    deletedIds: body.ids
  })

  return {
    success: true,
    deletedCount: body.ids.length,
    deletedIds: body.ids,
    dnsRecordsDeleted
  }
})
