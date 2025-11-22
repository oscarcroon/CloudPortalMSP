import { defineEventHandler, getQuery } from 'h3'
import { z } from 'zod'
import { listOrganizationsForEmail } from '../../../utils/auth'
import type { AuthOrganization } from 'server/types/auth'

const querySchema = z.object({
  email: z.string().email()
})

export default defineEventHandler(async (event) => {
  const { email } = querySchema.parse(getQuery(event))
  const { user, organizations } = await listOrganizationsForEmail(email)
  return {
    userExists: Boolean(user),
    organizations: organizations.map((org: AuthOrganization) => ({
      id: org.id,
      name: org.name,
      requireSso: org.requireSso,
      slug: org.slug
    })),
    requiresSso: organizations.some((org) => org.requireSso),
    // TODO: attach identity provider metadata once organization_identity_providers is populated
    identityProviders: []
  }
})

