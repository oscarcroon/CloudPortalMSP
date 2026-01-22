/**
 * WindowsDnsRedirect Toast Notification Composable
 * Manages toast notifications for the redirects module
 */

interface WindowsDnsRedirectToast {
  id: string
  type: 'success' | 'error' | 'warning' | 'info'
  message: string
  timeout?: number
}

// Global reactive state for toasts
const toasts = ref<WindowsDnsRedirectToast[]>([])

// Counter for unique IDs
let toastCounter = 0

export function useWindowsDnsRedirectToast() {
  /**
   * Show a toast notification
   */
  function showToast(type: WindowsDnsRedirectToast['type'], message: string, timeout: number = 3000) {
    const id = `windows-dns-redirect-toast-${++toastCounter}`

    const toast: WindowsDnsRedirectToast = {
      id,
      type,
      message,
      timeout,
    }

    toasts.value.push(toast)

    // Auto-dismiss after timeout
    if (timeout > 0) {
      setTimeout(() => {
        removeToast(id)
      }, timeout)
    }

    return id
  }

  /**
   * Remove a specific toast
   */
  function removeToast(id: string) {
    const index = toasts.value.findIndex(t => t.id === id)
    if (index !== -1) {
      toasts.value.splice(index, 1)
    }
  }

  /**
   * Clear all toasts
   */
  function clearToasts() {
    toasts.value = []
  }

  // Convenience methods
  function success(message: string, timeout?: number) {
    return showToast('success', message, timeout)
  }

  function error(message: string, timeout?: number) {
    return showToast('error', message, timeout ?? 5000) // Errors show longer
  }

  function warning(message: string, timeout?: number) {
    return showToast('warning', message, timeout)
  }

  function info(message: string, timeout?: number) {
    return showToast('info', message, timeout)
  }

  return {
    toasts: readonly(toasts),
    showToast,
    removeToast,
    clearToasts,
    success,
    error,
    warning,
    info,
  }
}
