export const passwordRequirements = [
  'password.requirements.length',
  'password.requirements.uppercase',
  'password.requirements.lowercase',
  'password.requirements.digit',
  'password.requirements.symbol'
] as const

export type PasswordRequirementKey = (typeof passwordRequirements)[number]


