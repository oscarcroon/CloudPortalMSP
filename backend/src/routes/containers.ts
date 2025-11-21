import { Router } from 'express'
import { containerInstances, containerProjects } from '../data/mockData.js'
import { currentOrgId, ensurePermission } from '../utils/authz.js'

export const containersRouter = Router()

containersRouter.get('/projects', (req, res) => {
  if (!ensurePermission(req, res, 'containers:read')) {
    return
  }
  const organisationId = currentOrgId(req)
  const result = organisationId
    ? containerProjects.filter((project) => project.organisationId === organisationId)
    : []
  res.json(result)
})

containersRouter.get('/', (req, res) => {
  if (!ensurePermission(req, res, 'containers:read')) {
    return
  }
  const organisationId = currentOrgId(req)
  const result = organisationId
    ? containerInstances.filter((container) => container.organisationId === organisationId)
    : []
  res.json(result)
})

containersRouter.post('/:containerId/actions/:action', (req, res) => {
  if (!ensurePermission(req, res, 'containers:write')) {
    return
  }
  const organisationId = currentOrgId(req)
  const { containerId, action } = req.params
  const target = containerInstances.find(
    (container) => container.id === containerId && container.organisationId === organisationId
  )
  if (!target) {
    res.status(404).json({ message: 'Container not found' })
    return
  }
  res.json({ containerId, action, status: 'queued' })
})

