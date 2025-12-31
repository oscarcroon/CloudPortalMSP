/**
 * GET /api/openapi.internal.json
 *
 * Returns the internal OpenAPI specification (all routes).
 * Protected: Requires session auth + superadmin.
 */
import { defineEventHandler } from 'h3'
import { requireSuperAdmin } from '../utils/rbac'
import { getInternalSpec } from '../openapi/spec'

export default defineEventHandler(async (event) => {
  // Require superadmin access for internal docs
  await requireSuperAdmin(event)

  // Get server URL from request
  const protocol = event.node.req.headers['x-forwarded-proto'] || 'http'
  const host = event.node.req.headers.host || 'localhost:3000'
  const serverUrl = `${protocol}://${host}`

  // Return the OpenAPI spec
  const spec = getInternalSpec(serverUrl)

  // Set content type
  event.node.res.setHeader('Content-Type', 'application/json')

  return spec
})

