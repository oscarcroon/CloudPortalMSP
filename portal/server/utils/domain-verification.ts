/**
 * Domain Verification Utilities
 * 
 * Provides functions for custom domain verification via DNS TXT records.
 * Used by both tenants and organizations for domain ownership verification.
 */
import { createError } from 'h3'
import { createId } from '@paralleldrive/cuid2'
import { promises as dns } from 'dns'

// Reserved/blocked domains that cannot be used as custom domains
const BLOCKED_DOMAINS = [
  'localhost',
  'localhost.localdomain',
  'example.com',
  'example.org',
  'example.net',
  'test.com',
  'test.org',
  'invalid',
  'local'
]

const BLOCKED_TLD_PATTERNS = [
  /\.local$/,
  /\.localhost$/,
  /\.test$/,
  /\.invalid$/,
  /\.example$/,
  /\.internal$/,
  /\.lan$/
]

/**
 * Normalize and validate a domain name
 */
export function normalizeDomain(value?: string | null): string | null {
  if (!value) {
    return null
  }
  
  let domain = value.trim().toLowerCase()
  if (!domain) {
    return null
  }
  
  // Remove protocol if present
  domain = domain.replace(/^https?:\/\//, '')
  
  // Remove path, query, port
  domain = domain.split('/')[0] ?? ''
  domain = domain.split('?')[0] ?? ''
  domain = domain.replace(/:\d+$/, '')
  
  // Remove trailing dot
  domain = domain.replace(/\.$/, '')
  
  // Validate format
  if (!domain || !/^[a-z0-9]([a-z0-9-]*[a-z0-9])?(\.[a-z0-9]([a-z0-9-]*[a-z0-9])?)*$/.test(domain)) {
    throw createError({ statusCode: 400, message: 'Ogiltigt domännamn.' })
  }
  
  // Check minimum length (must have at least one dot for a valid domain)
  if (!domain.includes('.')) {
    throw createError({ statusCode: 400, message: 'Domännamn måste innehålla minst en punkt (t.ex. example.com).' })
  }
  
  // Check against blocked domains
  if (BLOCKED_DOMAINS.includes(domain)) {
    throw createError({ statusCode: 400, message: 'Denna domän är reserverad och kan inte användas.' })
  }
  
  // Check against blocked TLD patterns
  for (const pattern of BLOCKED_TLD_PATTERNS) {
    if (pattern.test(domain)) {
      throw createError({ statusCode: 400, message: 'Domäner med denna TLD kan inte användas.' })
    }
  }
  
  return domain
}

/**
 * Generate a unique verification token for domain ownership verification
 */
export function generateDomainVerificationToken(): string {
  return createId()
}

/**
 * Build the expected TXT record name for verification
 */
export function buildVerificationRecordName(domain: string): string {
  return `_cloudportal-verify.${domain}`
}

/**
 * Build the expected TXT record value for verification
 */
export function buildVerificationRecordValue(token: string): string {
  return `cp-verify=${token}`
}

export interface DnsVerificationResult {
  verified: boolean
  error?: string
  foundRecords?: string[]
}

/**
 * Verify domain ownership by checking DNS TXT records
 */
export async function verifyDomainOwnership(
  domain: string,
  expectedToken: string
): Promise<DnsVerificationResult> {
  const recordName = buildVerificationRecordName(domain)
  const expectedValue = buildVerificationRecordValue(expectedToken)
  
  try {
    const records = await dns.resolveTxt(recordName)
    // TXT records are returned as arrays of strings (chunked)
    const flatRecords = records.map(chunks => chunks.join(''))
    
    const verified = flatRecords.some(record => record === expectedValue)
    
    return {
      verified,
      foundRecords: flatRecords,
      error: verified ? undefined : `Förväntad TXT-post "${expectedValue}" hittades inte.`
    }
  } catch (error: any) {
    if (error.code === 'ENOTFOUND' || error.code === 'ENODATA') {
      return {
        verified: false,
        error: `Ingen TXT-post hittades för ${recordName}. Kontrollera att DNS-posten är korrekt konfigurerad.`
      }
    }
    if (error.code === 'ETIMEOUT') {
      return {
        verified: false,
        error: 'DNS-frågan tog för lång tid. Försök igen senare.'
      }
    }
    return {
      verified: false,
      error: `DNS-fel: ${error.message}`
    }
  }
}

/**
 * Verification status types
 */
export type DomainVerificationStatus = 'unverified' | 'pending' | 'verifying' | 'verified' | 'failed'
