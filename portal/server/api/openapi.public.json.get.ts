/**
 * GET /api/openapi.public.json
 *
 * Returns the public OpenAPI specification (opt-in routes only).
 * Protected: Requires session auth.
 */
import { defineEventHandler } from 'h3'
import { requireSession } from '../utils/session'
import { getPublicSpec } from '../openapi/spec'

export default defineEventHandler(async (event) => {
  // Require session for public docs (can be relaxed later)
  await requireSession(event)

  // Get server URL from request
  const protocol = event.node.req.headers['x-forwarded-proto'] || 'http'
  const host = event.node.req.headers.host || 'localhost:3000'
  const serverUrl = `${protocol}://${host}`

  // Return the OpenAPI spec
  // Note: Currently returns empty spec until public operations are defined
  const spec = getPublicSpec(serverUrl)

  // Set content type
  event.node.res.setHeader('Content-Type', 'application/json')

  return spec
})

