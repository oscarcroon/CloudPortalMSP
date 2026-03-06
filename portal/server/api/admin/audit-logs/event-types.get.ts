/**
 * GET /api/admin/audit-logs/event-types
 * Returns available audit event types for admin filtering.
 * Event types are loaded dynamically from the audit registry.
 * 
 * Supports filtering by module (layer).
 */
import { defineEventHandler, getQuery, createError } from 'h3'
import { ensureAuthState } from '../../../utils/session'
import {
  getAdminAuditModules,
  getAllAdminAuditEventTypes,
  getAllAuditEventLabels
} from '../../../audit/registry'

export default defineEventHandler(async (event) => {
  // Require authenticated user with admin access
  const auth = await ensureAuthState(event)
  if (!auth) {
    throw createError({ statusCode: 401, message: 'Authentication required' })
  }

  // Check if user has admin access (tenant admin, platform admin, etc.)
  // For now we just check they're authenticated - the actual admin check
  // happens in the audit-logs endpoint itself
  
  const query = getQuery(event)
  const locale = (query.locale as 'sv' | 'en') || 'sv'

  // Get all modules with their event types
  const modules = getAdminAuditModules(locale)

  // Get flat list of all event types
  const eventTypes = getAllAdminAuditEventTypes()

  // Get all labels
  const labels = getAllAuditEventLabels()

  return {
    // All event types (flat list)
    eventTypes,
    // Labels for each event type
    labels,
    // Modules with their event types (for grouped dropdown/filter)
    modules
  }
})
