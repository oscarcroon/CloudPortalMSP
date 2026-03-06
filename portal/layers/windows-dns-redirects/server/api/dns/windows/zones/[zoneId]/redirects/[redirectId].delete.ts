/**
 * DELETE /api/dns/windows/zones/:zoneId/redirects/:redirectId
 * Delete a redirect and its associated DNS record (if no other redirects use it)
 */
import { createError, defineEventHandler, getRouterParam } from 'h3'
import { eq, and, ne } from 'drizzle-orm'
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
  const redirectId = getRouterParam(event, 'redirectId')

  if (!zoneId) {
    throw createError({ statusCode: 400, message: 'zoneId is required.' })
  }

  if (!redirectId) {
    throw createError({ statusCode: 400, message: 'redirectId is required.' })
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

  /**
   * DNS record cleanup
   *
   * Delete the DNS record if:
   * 1. DNS integration is enabled
   * 2. No other redirects use the same host
   * 3. User has permission to edit DNS records
   */
  let dnsRecordDeleted = false
  if (isDnsIntegrationEnabled() && existing.host && zoneName) {
    const recordName = hostToZoneRecordName(existing.host, zoneName)
    const isApex = recordName === '@'

    // Check if other redirects use the same host
    const [otherRedirect] = await db
      .select({ id: windowsDnsRedirects.id })
      .from(windowsDnsRedirects)
      .where(
        and(
          eq(windowsDnsRedirects.zoneId, zoneId),
          eq(windowsDnsRedirects.host, existing.host),
          ne(windowsDnsRedirects.id, redirectId)
        )
      )
      .limit(1)

    const hasOtherRedirects = !!otherRedirect

    // Delete DNS record if no other redirects use this host
    if (!hasOtherRedirects && moduleRights.canEditRecords) {
      try {
        const client = await getClientForOrg(orgId)
        const desiredRecords = buildDesiredRecords(existing.host, zoneName)

        for (const record of desiredRecords) {
          try {
            await client.deleteRecord(zoneId, {
              name: record.name,
              type: record.type,
              content: record.content
            })
            dnsRecordDeleted = true
          } catch (e: any) {
            // Log but don't fail - the redirect should still be deleted
            console.warn('[windows-dns-redirects] Failed to delete DNS record:', record.name, record.type, e?.message || e)
          }
        }
      } catch (e: any) {
        console.warn('[windows-dns-redirects] Failed to get DNS client for cleanup:', e?.message || e)
      }
    }

    // Remove managed record tracking
    const desiredRecords = buildDesiredRecords(existing.host, zoneName)
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
        console.warn('[windows-dns-redirects] Failed to untrack managed record:', e?.message || e)
      }
    }
  }

  // Delete associated hits first (cascade should handle this but being explicit)
  await db
    .delete(windowsDnsRedirectHits)
    .where(eq(windowsDnsRedirectHits.redirectId, redirectId))

  // Delete the redirect
  await db
    .delete(windowsDnsRedirects)
    .where(eq(windowsDnsRedirects.id, redirectId))

  // Log audit event for redirect deletion (do not log destinationUrl)
  await logAuditEvent(event, 'WINDOWS_DNS_REDIRECT_DELETED', {
    moduleKey: 'windows-dns-redirects',
    entityType: 'windows_dns_redirect',
    entityId: redirectId,
    zoneId,
    zoneName,
    host: existing.host,
    sourcePath: existing.sourcePath
  })

  return {
    success: true,
    deletedId: redirectId,
    sourcePath: existing.sourcePath,
    dnsRecordDeleted
  }
})
