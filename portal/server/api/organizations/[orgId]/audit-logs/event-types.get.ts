/**
 * GET /api/organizations/:orgId/audit-logs/event-types
 * Returns available audit event types for filtering in the UI.
 * Event types are loaded dynamically from the audit registry.
 */
import { defineEventHandler, getRouterParam, getQuery, createError } from 'h3'
import { requirePermission } from '../../../../utils/rbac'
import {
  getAllOrgAuditEventTypes,
  getAllAuditEventLabels,
  getAuditEventTypesByModule,
  coreOrgAuditEventTypes,
  coreAuditEventLabels
} from '../../../../audit/registry'

export default defineEventHandler(async (event) => {
  const orgId = getRouterParam(event, 'orgId')
  if (!orgId) {
    throw createError({ statusCode: 400, message: 'Missing organization ID' })
  }

  await requirePermission(event, 'audit:read', orgId)

  const query = getQuery(event)
  const locale = (query.locale as 'sv' | 'en') || 'sv'

  // Get all event types from registry
  const eventTypes = getAllOrgAuditEventTypes()
  const labels = getAllAuditEventLabels()

  // Get grouped by module for UI dropdowns
  const moduleGroups = getAuditEventTypesByModule(locale)

  // Add core events as a group
  const coreGroup = {
    moduleKey: 'core',
    moduleName: locale === 'sv' ? 'Kärna' : 'Core',
    eventTypes: coreOrgAuditEventTypes.map(type => ({
      type,
      label: coreAuditEventLabels[type]?.[locale] ?? type
    }))
  }

  return {
    // Flat list of all event types
    eventTypes,
    // Labels for each event type
    labels,
    // Grouped by module for dropdown with optgroups
    groups: [coreGroup, ...moduleGroups]
  }
})
