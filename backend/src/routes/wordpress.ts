import { Router } from 'express'
import { wordpressSites } from '../data/mockData.js'
import { currentOrgId, ensurePermission } from '../utils/authz.js'

export const wordpressRouter = Router()

wordpressRouter.get('/sites', (req, res) => {
  if (!ensurePermission(req, res, 'wordpress:read')) {
    return
  }
  const organisationId = currentOrgId(req)
  const result = organisationId
    ? wordpressSites.filter((site) => site.organisationId === organisationId)
    : []
  res.json(result)
})

wordpressRouter.post('/sites/:siteId/actions/:action', (req, res) => {
  if (!ensurePermission(req, res, 'wordpress:write')) {
    return
  }
  const organisationId = currentOrgId(req)
  const { siteId, action } = req.params
  const target = wordpressSites.find(
    (site) => site.id === siteId && site.organisationId === organisationId
  )
  if (!target) {
    res.status(404).json({ message: 'Site not found' })
    return
  }
  res.json({ siteId, action, status: 'queued' })
})

