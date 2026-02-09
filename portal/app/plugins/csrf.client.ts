export default defineNuxtPlugin(() => {
  const STATE_CHANGING_METHODS = new Set(['POST', 'PUT', 'DELETE', 'PATCH', 'post', 'put', 'delete', 'patch'])

  const readCsrfCookie = (): string | undefined => {
    const match = document.cookie.match(/(?:^|;\s*)csrf_token=([^;]*)/)
    return match?.[1] ? decodeURIComponent(match[1]) : undefined
  }

  const original$fetch = globalThis.$fetch

  globalThis.$fetch = new Proxy(original$fetch, {
    apply(target, thisArg, args: [string, Record<string, any>?]) {
      const [url, opts = {}] = args
      const method = (opts.method || 'GET').toString()

      if (STATE_CHANGING_METHODS.has(method)) {
        const csrfToken = readCsrfCookie()
        if (csrfToken) {
          opts.headers = {
            ...(opts.headers || {}),
            'X-CSRF-Token': csrfToken
          }
        }
      }

      return Reflect.apply(target, thisArg, [url, opts])
    },
    get(target, prop, receiver) {
      return Reflect.get(target, prop, receiver)
    }
  }) as typeof $fetch
})
