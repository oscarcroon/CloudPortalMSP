import { ofetch } from 'ofetch'
import { createError } from 'h3'
import type { CloudflareApiErrorPayload, CloudflareDnsRecord, CloudflareZoneSummary } from './types'
import { getOrgConfig } from './org-config'

const CF_API_BASE = 'https://api.cloudflare.com/client/v4'

type CloudflareResponse<T> = {
  success: boolean
  errors?: CloudflareApiErrorPayload[]
  messages?: unknown[]
  result: T
  result_info?: unknown
}

export class CloudflareClient {
  constructor(private apiToken: string, private accountId?: string | null) {}

  private async request<T>(path: string, options?: { method?: string; body?: Record<string, unknown>; query?: Record<string, any> }) {
    try {
      const res = await ofetch<CloudflareResponse<T>>(CF_API_BASE + path, {
        method: options?.method ?? 'GET',
        query: options?.query,
        body: options?.body,
        headers: {
          Authorization: `Bearer ${this.apiToken}`,
          'Content-Type': 'application/json'
        }
      })

      if (!res?.success) {
        const message = res?.errors?.[0]?.message ?? 'Cloudflare API error'
        throw createError({ statusCode: 502, message: `[cloudflare] ${message}` })
      }

      return { result: res.result, resultInfo: res.result_info }
    } catch (error: any) {
      // Normalize fetch/Cloudflare errors to a readable message + status
      const statusCode = error?.response?.status ?? error?.statusCode ?? 502
      const message =
        error?.data?.errors?.[0]?.message ||
        error?.data?.message ||
        error?.message ||
        'Cloudflare API error'

      throw createError({ statusCode, message: `[cloudflare] ${message}` })
    }
  }

  async verifyToken() {
    const path = this.accountId
      ? `/accounts/${this.accountId}/tokens/verify`
      : '/user/tokens/verify'
    return this.request(path)
  }

  async listZones(): Promise<{ zones: CloudflareZoneSummary[] }> {
    const { result } = await this.request<any[]>('/zones', {
      query: { per_page: 50 }
    })

    const zones: CloudflareZoneSummary[] =
      result?.map((zone) => ({
        id: zone.id,
        name: zone.name,
        status: zone.status ?? null,
        plan: zone.plan?.name ?? null,
        recordCount: zone.meta?.page || null,
        nameServers: zone.name_servers ?? null
      })) ?? []

    return { zones }
  }

  async countRecords(zoneId: string): Promise<number | null> {
    const { resultInfo } = await this.request<any[]>(`/zones/${zoneId}/dns_records`, {
      query: { per_page: 1, fields: 'id' }
    })
    // Cloudflare returns total_count in result_info
    // Fallback to count if total_count missing
    const info: any = resultInfo ?? {}
    return info.total_count ?? info.count ?? null
  }

  async getZone(zoneId: string): Promise<CloudflareZoneSummary | null> {
    const { result } = await this.request<any>(`/zones/${zoneId}`)
    if (!result) return null
    return {
      id: result.id,
      name: result.name,
      status: result.status ?? null,
      plan: result.plan?.name ?? null,
      recordCount: result.meta?.page || null,
      nameServers: result.name_servers ?? null
    }
  }

  async createZone(payload: { name: string; accountId?: string | null; jumpStart?: boolean }) {
    const accountId = payload.accountId ?? this.accountId
    if (!accountId) {
      throw createError({
        statusCode: 400,
        message: 'Cloudflare accountId saknas. Ange accountId i organisationens plugin-inställningar.'
      })
    }

    const { result } = await this.request<any>('/zones', {
      method: 'POST',
      body: {
        name: payload.name,
        account: { id: accountId },
        type: 'full',
        jump_start: payload.jumpStart ?? false
      }
    })

    return {
      id: result.id,
      name: result.name,
      status: result.status ?? null,
      plan: result.plan?.name ?? null,
      nameServers: result.name_servers ?? null
    }
  }

  async deleteZone(zoneId: string) {
    await this.request(`/zones/${zoneId}`, { method: 'DELETE' })
    return { ok: true }
  }

  async listRecords(zoneId: string): Promise<CloudflareDnsRecord[]> {
    const { result } = await this.request<any[]>(`/zones/${zoneId}/dns_records`, {
      query: { per_page: 100 }
    })

    return (
      result?.map(
        (row) =>
          ({
            id: row.id,
            type: row.type,
            name: row.name,
            content: row.content,
            ttl: row.ttl ?? null,
            proxied: row.proxied ?? null,
            priority: row.priority ?? null,
            comment: row.comment ?? null,
            modified_on: row.modified_on ?? null
          }) satisfies CloudflareDnsRecord
      ) ?? []
    )
  }

  /**
   * Get a single DNS record by ID.
   * Used for fetching "before" state in audit logging.
   */
  async getRecord(zoneId: string, recordId: string): Promise<CloudflareDnsRecord | null> {
    try {
      const { result } = await this.request<any>(`/zones/${zoneId}/dns_records/${recordId}`)
      if (!result) return null
      return {
        id: result.id,
        type: result.type,
        name: result.name,
        content: result.content,
        ttl: result.ttl ?? null,
        proxied: result.proxied ?? null,
        priority: result.priority ?? null,
        comment: result.comment ?? null,
        modified_on: result.modified_on ?? null
      } satisfies CloudflareDnsRecord
    } catch (error: any) {
      // Return null for 404 (record not found)
      if (error?.statusCode === 404) {
        return null
      }
      throw error
    }
  }

  async createRecord(zoneId: string, record: Partial<CloudflareDnsRecord>) {
    const body = {
      type: record.type,
      name: record.name,
      content: record.content,
      ttl: record.ttl,
      proxied: record.proxied,
      priority: record.priority,
      comment: record.comment
    }
    const { result } = await this.request<any>(`/zones/${zoneId}/dns_records`, {
      method: 'POST',
      body
    })
    return {
      id: result.id,
      type: result.type,
      name: result.name,
      content: result.content,
      ttl: result.ttl ?? null,
      proxied: result.proxied ?? null,
      priority: result.priority ?? null,
      comment: result.comment ?? null,
      modified_on: result.modified_on ?? null
    } satisfies CloudflareDnsRecord
  }

  async updateRecord(zoneId: string, recordId: string, record: Partial<CloudflareDnsRecord>) {
    const body: Record<string, unknown> = {}
    if (record.type) body.type = record.type
    if (record.name) body.name = record.name
    if (record.content) body.content = record.content
    if (record.ttl !== undefined) body.ttl = record.ttl
    if (record.proxied !== undefined) body.proxied = record.proxied
    if (record.priority !== undefined) body.priority = record.priority
    if (record.comment !== undefined) body.comment = record.comment

    const { result } = await this.request<any>(`/zones/${zoneId}/dns_records/${recordId}`, {
      method: 'PATCH',
      body
    })

    return {
      id: result.id,
      type: result.type,
      name: result.name,
      content: result.content,
      ttl: result.ttl ?? null,
      proxied: result.proxied ?? null,
      priority: result.priority ?? null,
      comment: result.comment ?? null,
      modified_on: result.modified_on ?? null
    } satisfies CloudflareDnsRecord
  }

  async exportZone(zoneId: string): Promise<string> {
    try {
      const res = await ofetch(`${CF_API_BASE}/zones/${zoneId}/dns_records/export`, {
        headers: {
          Authorization: `Bearer ${this.apiToken}`
        },
        responseType: 'text'
      })
      return res as string
    } catch (error: any) {
      const statusCode = error?.response?.status ?? error?.statusCode ?? 502
      const message = error?.message ?? 'Cloudflare export error'
      throw createError({ statusCode, message: `[cloudflare] ${message}` })
    }
  }

  async importZone(zoneId: string, content: string, filename: string): Promise<{ recsAdded: number; totalRecordsParsed: number; messages: string[] }> {
    const url = `${CF_API_BASE}/zones/${zoneId}/dns_records/import`

    const formData = new FormData()
    formData.append('file', new Blob([content], { type: 'text/plain' }), filename)

    const response = await fetch(url, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${this.apiToken}`
      },
      body: formData
    })

    const data = await response.json() as CloudflareResponse<{ recs_added: number; total_records_parsed: number }>

    if (!response.ok || !data?.success) {
      const message = data?.errors?.[0]?.message ?? `Import failed with status ${response.status}`
      throw createError({ statusCode: response.status, message: `[cloudflare] ${message}` })
    }

    // Extract human-readable messages (e.g. "DNS name must be within your zone")
    const messages = Array.isArray(data.messages)
      ? data.messages.map((m: any) => typeof m === 'string' ? m : m?.message).filter(Boolean)
      : []

    return {
      recsAdded: data.result?.recs_added ?? 0,
      totalRecordsParsed: data.result?.total_records_parsed ?? 0,
      messages
    }
  }

  async deleteRecord(zoneId: string, recordId: string) {
    await this.request(`/zones/${zoneId}/dns_records/${recordId}`, { method: 'DELETE' })
    return { ok: true }
  }
}

export const getClientForOrg = async (orgId: string) => {
  const config = await getOrgConfig(orgId)
  if (!config?.apiToken) {
    throw createError({
      statusCode: 400,
      message: 'Ingen Cloudflare-token är sparad för organisationen.'
    })
  }
  return new CloudflareClient(config.apiToken, config.accountId)
}


