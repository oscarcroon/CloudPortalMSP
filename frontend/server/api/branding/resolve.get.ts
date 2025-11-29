import { defineEventHandler, getQuery } from 'h3'
import { z } from 'zod'
import { resolveBrandingChain } from '~~/server/utils/branding'
import { requirePermission, requireTenantPermission } from '~~/server/utils/rbac'

const querySchema = z
  .object({
    organizationId: z.string().optional(),
    tenantId: z.string().optional()
  })
  .refine(
    (data) => Boolean(data.organizationId || data.tenantId),
    'Ange organizationId eller tenantId.'
  )

export default defineEventHandler(async (event) => {
  const query = querySchema.parse(getQuery(event))

  if (query.organizationId) {
    await requirePermission(event, 'org:manage', query.organizationId)
    return resolveBrandingChain({ organizationId: query.organizationId })
  }

  await requireTenantPermission(event, 'tenants:manage', query.tenantId ?? undefined)
  return resolveBrandingChain({ tenantId: query.tenantId as string })
})

