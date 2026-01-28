import { z } from 'zod'
import { createId } from '@paralleldrive/cuid2'

/**
 * Sanitize string to prevent XSS
 * Note: Main XSS protection should be in frontend, this is a secondary layer
 */
export const sanitizeString = (value: string): string => {
  if (typeof value !== 'string') {
    return String(value)
  }
  
  // Remove potentially dangerous characters
  return value
    .replace(/[<>]/g, '') // Remove < and >
    .trim()
}

/**
 * Validate and normalize email
 */
export const validateEmail = (value: string): string => {
  const emailSchema = z.string().email()
  return emailSchema.parse(value.trim().toLowerCase())
}

/**
 * Validate ID format (CUID2)
 */
export const validateId = (value: string): string => {
  if (typeof value !== 'string' || value.length < 10 || value.length > 128) {
    throw new Error('Invalid ID format')
  }
  
  // Basic CUID2 validation (starts with letter, contains alphanumeric)
  if (!/^[a-z][a-z0-9]+$/i.test(value)) {
    throw new Error('Invalid ID format')
  }
  
  return value
}

/**
 * Sanitize object by removing dangerous fields
 * Only sanitizes top-level string values
 */
export const sanitizeObject = <T extends Record<string, any>>(value: T): T => {
  const sanitized = { ...value } as Record<string, any>
  
  for (const key of Object.keys(sanitized)) {
    if (typeof sanitized[key] === 'string') {
      sanitized[key] = sanitizeString(sanitized[key])
    } else if (typeof sanitized[key] === 'object' && sanitized[key] !== null && !Array.isArray(sanitized[key])) {
      sanitized[key] = sanitizeObject(sanitized[key])
    }
  }
  
  return sanitized as T
}

/**
 * Validate pagination parameters
 */
export interface PaginationParams {
  page?: number
  pageSize?: number
  maxPageSize?: number
}

export const validatePagination = (params: PaginationParams) => {
  const maxPageSize = params.maxPageSize || 100
  const page = Math.max(1, params.page || 1)
  const pageSize = Math.min(maxPageSize, Math.max(1, params.pageSize || 20))
  
  return {
    page,
    pageSize,
    offset: (page - 1) * pageSize
  }
}

/**
 * Zod schema helpers for common validations
 */
export const zodId = () => z.string().min(10).max(128).regex(/^[a-z][a-z0-9]+$/i, 'Invalid ID format')

export const zodEmail = () => z.string().email().transform(val => val.trim().toLowerCase())

export const zodSanitizedString = (maxLength?: number) => {
  let schema = z.string().trim()
  if (maxLength) {
    schema = schema.max(maxLength)
  }
  return schema.transform(val => sanitizeString(val))
}

export const zodPagination = () => z.object({
  page: z.coerce.number().int().min(1).default(1).optional(),
  pageSize: z.coerce.number().int().min(1).max(100).default(20).optional()
})

