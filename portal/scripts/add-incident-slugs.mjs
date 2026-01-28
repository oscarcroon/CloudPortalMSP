/**
 * Migration script to add slug column to tenant_incidents table
 */
import Database from 'better-sqlite3'

const db = new Database('./cloudmsp.db')

console.log('Adding slug column to tenant_incidents...')

// Add slug column if it doesn't exist
try {
  db.exec('ALTER TABLE tenant_incidents ADD COLUMN slug TEXT')
  console.log('✓ Added slug column')
} catch (e) {
  if (e.message.includes('duplicate column')) {
    console.log('✓ Slug column already exists')
  } else {
    console.error('Error adding column:', e.message)
  }
}

// Create index
try {
  db.exec('CREATE INDEX IF NOT EXISTS tenant_incidents_slug_idx ON tenant_incidents(source_tenant_id, slug)')
  console.log('✓ Created index')
} catch (e) {
  console.log('Index note:', e.message)
}

// Generate slugs for existing incidents
function generateSlug(title) {
  return title
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9åäöæøü]+/gi, '-')
    .replace(/[åäàáâã]/g, 'a')
    .replace(/[öøòóô]/g, 'o')
    .replace(/[æ]/g, 'ae')
    .replace(/[ü]/g, 'u')
    .replace(/^-|-$/g, '')
    .slice(0, 100)
}

// Get all incidents without slugs
const incidents = db.prepare("SELECT id, title, source_tenant_id, slug FROM tenant_incidents WHERE slug IS NULL OR slug = ''").all()
console.log(`Found ${incidents.length} incidents without slugs`)

const updateStmt = db.prepare('UPDATE tenant_incidents SET slug = ? WHERE id = ?')
const checkSlug = db.prepare('SELECT id FROM tenant_incidents WHERE source_tenant_id = ? AND slug = ? AND id != ?')

for (const incident of incidents) {
  let slug = generateSlug(incident.title)
  let suffix = 0
  let finalSlug = slug
  
  // Handle collisions
  while (checkSlug.get(incident.source_tenant_id, finalSlug, incident.id)) {
    suffix++
    finalSlug = `${slug}-${suffix}`
  }
  
  updateStmt.run(finalSlug, incident.id)
  console.log(`  Updated: ${incident.id} -> ${finalSlug}`)
}

// Set fallback for any remaining null slugs
db.exec("UPDATE tenant_incidents SET slug = id WHERE slug IS NULL OR slug = ''")

// Show final state
const rows = db.prepare('SELECT id, title, slug FROM tenant_incidents LIMIT 10').all()
console.log('\nCurrent incidents:')
for (const row of rows) {
  console.log(`  ${row.id}: ${row.title} -> ${row.slug}`)
}

console.log('\n✓ Migration complete!')

