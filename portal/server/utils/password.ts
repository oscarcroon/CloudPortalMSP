import { z } from 'zod'
import { passwordRequirements } from '~/constants/password'

export const PASSWORD_RESET_TOKEN_TTL_MS = 1000 * 60 * 30 // 30 minuter

const hasLowercase = /[a-z]/
const hasUppercase = /[A-Z]/
const hasDigit = /[0-9]/
const hasSymbol = /[^A-Za-z0-9]/

export const passwordSchema = z
  .string()
  .min(12, { message: 'Lösenordet måste vara minst 12 tecken.' })
  .max(256, { message: 'Lösenordet är för långt.' })
  .superRefine((value, ctx) => {
    if (!hasLowercase.test(value)) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: 'Minst en gemen (a-z) krävs.'
      })
    }
    if (!hasUppercase.test(value)) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: 'Minst en versal (A-Z) krävs.'
      })
    }
    if (!hasDigit.test(value)) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: 'Minst en siffra krävs.'
      })
    }
    if (!hasSymbol.test(value)) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: 'Minst ett specialtecken krävs.'
      })
    }
  })

export const describePasswordRequirements = () => passwordRequirements


