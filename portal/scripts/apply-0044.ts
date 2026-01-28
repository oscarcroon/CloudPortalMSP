import Database from 'better-sqlite3'

const dbPath = process.env.DATABASE_URL?.replace('file:', '') || '.data/dev.db'
console.log('Database:', dbPath)

const db = new Database(dbPath)

try {
  console.log('Adding template support columns to msp_roles...\n')
  
  db.exec(`ALTER TABLE msp_roles ADD COLUMN role_kind text NOT NULL DEFAULT 'role'`)
  console.log('✓ Added role_kind')
  
  db.exec(`ALTER TABLE msp_roles ADD COLUMN source_template_id text REFERENCES msp_roles(id) ON DELETE SET NULL`)
  console.log('✓ Added source_template_id')
  
  db.exec(`ALTER TABLE msp_roles ADD COLUMN published_at integer`)
  console.log('✓ Added published_at')
  
  db.exec(`ALTER TABLE msp_roles ADD COLUMN template_version integer NOT NULL DEFAULT 1`)
  console.log('✓ Added template_version')
  
  db.exec(`ALTER TABLE msp_roles ADD COLUMN source_template_version integer`)
  console.log('✓ Added source_template_version')
  
  db.exec(`ALTER TABLE msp_roles ADD COLUMN last_synced_at integer`)
  console.log('✓ Added last_synced_at')
  
  db.exec(`ALTER TABLE msp_roles ADD COLUMN permissions_fingerprint text`)
  console.log('✓ Added permissions_fingerprint')
  
  db.exec(`CREATE INDEX IF NOT EXISTS msp_roles_kind_tenant_idx ON msp_roles (tenant_id, role_kind)`)
  console.log('✓ Created index msp_roles_kind_tenant_idx')
  
  db.exec(`CREATE INDEX IF NOT EXISTS msp_roles_source_template_idx ON msp_roles (source_template_id)`)
  console.log('✓ Created index msp_roles_source_template_idx')
  
  console.log('\n✅ Migration 0044 complete!')
  
  const cols = db.pragma('table_info(msp_roles)') as Array<{ name: string }>
  console.log('\nUpdated columns:', cols.map(c => c.name).join(', '))
} catch (err: any) {
  if (err.message?.includes('duplicate column')) {
    console.log('Column already exists, skipping...')
  } else {
    console.error('Error:', err.message)
  }
}

db.close()
