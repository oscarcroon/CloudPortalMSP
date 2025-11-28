import cors from 'cors'
import dotenv from 'dotenv'
import express, { type Request, type Response, type NextFunction } from 'express'
import morgan from 'morgan'
import path from 'node:path'
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

const app = express()
const uploadsRoot = path.resolve(currentDir, '..', 'uploads')

app.use(
  cors({
    origin: process.env.CORS_ORIGIN?.split(',') ?? ['http://localhost:3000'],
    credentials: true
  })
)
app.use(express.json())

// Request logging middleware
app.use((req: Request, res: Response, next: NextFunction) => {
  const requestId = getRequestId(req)
  res.setHeader('x-request-id', requestId)
  
  const startTime = Date.now()
  
  // Log request
  logInfo(req, `Incoming request: ${req.method} ${req.path}`, {
    query: req.query || undefined
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
if (process.env.NODE_ENV !== 'production') {
  app.use(morgan('dev'))
}

app.use(tenantContext)
app.use('/uploads', express.static(uploadsRoot))

app.get('/api/health', (_req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() })
})

app.use('/api/dns', dnsRouter)
app.use('/api/containers', containersRouter)
app.use('/api/vms', vmRouter)
app.use('/api/wordpress', wordpressRouter)
app.use('/api/email', emailRouter)
app.use('/api/organisations', organisationsRouter)
app.use('/api/organisations', organisationEmailProviderRouter)
app.use('/api/organisations', organisationMembersRouter)
app.use('/api/invitations', invitationsRouter)

const PORT = Number(process.env.PORT || 4000)

app.listen(PORT, () => {
  console.log(`API gateway running on http://localhost:${PORT}`)
})

