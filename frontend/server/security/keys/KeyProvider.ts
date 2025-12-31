/**
 * KeyProvider Interface
 *
 * Abstraction for retrieving cryptographic keys/peppers for token hashing.
 * This allows switching from environment variables to Azure Key Vault
 * or other secret management systems without changing the token verification code.
 */

export interface PepperInfo {
  /** Key identifier */
  kid: string
  /** The actual pepper secret */
  secret: string
}

export interface KeyProvider {
  /**
   * Get the current pepper for minting new tokens.
   * Returns the kid and secret.
   */
  getCurrentPepper(): Promise<PepperInfo>

  /**
   * Get all peppers for verification (current + legacy).
   * Used when verifying tokens - we try current first, then legacy.
   * @param kid - Optional specific kid to fetch. If not provided, returns all.
   */
  getAllPeppersForVerification(kid?: string): Promise<PepperInfo[]>
}

/**
 * Default Key ID used when none is configured
 */
export const DEFAULT_PEPPER_KID = 'env-v1'

