import type { H3Event } from 'h3'

/**
 * Get client IP address from H3Event
 * Handles proxies and load balancers via x-forwarded-for and x-real-ip headers
 */
export const getClientIP = (event: H3Event): string | null => {
  // Try x-forwarded-for header first (for proxies/load balancers)
  const xForwardedFor = event.node.req.headers['x-forwarded-for']
  if (xForwardedFor) {
    const ips = Array.isArray(xForwardedFor) ? xForwardedFor[0] : xForwardedFor
    return ips.split(',')[0].trim()
  }

  // Try x-real-ip header
  const xRealIp = event.node.req.headers['x-real-ip']
  if (xRealIp) {
    return Array.isArray(xRealIp) ? xRealIp[0] : xRealIp
  }

  // Fallback to socket remote address
  const remoteAddress = event.node.req.socket?.remoteAddress
  if (remoteAddress) {
    return remoteAddress
  }

  return null
}

