/**
 * Domain Verification Scheduler
 * 
 * Nitro plugin that periodically checks pending domain verifications
 * and updates their status based on DNS TXT record lookups.
 */
import { runDomainVerificationCheck } from '~~/server/lib/domain-verification/scheduler'

// Verification check interval (5 minutes)
const CHECK_INTERVAL_MS = 5 * 60 * 1000

// Minimum delay before first check after server start (30 seconds)
const INITIAL_DELAY_MS = 30 * 1000

let intervalId: ReturnType<typeof setInterval> | null = null

export default async () => {
  // Only run in production or when explicitly enabled
  const enabled = process.env.DOMAIN_VERIFICATION_SCHEDULER_ENABLED !== 'false'
  
  if (!enabled) {
    console.log('[domain-verification] Scheduler disabled')
    return
  }
  
  console.log('[domain-verification] Starting scheduler...')
  
  // Initial check after delay
  setTimeout(async () => {
    try {
      await runDomainVerificationCheck()
    } catch (error) {
      console.error('[domain-verification] Initial check failed:', error)
    }
    
    // Set up periodic checks
    intervalId = setInterval(async () => {
      try {
        await runDomainVerificationCheck()
      } catch (error) {
        console.error('[domain-verification] Scheduled check failed:', error)
      }
    }, CHECK_INTERVAL_MS)
    
    console.log(`[domain-verification] Scheduler running (interval: ${CHECK_INTERVAL_MS / 1000}s)`)
  }, INITIAL_DELAY_MS)
}
