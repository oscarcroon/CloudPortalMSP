import { defineEventHandler, getRouterParam, readBody } from 'h3'
import { z } from 'zod'
import { resolveBrandingChain, updateBrandingAttributes } from '~~/server/utils/branding'
import { requireTenantPermission } from '~~/server/utils/rbac'
import { ensureBrandableTenant } from './branding/utils'

const payloadSchema = z
  .object({
    accentColor: z.string().trim().optional().nullable(),
    paletteKey: z.string().trim().optional().nullable()
  })
  .refine(
    (data) => data.accentColor !== undefined || data.paletteKey !== undefined,
    'Ange accentColor eller paletteKey.'
  )
  .refine(
    (data) => !(data.accentColor && data.paletteKey),
    'Ange antingen accentColor eller paletteKey, inte båda samtidigt.'
  )

export default defineEventHandler(async (event) => {
  const tenantId = getRouterParam(event, 'id')
  const permission = await requireTenantPermission(event, 'tenants:manage', tenantId ?? undefined)
  const tenant = await ensureBrandableTenant(tenantId as string)
  const body = payloadSchema.parse(await readBody(event))

  await updateBrandingAttributes(
    {
      targetType: tenant.type,
      tenantId: tenant.id
    },
    {
      accentColor: body.accentColor,
      paletteKey: body.paletteKey
    },
    permission.auth.user.id
  )

  return resolveBrandingChain({ tenantId: tenant.id })
})

