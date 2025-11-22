import { z } from 'zod'

export const organizationAuthUpdateSchema = z
  .object({
    requireSso: z.boolean().optional(),
    allowSelfSignup: z.boolean().optional(),
    allowLocalLoginForOwners: z.boolean().optional(),
    idpType: z.enum(['none', 'saml', 'oidc']).optional(),
    idpConfig: z.record(z.any()).nullable().optional()
  })
  .refine(
    (payload) =>
      payload.requireSso !== undefined ||
      payload.allowSelfSignup !== undefined ||
      payload.allowLocalLoginForOwners !== undefined ||
      payload.idpType !== undefined ||
      payload.idpConfig !== undefined,
    { message: 'Inga ändringar angavs.' }
  )

export type OrganizationAuthUpdatePayload = z.infer<typeof organizationAuthUpdateSchema>

