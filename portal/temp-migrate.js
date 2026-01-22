const Database = require('better-sqlite3');
const db = new Database('.data/dev.db');

try {
  // Add the host column
  db.exec("ALTER TABLE windows_dns_redirects ADD COLUMN host text DEFAULT '' NOT NULL");
  console.log('Added host column');
} catch (e) {
  if (e.message.includes('duplicate column name')) {
    console.log('Column already exists');
  } else {
    throw e;
  }
}

// Create the indexes
try {
  db.exec("CREATE INDEX IF NOT EXISTS windows_dns_redirects_org_zone_host_idx ON windows_dns_redirects (organization_id, zone_id, host)");
  console.log('Created index windows_dns_redirects_org_zone_host_idx');
} catch (e) {
  console.log('Index error:', e.message);
}

try {
  db.exec("CREATE UNIQUE INDEX IF NOT EXISTS windows_dns_redirects_unique_host_path ON windows_dns_redirects (organization_id, zone_id, host, source_path)");
  console.log('Created unique index windows_dns_redirects_unique_host_path');
} catch (e) {
  console.log('Unique index error:', e.message);
}

// Create the managed records table
try {
  db.exec(`
    CREATE TABLE IF NOT EXISTS windows_dns_managed_records (
      id text PRIMARY KEY NOT NULL,
      zone_id text NOT NULL,
      record_key text NOT NULL,
      managed_by text NOT NULL,
      managed_id text,
      last_applied_by_user_id text,
      last_applied_at integer,
      created_at integer DEFAULT (strftime('%s', 'now')) NOT NULL,
      updated_at integer DEFAULT (strftime('%s', 'now')) NOT NULL
    )
  `);
  console.log('Created windows_dns_managed_records table');
} catch (e) {
  console.log('Table error:', e.message);
}

// Create indexes for managed records table
try {
  db.exec("CREATE INDEX IF NOT EXISTS windows_dns_managed_records_zone_id_idx ON windows_dns_managed_records (zone_id)");
  db.exec("CREATE INDEX IF NOT EXISTS windows_dns_managed_records_managed_id_idx ON windows_dns_managed_records (managed_id)");
  db.exec("CREATE INDEX IF NOT EXISTS windows_dns_managed_records_zone_manager_idx ON windows_dns_managed_records (zone_id, managed_by)");
  db.exec("CREATE UNIQUE INDEX IF NOT EXISTS windows_dns_managed_records_unique ON windows_dns_managed_records (zone_id, record_key, managed_by)");
  console.log('Created managed records indexes');
} catch (e) {
  console.log('Managed records index error:', e.message);
}

// Update the drizzle migrations table
try {
  db.exec("INSERT INTO __drizzle_migrations (hash, created_at) VALUES ('0059_mature_terrax', " + Date.now() + ")");
  console.log('Marked migration 0059 as applied');
} catch (e) {
  console.log('Migration marker error:', e.message);
}

// Verify
const info = db.prepare('PRAGMA table_info(windows_dns_redirects)').all();
console.log('\nwindows_dns_redirects columns:', info.map(c => c.name).join(', '));

db.close();
