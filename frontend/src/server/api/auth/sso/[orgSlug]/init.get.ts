import { defineEventHandler, getRouterParam } from 'h3'

export default defineEventHandler(async (event) => {
  const orgSlug = getRouterParam(event, 'orgSlug')
  // TODO: Look up organization Identity Provider configuration by slug
  // and start the correct OIDC / SAML handshake.
  return {
    status: 'pending',
    orgSlug,
    message:
      'SSO init endpoint not yet implemented. Configure organization_identity_providers to enable.'
  }
})

