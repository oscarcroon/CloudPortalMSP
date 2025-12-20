import cors from 'cors'
import dotenv from 'dotenv'
import express, { type Request, type Response, type NextFunction, type ErrorRequestHandler } from 'express'
import helmet from 'helmet'
import rateLimit from 'express-rate-limit'
import morgan from 'morgan'
import path from 'node:path'
import crypto from 'node:crypto'
import { fileURLToPath } from 'node:url'
import { tenantContext } from './middleware/context.js'
import { containersRouter } from './routes/containers.js'
import { dnsRouter } from './routes/dns.js'
import { emailRouter } from './routes/emailProviders.js'
import { invitationsRouter } from './routes/invitations.js'
import { organisationEmailProviderRouter } from './routes/organisationEmailProviders.js'
import { organisationMembersRouter } from './routes/organisationMembers.js'
import { organisationsRouter } from './routes/organisations.js'
import { vmRouter } from './routes/vms.js'
import { wordpressRouter } from './routes/wordpress.js'
import { getRequestId, logInfo, logWarn, logError } from './utils/logger.js'

const currentDir = path.dirname(fileURLToPath(import.meta.url))
const rootDir = path.resolve(currentDir, '..', '..')
dotenv.config({ path: path.resolve(rootDir, '.env') })

// ============================================================================
// Environment validation (fail fast in production)
// ============================================================================

const isProd = process.env.NODE_ENV === 'production'

const validateEnv = () => {
  const errors: string[] = []

  if (isProd) {
    if (!process.env.AUTH_SERVICE_TOKEN) {
      errors.push('AUTH_SERVICE_TOKEN is required in production')
    }
    if (!process.env.AUTH_INTROSPECT_URL) {
      errors.push('AUTH_INTROSPECT_URL is required in production')
    }
    if (!process.env.PUBLIC_BASE_URL) {
      errors.push('PUBLIC_BASE_URL is required in production to prevent host header poisoning')
    }
  }

  if (errors.length > 0) {
    const message =
      '\n[server] FATAL: Environment validation failed:\n' +
      errors.map((e) => `  - ${e}`).join('\n') +
      '\n\nServer cannot start with insecure configuration.\n'

    console.error(message)
    process.exit(1)
  }
}

validateEnv()

// ============================================================================
// App setup
// ============================================================================

const app = express()

// Use UPLOADS_DIR env var if set, otherwise default to ../uploads relative to src
const resolveUploadsRoot = () => {
  const custom = process.env.UPLOADS_DIR
  if (custom) {
    return path.isAbsolute(custom) ? custom : path.resolve(process.cwd(), custom)
  }
  return path.resolve(currentDir, '..', 'uploads')
}

const uploadsRoot = resolveUploadsRoot()
const publicLogosDir = path.join(uploadsRoot, 'logos')

// ============================================================================
// Trust proxy (only if explicitly configured)
// ============================================================================

// SECURITY: Only enable trust proxy if running behind a known reverse proxy.
// This affects req.ip, req.protocol, and req.hostname.
if (process.env.TRUST_PROXY === '1' || process.env.TRUST_PROXY === 'true') {
  app.set('trust proxy', 1)
}

// ============================================================================
// Security hardening
// ============================================================================

// Remove X-Powered-By header
app.disable('x-powered-by')

// Helmet for security headers
app.use(
  helmet({
    // Customize as needed for your frontend
    contentSecurityPolicy: false, // Let frontend handle CSP
    crossOriginEmbedderPolicy: false // May interfere with some integrations
  })
)

// CORS
app.use(
  cors({
    origin: process.env.CORS_ORIGIN?.split(',') ?? ['http://localhost:3000'],
    credentials: true
  })
)

// Body size limits
app.use(express.json({ limit: '100kb' }))
app.use(express.urlencoded({ extended: false, limit: '50kb' }))

// Global rate limiting (mild, protects against abuse)
const globalLimiter = rateLimit({
  windowMs: 60 * 1000, // 1 minute
  max: 300, // 300 requests per minute per IP
  standardHeaders: true,
  legacyHeaders: false,
  message: { message: 'Too many requests, please try again later.' },
  skip: (req) => {
    // Skip rate limiting for health checks
    return req.path === '/healthz' || req.path === '/api/health'
  }
})

app.use(globalLimiter)

// ============================================================================
// Sensitive data redaction for logging
// ============================================================================

const SENSITIVE_KEYS = new Set([
  'authorization',
  'cookie',
  'token',
  'secret',
  'password',
  'code',
  'api_key',
  'apikey',
  'access_token',
  'refresh_token'
])

const redactSensitiveData = (obj: Record<string, unknown> | undefined): Record<string, unknown> | undefined => {
  if (!obj || typeof obj !== 'object') return obj

  const result: Record<string, unknown> = {}
  for (const [key, value] of Object.entries(obj)) {
    const lowerKey = key.toLowerCase()
    if (SENSITIVE_KEYS.has(lowerKey) || lowerKey.includes('token') || lowerKey.includes('secret')) {
      result[key] = '[REDACTED]'
    } else if (typeof value === 'object' && value !== null) {
      result[key] = redactSensitiveData(value as Record<string, unknown>)
    } else {
      result[key] = value
    }
  }
  return result
}

// Request logging middleware
app.use((req: Request, res: Response, next: NextFunction) => {
  const requestId = getRequestId(req)
  res.setHeader('x-request-id', requestId)

  const startTime = Date.now()

  // Log request with redacted query params
  const redactedQuery = redactSensitiveData(req.query as Record<string, unknown>)
  logInfo(req, `Incoming request: ${req.method} ${req.path}`, {
    query: redactedQuery || undefined
  })

  // Log response when finished
  res.on('finish', () => {
    const duration = Date.now() - startTime
    const message = `Request completed: ${req.method} ${req.path} - ${res.statusCode} (${duration}ms)`

    if (res.statusCode >= 500) {
      logError(req, message, undefined, { duration }, res)
    } else if (res.statusCode >= 400) {
      logWarn(req, message, { duration }, res)
    } else {
      logInfo(req, message, { duration }, res)
    }
  })

  next()
})

// Keep morgan for compatibility, but structured logging is primary
if (!isProd) {
  app.use(morgan('dev'))
}

// ============================================================================
// Public endpoints (before auth middleware)
// ============================================================================

// Health check endpoints - must be accessible without authentication
// for load balancers and liveness probes
app.get('/healthz', (_req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() })
})

app.get('/api/health', (_req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() })
})

// Serve only explicitly public uploads (logos).
// Do NOT expose the entire uploads folder publicly.
app.use(
  '/uploads/logos',
  express.static(publicLogosDir, {
    dotfiles: 'deny',
    index: false,
    fallthrough: false,
    etag: true,
    immutable: isProd,
    maxAge: isProd ? '365d' : 0,
    setHeaders: (res) => {
      // Mitigate content-type sniffing and reduce XSS risk (especially for SVG)
      res.setHeader('X-Content-Type-Options', 'nosniff')
      res.setHeader(
        'Content-Security-Policy',
        "default-src 'none'; img-src 'self' data:; style-src 'none'; sandbox"
      )
    }
  })
)

// ============================================================================
// Authenticated endpoints
// ============================================================================

app.use(tenantContext)

app.use('/api/dns', dnsRouter)
app.use('/api/containers', containersRouter)
app.use('/api/vms', vmRouter)
app.use('/api/wordpress', wordpressRouter)
app.use('/api/email', emailRouter)
app.use('/api/organisations', organisationsRouter)
app.use('/api/organisations', organisationEmailProviderRouter)
app.use('/api/organisations', organisationMembersRouter)
app.use('/api/invitations', invitationsRouter)

// ============================================================================
// Central error handler (must be last)
// ============================================================================

const errorHandler: ErrorRequestHandler = (err, req, res, _next) => {
  // Generate error ID for correlation
  const errorId = crypto.randomUUID().slice(0, 8)
  const requestId = getRequestId(req)

  // Log the full error internally
  logError(req, `Unhandled error [${errorId}]: ${err.message}`, err, {
    errorId,
    stack: isProd ? undefined : err.stack
  })

  // Determine status code
  const statusCode = err.status || err.statusCode || 500

  // In production, don't expose internal error details
  const response = {
    message: isProd && statusCode >= 500 ? 'Internal server error' : err.message || 'An error occurred',
    errorId,
    requestId
  }

  res.status(statusCode).json(response)
}

app.use(errorHandler)

// ============================================================================
// Start server
// ============================================================================

const PORT = Number(process.env.PORT || 4000)

app.listen(PORT, () => {
  console.log(`API gateway running on http://localhost:${PORT}`)
  if (isProd) {
    console.log('Running in PRODUCTION mode with security hardening enabled')
  }
})
