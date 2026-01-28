import { inArray } from 'drizzle-orm'
import { defineEventHandler, getQuery } from 'h3'
import { z } from 'zod'
import { listOrganizationsForEmail } from '../../../utils/auth'
import type { AuthOrganization } from '~~/server/types/auth'
import { getDb } from '~~/server/utils/db'
import { organizationAuthSettings } from '~~/server/database/schema'
import type { OrganizationIdpType } from '~/types/admin'
import { hasConfiguredIdp, parseIdpConfigString } from '~~/server/utils/idp'

const querySchema = z.object({
  email: z.string().email()
})

export default defineEventHandler(async (event) => {
  const { email } = querySchema.parse(getQuery(event))
  const { user, organizations } = await listOrganizationsForEmail(email)
  const orgIds = organizations.map((org: AuthOrganization) => org.id)
  const db = getDb()
  let authMap: Record<
    string,
    { idpType: OrganizationIdpType; idpConfig: Record<string, unknown> | null }
  > = {}

  if (orgIds.length) {
    const authRows = await db
      .select({
        organizationId: organizationAuthSettings.organizationId,
        idpType: organizationAuthSettings.idpType,
        idpConfig: organizationAuthSettings.idpConfig
      })
      .from(organizationAuthSettings)
      .where(inArray(organizationAuthSettings.organizationId, orgIds))

    authMap = authRows.reduce<typeof authMap>((acc, row) => {
      acc[row.organizationId] = {
        idpType: row.idpType as OrganizationIdpType,
        idpConfig: parseIdpConfigString(row.idpConfig)
      }
      return acc
    }, {})
  }

  const identityProviders = organizations
    .map((org: AuthOrganization) => {
      const authInfo = authMap[org.id]
      if (!authInfo) {
        return null
      }
      if (!hasConfiguredIdp(authInfo.idpType, authInfo.idpConfig)) {
        return null
      }
      const provider =
        authInfo.idpType === 'oidc' && authInfo.idpConfig
          ? ((authInfo.idpConfig.provider as string) ?? 'oidc')
          : authInfo.idpType
      return {
        organizationId: org.id,
        organizationName: org.name,
        slug: org.slug,
        requireSso: org.requireSso,
        provider
      }
    })
    .filter((item): item is NonNullable<typeof item> => Boolean(item))

  return {
    userExists: Boolean(user),
    organizations: organizations.map((org: AuthOrganization) => ({
      id: org.id,
      name: org.name,
      requireSso: org.requireSso,
      slug: org.slug
    })),
    requiresSso: organizations.some((org) => org.requireSso),
    identityProviders
  }
})


