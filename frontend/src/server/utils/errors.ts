import type { ZodError } from 'zod'

const humanizeSegment = (segment: string) =>
  segment
    .replace(/([A-Z])/g, ' $1')
    .replace(/^./, (c) => c.toUpperCase())
    .trim()

const humanizePath = (path: string) =>
  path
    .split('.')
    .map((segment) => humanizeSegment(segment))
    .join(' → ')

export const formatZodError = (error: ZodError) => {
  const flattened = error.flatten()
  const fieldMessages = Object.entries(flattened.fieldErrors).flatMap(([field, messages]) =>
    (messages ?? []).map(
      (message) => `Fältet "${humanizePath(field)}": ${message || 'Ogiltigt värde.'}`
    )
  )

  const formMessages = flattened.formErrors.map((message) => `Fel: ${message}`)

  const combined = [...fieldMessages, ...formMessages]

  return combined.length
    ? combined.join(' ')
    : 'Indata kunde inte valideras. Kontrollera att alla obligatoriska fält är ifyllda.'
}

export const isMissingCryptoKeyError = (error: unknown) =>
  error instanceof Error && error.message.toLowerCase().includes('email_crypto_key')

export const cryptoKeyHelpText =
  'EMAIL_CRYPTO_KEY saknas. Lägg till en 32-byte nyckel i frontend/.env (t.ex. via "openssl rand -base64 32") och starta om servern.'

