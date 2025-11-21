import { randomUUID } from 'node:crypto'
import { Router } from 'express'
import { dnsRecords, dnsZones } from '../data/mockData.js'
import { currentOrgId, ensurePermission } from '../utils/authz.js'
import type { DnsRecord } from '../types/domain.js'

export const dnsRouter = Router()

dnsRouter.get('/zones', (req, res) => {
  if (!ensurePermission(req, res, 'cloudflare:read')) {
    return
  }
  const organisationId = currentOrgId(req)
  const result = organisationId
    ? dnsZones.filter((zone) => zone.organisationId === organisationId)
    : []
  res.json(result)
})

dnsRouter.get('/zones/:zoneId/records', (req, res) => {
  if (!ensurePermission(req, res, 'cloudflare:read')) {
    return
  }
  const organisationId = currentOrgId(req)
  const { zoneId } = req.params
  const zone = dnsZones.find((z) => z.id === zoneId && z.organisationId === organisationId)
  if (!zone) {
    res.status(404).json({ message: 'Zone not found' })
    return
  }
  const result = dnsRecords.filter((record) => record.zoneId === zoneId)
  res.json(result)
})

dnsRouter.post('/zones/:zoneId/records', (req, res) => {
  if (!ensurePermission(req, res, 'cloudflare:write')) {
    return
  }
  const organisationId = currentOrgId(req)
  const { zoneId } = req.params
  const zone = dnsZones.find((z) => z.id === zoneId && z.organisationId === organisationId)
  if (!zone) {
    res.status(404).json({ message: 'Zone not found' })
    return
  }
  const payload = req.body as Omit<DnsRecord, 'id' | 'zoneId' | 'organisationId'>
  const record: DnsRecord = {
    id: randomUUID(),
    zoneId,
    organisationId: organisationId ?? zone.organisationId,
    ...payload
  }
  dnsRecords.push(record)
  res.status(201).json(record)
})

