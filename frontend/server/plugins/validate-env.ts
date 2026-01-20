/**
 * Nitro plugin that validates required environment variables at server start.
 * In production, missing or insecure secrets will cause a hard fail.
 */

const DANGEROUS_JWT_SECRETS = new Set([
  'dev-secret-change-me',
  'secret',
  'changeme',
  'test',
  'development'
])

const MIN_JWT_SECRET_LENGTH = 32

export default async () => {
  const isProd = process.env.NODE_ENV === 'production'

  if (!isProd) {
    // In development, just warn about missing/weak secrets
    const jwtSecret = process.env.AUTH_JWT_SECRET || ''
    const serviceToken = process.env.AUTH_SERVICE_TOKEN || ''

    if (!jwtSecret || DANGEROUS_JWT_SECRETS.has(jwtSecret.toLowerCase())) {
      console.warn(
        '[validate-env] WARNING: AUTH_JWT_SECRET is missing or using a dangerous default. ' +
          'This is acceptable in development but will fail in production.'
      )
    }

    if (!serviceToken) {
      console.warn(
        '[validate-env] WARNING: AUTH_SERVICE_TOKEN is not set. ' +
          'Introspection endpoint will be unprotected. This is acceptable in development.'
      )
    }

    return
  }

  // Production validation - hard fail on missing/insecure configuration
  const errors: string[] = []

  // Validate AUTH_JWT_SECRET
  const jwtSecret = process.env.AUTH_JWT_SECRET || ''
  if (!jwtSecret) {
    errors.push('AUTH_JWT_SECRET is required in production')
  } else if (DANGEROUS_JWT_SECRETS.has(jwtSecret.toLowerCase())) {
    errors.push(
      `AUTH_JWT_SECRET is set to a dangerous default value. ` +
        `Use a strong, unique secret (min ${MIN_JWT_SECRET_LENGTH} characters).`
    )
  } else if (jwtSecret.length < MIN_JWT_SECRET_LENGTH) {
    errors.push(
      `AUTH_JWT_SECRET must be at least ${MIN_JWT_SECRET_LENGTH} characters. ` +
        `Current length: ${jwtSecret.length}`
    )
  }

  // Validate AUTH_SERVICE_TOKEN
  const serviceToken = process.env.AUTH_SERVICE_TOKEN || ''
  if (!serviceToken) {
    errors.push('AUTH_SERVICE_TOKEN is required in production for secure introspection')
  } else if (serviceToken.length < 16) {
    errors.push('AUTH_SERVICE_TOKEN should be at least 16 characters for security')
  }

  if (errors.length > 0) {
    const message =
      '\n[validate-env] FATAL: Production environment validation failed:\n' +
      errors.map((e) => `  - ${e}`).join('\n') +
      '\n\nServer cannot start with insecure configuration.\n'

    console.error(message)
    throw new Error('Environment validation failed. See logs for details.')
  }

  console.log('[validate-env] Production environment validation passed')
}
