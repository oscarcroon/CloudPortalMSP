import type { LoginBrandingContext } from '../utils/loginBrandingResolver'

declare module 'h3' {
  interface H3EventContext {
    loginBranding?: LoginBrandingContext
  }
}

