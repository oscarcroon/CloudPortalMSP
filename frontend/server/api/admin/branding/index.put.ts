import { defineEventHandler, readBody } from 'h3'
import { z } from 'zod'
import { resolveGlobalBranding, updateBrandingAttributes } from '~~/server/utils/branding'
import { requireSuperAdmin } from '~~/server/utils/rbac'

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
    (data) => !(data.accentColor !== undefined && data.paletteKey !== undefined),
    'Ange antingen accentColor eller paletteKey, inte båda samtidigt.'
  )

export default defineEventHandler(async (event) => {
  const auth = await requireSuperAdmin(event)
  const body = payloadSchema.parse(await readBody(event))

  await updateBrandingAttributes(
    { targetType: 'global' },
    {
      accentColor: body.accentColor,
      paletteKey: body.paletteKey,
      loginBackgroundTint: body.loginBackgroundTint,
      loginBackgroundTintOpacity: body.loginBackgroundTintOpacity,
      navigationBackgroundColor: body.navigationBackgroundColor
    },
    auth.user.id
  )

  return resolveGlobalBranding()
})

