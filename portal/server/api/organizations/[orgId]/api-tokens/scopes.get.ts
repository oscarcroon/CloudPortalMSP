/**
 * GET /api/organizations/:orgId/api-tokens/scopes
 *
 * Returns available API token scopes grouped by category/module,
 * plus scope templates for quick selection.
 */
import { defineEventHandler, getRouterParams, createError } from 'h3'
import { requirePermission } from '../../../../utils/rbac'
import { getScopesGrouped, getScopeTemplates } from '../../../../security/apiTokens'

export default defineEventHandler(async (event) => {
  const { orgId } = getRouterParams(event)

  if (!orgId) {
    throw createError({ statusCode: 400, message: 'Organization ID required' })
  }

  await requirePermission(event, 'org:manage', orgId)

  return {
    groups: getScopesGrouped(),
    templates: getScopeTemplates(),
  }
})
