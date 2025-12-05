import { createError, defineEventHandler, getRouterParam, readBody } from 'h3'
import { z } from 'zod'
import { resolveBrandingChain, updateBrandingAttributes } from '~~/server/utils/branding'
import { requirePermission } from '~~/server/utils/rbac'

const payloadSchema = z
  .object({
    accentColor: z.string().trim().optional().nullable(),
    paletteKey: z.string().trim().optional().nullable(),
    loginBackgroundTint: z.string().trim().optional().nullable(),
    loginBackgroundTintOpacity: z.number().min(0).max(1).optional().nullable(),
    navigationBackgroundColor: z.string().trim().optional().nullable()
  })
  .refine(
    (data) =>
      data.accentColor !== undefined ||
      data.paletteKey !== undefined ||
      data.loginBackgroundTint !== undefined ||
      data.loginBackgroundTintOpacity !== undefined ||
      data.navigationBackgroundColor !== undefined,
    'Ange minst ett fält att uppdatera.'
  )
  .refine(
    (data) => !(data.accentColor && data.paletteKey),
    'Ange antingen accentColor eller paletteKey, inte båda samtidigt.'
  )

export default defineEventHandler(async (event) => {
  const { orgId, auth } = await requirePermission(event, 'org:manage')
  const paramOrgId = getRouterParam(event, 'orgId')
  if (paramOrgId !== orgId) {
    throw createError({
      statusCode: 403,
      message: 'Kan inte uppdatera branding för denna organisation.'
    })
  }

  const body = payloadSchema.parse(await readBody(event))

  await updateBrandingAttributes(
    { targetType: 'organization', organizationId: orgId },
    {
      accentColor: body.accentColor,
      paletteKey: body.paletteKey,
      loginBackgroundTint: body.loginBackgroundTint,
      loginBackgroundTintOpacity: body.loginBackgroundTintOpacity,
      navigationBackgroundColor: body.navigationBackgroundColor
    },
    auth.user.id
  )

  return resolveBrandingChain({ organizationId: orgId })
})

