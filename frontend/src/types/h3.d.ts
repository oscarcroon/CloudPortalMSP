import 'h3'
import type { AuthState } from '~/server/types/auth'

declare module 'h3' {
  interface H3EventContext {
    auth?: AuthState | null
  }
}

