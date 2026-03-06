/**
 * Nitro plugin that initializes the audit registry by loading audit modules
 * from all known layers.
 *
 * When adding a new layer with audit events, add its import here.
 */

export default async () => {
  try {
    // Import audit modules from layers
    // Each module self-registers when imported

    // Windows DNS layer
    try {
      await import('@windows-dns/server/audit.module')
      console.log('[audit-registry-init] Loaded windows-dns audit module')
    } catch (e) {
      // Layer may not be active
      console.log('[audit-registry-init] windows-dns audit module not available')
    }

    // Windows DNS Redirects layer
    try {
      await import('@windows-dns-redirects/server/audit.module')
      console.log('[audit-registry-init] Loaded windows-dns-redirects audit module')
    } catch (e) {
      // Layer may not be active
      console.log('[audit-registry-init] windows-dns-redirects audit module not available')
    }

    // Cloudflare DNS layer
    try {
      await import('@cloudflare-dns/server/audit.module')
      console.log('[audit-registry-init] Loaded cloudflare-dns audit module')
    } catch (e) {
      // Layer may not be active
      console.log('[audit-registry-init] cloudflare-dns audit module not available')
    }

    console.log('[audit-registry-init] Audit registry initialized')
  } catch (error) {
    console.error('[audit-registry-init] Failed to initialize audit registry', error)
  }
}
