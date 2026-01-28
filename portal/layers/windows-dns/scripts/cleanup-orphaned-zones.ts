/**
 * Cleanup script to remove orphaned zones from windows_dns_allowed_zones table.
 * Run with: npx tsx frontend/layers/windows-dns/scripts/cleanup-orphaned-zones.ts
 */
import Database from 'better-sqlite3'
import { resolve, dirname } from 'path'
import { fileURLToPath } from 'url'

const __filename = fileURLToPath(import.meta.url)
const __dirname = dirname(__filename)

const dbPath = resolve(__dirname, '../../../.data/dev.db')
console.log('Using database:', dbPath)

const db = new Database(dbPath)

// Get all allowed zones
const allowedZones = db.prepare('SELECT id, zone_id, zone_name, organization_id FROM windows_dns_allowed_zones').all() as any[]
console.log(`Found ${allowedZones.length} allowed zones:`)
allowedZones.forEach(z => {
  console.log(`  - ${z.zone_name} (${z.zone_id})`)
})

// Zone IDs to remove (from the error logs)
const orphanedZoneIds = [
  '5f644161-de36-4b3c-b455-ee50a3434546',
  '7e96c32d-0d9a-47c3-9edd-d4e0de4bba7a', 
  'e58de20f-eae5-42ac-8cd1-3d8ce95f43e2'
]

console.log('\nRemoving orphaned zones...')

const deleteStmt = db.prepare('DELETE FROM windows_dns_allowed_zones WHERE zone_id = ?')
for (const zoneId of orphanedZoneIds) {
  const result = deleteStmt.run(zoneId)
  if (result.changes > 0) {
    console.log(`  ✓ Removed zone ${zoneId}`)
  } else {
    console.log(`  - Zone ${zoneId} not found (already removed)`)
  }
}

// Also check blocked zones
const deleteBlockedStmt = db.prepare('DELETE FROM windows_dns_blocked_zones WHERE zone_id = ?')
for (const zoneId of orphanedZoneIds) {
  const result = deleteBlockedStmt.run(zoneId)
  if (result.changes > 0) {
    console.log(`  ✓ Removed blocked zone ${zoneId}`)
  }
}

console.log('\nDone! Refresh the page to see the updated zone list.')
db.close()

