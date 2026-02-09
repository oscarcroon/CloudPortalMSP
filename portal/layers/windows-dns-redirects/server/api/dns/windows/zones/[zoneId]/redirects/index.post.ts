/**
 * POST /api/dns/windows/zones/:zoneId/redirects
 * Create a new redirect for a zone
 */
import { createError, defineEventHandler, getRouterParam, readBody } from 'h3'
import { createId } from '@paralleldrive/cuid2'
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
import { logAuditEvent } from '~~/server/utils/audit'
import type { WindowsDnsRedirectCreateInput } from '@windows-dns-redirects/types'

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

  // Check module access and create permission
  const moduleRights = await getWindowsDnsModuleAccessForUser(orgId, auth.user.id)
  if (!moduleRights.canCreateRedirects) {
    throw createError({ statusCode: 403, message: 'No permission to create redirects.' })
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
  const body = await readBody<WindowsDnsRedirectCreateInput>(event)
  if (!body) {
    throw createError({ statusCode: 400, message: 'Request body is required.' })
  }
  const applyDnsChanges = body.applyDnsChanges === true

  // Validate required fields
  if (!body.sourcePath) {
    throw createError({ statusCode: 400, message: 'sourcePath is required.' })
  }

  if (!body.sourcePath.startsWith('/')) {
    throw createError({ statusCode: 400, message: 'sourcePath must start with /.' })
  }

  if (!body.destinationUrl) {
    throw createError({ statusCode: 400, message: 'destinationUrl is required.' })
  }

  // Validate URL format
  try {
    new URL(body.destinationUrl)
  } catch {
    throw createError({ statusCode: 400, message: 'destinationUrl must be a valid URL.' })
  }

  // Validate redirect type
  const validTypes = ['simple', 'wildcard', 'regex']
  const redirectType = body.redirectType || 'simple'
  if (!validTypes.includes(redirectType)) {
    throw createError({ statusCode: 400, message: 'Invalid redirect type.' })
  }

  // Validate and normalize host
  let host: string
  try {
    host = normalizeRedirectHost(body.host, zoneName)
  } catch (e: any) {
    throw createError({ statusCode: 400, message: e?.message ?? 'Invalid host.' })
  }

  // Validate status code
  const validStatusCodes = [301, 302, 307, 308]
  const statusCode = body.statusCode || 301
  if (!validStatusCodes.includes(statusCode)) {
    throw createError({ statusCode: 400, message: 'Invalid status code.' })
  }

  // If regex type, validate the regex
  if (redirectType === 'regex') {
    try {
      new RegExp(body.sourcePath)
    } catch {
      throw createError({ statusCode: 400, message: 'Invalid regex pattern in sourcePath.' })
    }
  }

  // Check for duplicate (host + sourcePath)
  const [existing] = await db
    .select({ id: windowsDnsRedirects.id })
    .from(windowsDnsRedirects)
    .where(
      and(
        eq(windowsDnsRedirects.organizationId, orgId),
        eq(windowsDnsRedirects.zoneId, zoneId),
        eq(windowsDnsRedirects.host, host),
        eq(windowsDnsRedirects.sourcePath, body.sourcePath)
      )
    )
    .limit(1)

  if (existing) {
    throw createError({
      statusCode: 409,
      message: `A redirect for host "${host}" with source path "${body.sourcePath}" already exists.`
    })
  }

  /**
   * DNS record integration (optional, env-driven)
   *
   * If DNS integration is enabled:
   * - Apex hosts (@) get A records pointing to configured IPv4 (+ AAAA for IPv6)
   * - Subdomain hosts get CNAME pointing to zone apex
   *
   * If there's a conflict, return 409 with plan unless applyDnsChanges=true.
   */
  if (isDnsIntegrationEnabled()) {
    const client = await getClientForOrg(orgId)
    const existingRecords = await client.listRecordsForZone(zoneId)

    const plan = buildDnsPlan(host, zoneName, existingRecords)

    if (plan.hasConflicts && !applyDnsChanges) {
      // Return conflict details for UI to show before/after
      throw createError({
        statusCode: 409,
        message: `DNS record conflict for "${plan.recordName}".`,
        data: {
          code: 'DNS_RECORD_CONFLICT',
          recordName: plan.recordName,
          before: plan.conflicts.map(c => c.existing).filter((e): e is NonNullable<typeof e> => !!e),
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

    // Apply DNS changes if needed
    // Auto-apply if no conflicts, require explicit confirmation if conflicts exist
    const needsChanges = plan.entries.some(e => e.action !== 'noop')
    const shouldApply = needsChanges && (applyDnsChanges || !plan.hasConflicts)
    if (shouldApply) {
      // Need DNS edit rights
      if (!moduleRights.canEditRecords) {
        throw createError({
          statusCode: 403,
          message: 'No permission to modify DNS records for redirects.'
        })
      }

      const managedComment = getManagedComment()

      // Delete conflicting records first
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
          await client.createRecordInZone(zoneId, {
            name: entry.record.name,
            type: entry.record.type,
            content: entry.record.content,
            ttl: entry.record.ttl,
            comment: managedComment
          })

          // Track in managed records table
          const recordKey = buildRecordKey(entry.record.type, entry.record.name)
          await trackManagedRecord({
            zoneId,
            recordKey,
            // Apex records are shared, subdomains are owned by the redirect
            managedBy: plan.isApex ? 'redirects_shared' : 'redirects',
            managedId: plan.isApex ? null : undefined, // Will be set after redirect is created
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

  // Create the redirect
  const redirectId = createId()
  await db
    .insert(windowsDnsRedirects)
    .values({
      id: redirectId,
      organizationId: orgId,
      zoneId,
      zoneName,
      host,
      sourcePath: body.sourcePath,
      destinationUrl: body.destinationUrl,
      redirectType,
      statusCode,
      isActive: body.isActive !== false,
      createdBy: auth.user.id
    })

  const [redirect] = await db
    .select()
    .from(windowsDnsRedirects)
    .where(eq(windowsDnsRedirects.id, redirectId))
    .limit(1)

  if (!redirect) {
    throw createError({ statusCode: 500, message: 'Failed to create redirect.' })
  }

  // Update managed record with redirect ID for CNAME (subdomain) records
  if (isDnsIntegrationEnabled()) {
    const plan = buildDnsPlan(host, zoneName, [])
    if (!plan.isApex) {
      // Update the managed record entry with the redirect ID
      for (const entry of plan.entries.filter(e => e.action !== 'noop')) {
        const recordKey = buildRecordKey(entry.record.type, entry.record.name)
        await trackManagedRecord({
          zoneId,
          recordKey,
          managedBy: 'redirects',
          managedId: redirect.id,
          userId: auth.user.id
        })
      }
    }
  }

  // Log audit event for redirect creation (do not log destinationUrl)
  await logAuditEvent(event, 'WINDOWS_DNS_REDIRECT_CREATED', {
    moduleKey: 'windows-dns-redirects',
    entityType: 'windows_dns_redirect',
    entityId: redirect.id,
    zoneId,
    zoneName,
    host,
    sourcePath: body.sourcePath,
    redirectType,
    statusCode
  })

  return {
    redirect: {
      ...redirect,
      createdAt: redirect.createdAt?.toISOString?.() || redirect.createdAt,
      updatedAt: redirect.updatedAt?.toISOString?.() || redirect.updatedAt,
      lastHitAt: redirect.lastHitAt?.toISOString?.() || redirect.lastHitAt
    }
  }
})
