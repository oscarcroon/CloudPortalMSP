/**
 * Reset Windows DNS configuration for an organization.
 * This clears the accountId so it can be re-created.
 * 
 * Usage: npx tsx scripts/reset-windows-dns-config.ts <orgId>
 * Or to reset all: npx tsx scripts/reset-windows-dns-config.ts --all
 */

import path from 'node:path'
import Database from 'better-sqlite3'
import { fileURLToPath } from 'node:url'

const __filename = fileURLToPath(import.meta.url)
const scriptDir = path.dirname(__filename)
const repoRoot = path.resolve(scriptDir, '..')
const dbPath = path.resolve(repoRoot, '.data', 'dev.db')

const db = new Database(dbPath)

const args = process.argv.slice(2)

if (args.length === 0) {
  console.log('Usage:')
  console.log('  npx tsx scripts/reset-windows-dns-config.ts <orgId>')
  console.log('  npx tsx scripts/reset-windows-dns-config.ts --all')
  console.log('')
  console.log('This clears the Windows DNS account binding so it can be re-created.')
  process.exit(1)
}

if (args[0] === '--all') {
  // Reset all configs
  const configs = db.prepare('SELECT id, organization_id, windows_dns_account_id FROM windows_dns_org_config').all() as Array<{ id: string; organization_id: string; windows_dns_account_id: string | null }>
  
  if (configs.length === 0) {
    console.log('No Windows DNS configurations found.')
    process.exit(0)
  }

  console.log(`Found ${configs.length} configurations:`)
  for (const config of configs) {
    console.log(`  - Org ${config.organization_id}: accountId=${config.windows_dns_account_id || '(none)'}`)
  }

  // Clear all accountIds
  const result = db.prepare('UPDATE windows_dns_org_config SET windows_dns_account_id = NULL, updated_at = ?').run(Date.now())
  console.log(`\n✓ Reset ${result.changes} configurations`)

  // Also clear allowed zones
  const zonesResult = db.prepare('DELETE FROM windows_dns_allowed_zones').run()
  console.log(`✓ Cleared ${zonesResult.changes} allowed zones`)

  // Clear last discovery
  const discoveryResult = db.prepare('DELETE FROM windows_dns_last_discovery').run()
  console.log(`✓ Cleared ${discoveryResult.changes} discovery records`)
} else {
  const orgId = args[0]
  
  // Find config for org
  const config = db.prepare('SELECT id, organization_id, windows_dns_account_id FROM windows_dns_org_config WHERE organization_id = ?').get(orgId) as { id: string; organization_id: string; windows_dns_account_id: string | null } | undefined
  
  if (!config) {
    console.log(`No Windows DNS configuration found for org ${orgId}`)
    
    // Check if org exists
    const org = db.prepare('SELECT id, name, core_id FROM organizations WHERE id = ?').get(orgId) as { id: string; name: string; core_id: string | null } | undefined
    if (!org) {
      console.log(`Organization ${orgId} does not exist.`)
    } else {
      console.log(`Organization exists: ${org.name} (coreId: ${org.core_id || 'not set'})`)
    }
    process.exit(1)
  }

  console.log(`Found config for org ${orgId}:`)
  console.log(`  - Config ID: ${config.id}`)
  console.log(`  - Account ID: ${config.windows_dns_account_id || '(none)'}`)

  // Clear accountId
  db.prepare('UPDATE windows_dns_org_config SET windows_dns_account_id = NULL, updated_at = ? WHERE id = ?').run(Date.now(), config.id)
  console.log(`\n✓ Reset configuration for org ${orgId}`)

  // Also clear allowed zones for this org
  const zonesResult = db.prepare('DELETE FROM windows_dns_allowed_zones WHERE organization_id = ?').run(orgId)
  console.log(`✓ Cleared ${zonesResult.changes} allowed zones`)

  // Clear last discovery for this org
  const discoveryResult = db.prepare('DELETE FROM windows_dns_last_discovery WHERE organization_id = ?').run(orgId)
  console.log(`✓ Cleared ${discoveryResult.changes} discovery records`)
}

db.close()
console.log('\nDone. Please try autodiscover again.')


