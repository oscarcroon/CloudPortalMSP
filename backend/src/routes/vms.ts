import { Router } from 'express'
import { vms } from '../data/mockData.js'
import { currentOrgId, ensurePermission } from '../utils/authz.js'

export const vmRouter = Router()

vmRouter.get('/', (req, res) => {
  if (!ensurePermission(req, res, 'vms:read')) {
    return
  }
  const organisationId = currentOrgId(req)
  const result = organisationId ? vms.filter((vm) => vm.organisationId === organisationId) : []
  res.json(result)
})

vmRouter.post('/:vmId/actions/:action', (req, res) => {
  if (!ensurePermission(req, res, 'vms:write')) {
    return
  }
  const organisationId = currentOrgId(req)
  const { vmId, action } = req.params
  const target = vms.find((vm) => vm.id === vmId && vm.organisationId === organisationId)
  if (!target) {
    res.status(404).json({ message: 'VM not found' })
    return
  }
  res.json({ vmId, action, status: 'queued' })
})

