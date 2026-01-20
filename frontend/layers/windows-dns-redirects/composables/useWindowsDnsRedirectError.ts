/**
 * WindowsDnsRedirect Error Handling Composable
 * Provides utilities for handling and displaying user-friendly network errors
 */

export type WindowsDnsRedirectErrorType = 'network' | 'server' | 'validation' | 'generic'

export interface WindowsDnsRedirectNetworkError {
  type: WindowsDnsRedirectErrorType
  title: string
  message: string
  canRetry: boolean
}

/**
 * Extracts error message from various error formats
 */
export function extractWindowsDnsRedirectErrorMessage(error: any): string | null {
  // Check for statusMessage (Nuxt/H3 errors)
  if (error?.statusMessage) {
    return error.statusMessage
  }

  // Check for data.message from API response
  if (error?.data?.message) {
    return error.data.message
  }

  // Check for response body message
  if (error?.response?._data?.message) {
    return error.response._data.message
  }

  // Check if statusMessage is in message (FetchError wraps it)
  const messageMatch = error?.message?.match(/\d{3}\s+(.+)$/)
  if (messageMatch) {
    return messageMatch[1]
  }

  return null
}

/**
 * Determines the error type from an error object
 * Hides technical details from users
 */
export function getWindowsDnsRedirectErrorType(error: any): WindowsDnsRedirectErrorType {
  // Get status code from various error formats
  const statusCode = error?.statusCode || error?.status || error?.response?.status

  // 4xx client errors (validation, duplicates, etc.) - show user message
  if (statusCode >= 400 && statusCode < 500) {
    return 'validation'
  }

  // Server errors (5xx status codes)
  if (statusCode >= 500) {
    return 'server'
  }

  // Network errors (no connection, timeout, etc.)
  // Only classify as network error if no status code (true network failure)
  if (!statusCode && (
      error?.cause?.code === 'ECONNREFUSED' ||
      error?.cause?.code === 'ENOTFOUND' ||
      error?.cause?.code === 'ETIMEDOUT' ||
      error?.message?.includes('Failed to fetch') ||
      error?.message?.includes('NetworkError'))) {
    return 'network'
  }

  // Default to generic error
  return 'generic'
}

/**
 * Composable for handling network errors with i18n support
 */
export function useWindowsDnsRedirectError() {
  const { t } = useI18n()

  /**
   * Parse an error and return a user-friendly error object
   */
  function parseError(error: any): WindowsDnsRedirectNetworkError {
    const type = getWindowsDnsRedirectErrorType(error)

    // For validation errors (4xx), try to extract the server's error message
    if (type === 'validation') {
      const serverMessage = extractWindowsDnsRedirectErrorMessage(error)
      if (serverMessage) {
        return {
          type,
          title: t('windowsDns.redirects.errors.validation.title'),
          message: serverMessage,
          canRetry: false, // Validation errors won't succeed on retry without changes
        }
      }
    }

    return {
      type,
      title: t(`windowsDns.redirects.errors.${type}.title`),
      message: t(`windowsDns.redirects.errors.${type}.message`),
      canRetry: type !== 'validation', // Validation errors shouldn't auto-retry
    }
  }

  /**
   * Get the retry button text for an error type
   */
  function getRetryText(type: WindowsDnsRedirectErrorType = 'generic'): string {
    return t(`windowsDns.redirects.errors.${type}.retry`)
  }

  /**
   * Get specific error message for save operations
   */
  function getSaveErrorMessage(): string {
    return t('windowsDns.redirects.errors.network.save_failed')
  }

  /**
   * Get specific error message for load operations
   */
  function getLoadErrorMessage(): string {
    return t('windowsDns.redirects.errors.network.load_failed')
  }

  /**
   * Get specific error message for delete operations
   */
  function getDeleteErrorMessage(): string {
    return t('windowsDns.redirects.errors.network.delete_failed')
  }

  return {
    parseError,
    getRetryText,
    getSaveErrorMessage,
    getLoadErrorMessage,
    getDeleteErrorMessage,
    getErrorType: getWindowsDnsRedirectErrorType,
    extractErrorMessage: extractWindowsDnsRedirectErrorMessage,
  }
}
