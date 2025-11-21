import 'h3'
import type { AuthState } from '~/server/types/auth'

declare module 'h3' {
  interface H3EventContext {
    colorMode?: {
      preference: 'system' | 'light' | 'dark'
      resolved: 'light' | 'dark'
    }
    auth?: AuthState | null
  }
}

