/**
 * POST /api/dns/windows/zones/:zoneId/redirects
 * Create a new redirect for a zone
 */
import { createError, defineEventHandler, getRouterParam, readBody } from 'h3'
import { eq, and } from 'drizzle-orm'
import { ensureAuthState } from '~~/server/utils/session'
import { getDb } from '~~/server/utils/db'
import { windowsDnsRedirects, windowsDnsAllowedZones } from '~~/server/database/schema'
import { getWindowsDnsModuleAccessForUser } from '@windows-dns/server/lib/windows-dns/access'
import { getClientForOrg } from '@windows-dns/server/lib/windows-dns/client'
import { hostToZoneRecordName, normalizeRedirectHost } from '@windows-dns-redirects/server/utils/normalizeHost'
import type { WindowsDnsRedirectCreateInput } from '../../../../types'

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

  const body = await readBody<WindowsDnsRedirectCreateInput>(event)
  const applyDnsChanges = body?.applyDnsChanges === true

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
    host = normalizeRedirectHost((body as any)?.host, allowedZone.zoneName)
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

  // Check for duplicate source path
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
   * The redirects system requires the zone apex (default "@") to point at the redirects ingress.
   * If configured and there is a conflict, we return a 409 with a before/after plan unless
   * the client explicitly acknowledges via `applyDnsChanges: true`.
   */
  const dnsRecordContent = process.env.WINDOWS_DNS_REDIRECTS_DNS_RECORD_CONTENT?.trim()
  const dnsRecordType = (process.env.WINDOWS_DNS_REDIRECTS_DNS_RECORD_TYPE || 'CNAME').trim().toUpperCase()
  const dnsRecordName = (() => {
    try {
      return hostToZoneRecordName(host, allowedZone.zoneName)
    } catch {
      return '@'
    }
  })()
  const dnsRecordTtlRaw = process.env.WINDOWS_DNS_REDIRECTS_DNS_RECORD_TTL?.trim()
  const dnsRecordTtl = dnsRecordTtlRaw ? Number(dnsRecordTtlRaw) : 3600

  if (dnsRecordContent) {
    const client = await getClientForOrg(orgId)
    const zoneRecords = await client.listRecordsForZone(zoneId)

    const conflictTypes = new Set(['A', 'AAAA', 'CNAME'])
    const relevant = zoneRecords.filter((r: any) => String(r?.name ?? '').trim() === dnsRecordName && conflictTypes.has(String(r?.type ?? '').toUpperCase()))

    const desired = {
      name: dnsRecordName,
      type: dnsRecordType,
      content: dnsRecordContent,
      ttl: Number.isFinite(dnsRecordTtl) && dnsRecordTtl > 0 ? dnsRecordTtl : 3600
    }

    const alreadyCorrect = relevant.some((r: any) =>
      String(r?.type ?? '').toUpperCase() === desired.type &&
      String(r?.content ?? '').trim() === desired.content
    )

    const hasConflict = relevant.length > 0 && !alreadyCorrect

    if (hasConflict && !applyDnsChanges) {
      throw createError({
        statusCode: 409,
        message: `DNS record conflict for "${dnsRecordName}".`,
        data: {
          code: 'DNS_RECORD_CONFLICT',
          recordName: dnsRecordName,
          before: relevant.map((r: any) => ({
            id: r.id,
            name: r.name,
            type: r.type,
            content: r.content,
            ttl: r.ttl
          })),
          after: [desired],
        }
      })
    }

    if (hasConflict && applyDnsChanges) {
      // Need DNS edit rights if we are going to change DNS
      if (!moduleRights.canEditRecords) {
        throw createError({ statusCode: 403, message: 'No permission to modify DNS records for redirects.' })
      }

      // Remove conflicting records for this name (A/AAAA/CNAME) then create the desired record.
      for (const r of relevant) {
        try {
          await client.deleteRecord(zoneId, {
            name: r.name,
            type: r.type,
            content: r.content
          })
        } catch (e: any) {
          console.error('[windows-dns-redirects] Failed to delete conflicting DNS record:', e?.message || e)
          throw createError({ statusCode: 502, message: 'Failed to remove conflicting DNS record(s).' })
        }
      }

      try {
        await client.createRecord(zoneId, desired as any)
      } catch (e: any) {
        console.error('[windows-dns-redirects] Failed to create DNS record for redirects:', e?.message || e)
        throw createError({ statusCode: 502, message: 'Failed to create DNS record required for redirects.' })
      }
    }
  }

  // Create the redirect
  const [redirect] = await db
    .insert(windowsDnsRedirects)
    .values({
      organizationId: orgId,
      zoneId,
      zoneName: allowedZone.zoneName,
      host,
      sourcePath: body.sourcePath,
      destinationUrl: body.destinationUrl,
      redirectType,
      statusCode,
      isActive: body.isActive !== false,
      createdBy: auth.user.id
    })
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
