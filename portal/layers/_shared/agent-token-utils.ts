// Agent Token Utilities
//
// Wraps the core token utilities with a custom prefix scheme for agent tokens.
// Token format: msp_agent.<prefix>.<secret>

import {
  createApiToken as coreCreateApiToken,
  parseApiToken as coreParseApiToken,
  verifyApiToken as coreVerifyApiToken,
  type TokenCreateResult,
  type TokenParseResult
} from '~~/server/security/apiTokens/tokenUtils'

export const AGENT_TOKEN_PREFIX_SCHEME = 'msp_agent'

export interface AgentTokenCreateResult extends TokenCreateResult {
  /** Overridden plaintext with msp_agent prefix */
  plaintext: string
}

/**
 * Create a new agent token. Uses the same crypto as PAT tokens
 * but with the msp_agent prefix scheme.
 */
export async function createAgentToken(): Promise<AgentTokenCreateResult> {
  const result = await coreCreateApiToken()

  // Replace scheme prefix: msp_pat → msp_agent
  const plaintext = result.plaintext.replace(/^msp_pat\./, `${AGENT_TOKEN_PREFIX_SCHEME}.`)

  return {
    ...result,
    plaintext
  }
}

/**
 * Parse an agent token string into components.
 */
export function parseAgentToken(token: string): TokenParseResult | null {
  if (!token || !token.startsWith(`${AGENT_TOKEN_PREFIX_SCHEME}.`)) return null

  // Swap scheme to msp_pat so core parser recognises format
  const asPat = token.replace(`${AGENT_TOKEN_PREFIX_SCHEME}.`, 'msp_pat.')
  return coreParseApiToken(asPat)
}

/**
 * Verify an agent token secret against stored hash.
 */
export async function verifyAgentToken(
  secret: string,
  storedHash: string,
  salt: string,
  pepperKid: string
): Promise<boolean> {
  return coreVerifyApiToken(secret, storedHash, salt, pepperKid)
}

/**
 * Check if a token looks like an agent token.
 */
export function looksLikeAgentToken(token: string): boolean {
  return token.startsWith(`${AGENT_TOKEN_PREFIX_SCHEME}.`)
}
