import { defineEventHandler, getRequestURL, getRequestHeader, setResponseHeader } from 'h3'
import { getRequestId } from '../utils/logger'
import { logInfo, logWarn, logError } from '../utils/logger'

/**
 * Request logging middleware
 * Generates request ID, logs incoming requests, and sets response headers
 */
export default defineEventHandler(async (event) => {
  const startTime = Date.now()
  const requestId = getRequestId(event)
  
  // Set request ID in response header
  setResponseHeader(event, 'x-request-id', requestId)
  
  // Forward to backend if needed
  const backendRequestId = getRequestHeader(event, 'x-request-id')
  if (!backendRequestId) {
    // Could set it in a header for backend requests
    event.context.backendRequestId = requestId
  }
  
  // Log incoming request
  const url = getRequestURL(event)
  const method = event.node.req.method
  
  await logInfo(event, `Incoming request: ${method} ${url.pathname}`, {
    query: url.search || undefined
  })
  
  // Handle response logging
  const originalEnd = event.node.res.end
  event.node.res.end = function(chunk?: any, encoding?: any, cb?: any) {
    const duration = Date.now() - startTime
    const statusCode = event.node.res.statusCode
    
    // Log response
    const logMessage = `Request completed: ${method} ${url.pathname} - ${statusCode} (${duration}ms)`
    
    if (statusCode >= 500) {
      logError(event, logMessage, undefined, { statusCode, duration })
    } else if (statusCode >= 400) {
      logWarn(event, logMessage, { statusCode, duration })
    } else {
      logInfo(event, logMessage, { statusCode, duration })
    }
    
    // Call original end
    return originalEnd.call(this, chunk, encoding, cb)
  }
})

