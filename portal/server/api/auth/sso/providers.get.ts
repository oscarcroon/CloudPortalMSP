import { and, eq } from 'drizzle-orm'
import { defineEventHandler, getQuery } from 'h3'
import { z } from 'zod'
import { findUserByEmail } from '../../../utils/auth'
import { getDb } from '~~/server/utils/db'
import {
  organizationAuthSettings,
  organizationSsoDomains,
  organizations
} from '~~/server/database/schema'
import { hasConfiguredIdp, parseIdpConfigString } from '~~/server/utils/idp'

const querySchema = z.object({
  email: z.string().email()
})

export default defineEventHandler(async (event) => {
  const { email } = querySchema.parse(getQuery(event))
  const user = await findUserByEmail(email)
  const db = getDb()

  // Extract domain from email
  const emailDomain = email.split('@')[1]?.toLowerCase()
  if (!emailDomain) {
    return {
      userExists: Boolean(user),
      requiresSso: false,
      identityProviders: []
    }
  }

  // Look up verified SSO domains matching the email domain
  const ssoDomainRows = await db
    .select({
      org: organizations,
      auth: organizationAuthSettings,
      ssoDomain: organizationSsoDomains
    })
    .from(organizationSsoDomains)
    .innerJoin(organizations, eq(organizations.id, organizationSsoDomains.organizationId))
    .leftJoin(
      organizationAuthSettings,
      eq(organizationAuthSettings.organizationId, organizations.id)
    )
    .where(
      and(
        eq(organizationSsoDomains.domain, emailDomain),
        eq(organizationSsoDomains.verificationStatus, 'verified')
      )
    )

  const identityProviders = ssoDomainRows
    .map((row) => {
      if (!row.auth) return null
      const idpConfig = parseIdpConfigString(row.auth.idpConfig)
      if (!hasConfiguredIdp(row.auth.idpType as any, idpConfig)) return null

      const provider =
        row.auth.idpType === 'oidc' && idpConfig
          ? ((idpConfig.provider as string) ?? 'oidc')
          : row.auth.idpType

      return {
        organizationId: row.org.id,
        organizationName: row.org.name,
        slug: row.org.slug,
        requireSso: Boolean(row.org.requireSso),
        provider
      }
    })
    .filter((item): item is NonNullable<typeof item> => Boolean(item))

  return {
    userExists: Boolean(user),
    requiresSso: identityProviders.some((p) => p.requireSso),
    identityProviders
  }
})
