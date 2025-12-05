/* eslint-env node */
const Database = require('better-sqlite3');
const fs = require('fs');
const path = require('path');

const dbPath = path.resolve(__dirname, '.data/dev.db');
const db = new Database(dbPath);

// Read the migration file
const migrationPath = path.resolve(__dirname, 'server/database/migrations/0017_module_role_overrides.sql');
const migrationSQL = fs.readFileSync(migrationPath, 'utf-8');

// Split by statement breakpoints and execute each statement separately
const statements = migrationSQL
  .split('--> statement-breakpoint')
  .map(s => s.trim())
  .filter(s => s.length > 0 && !s.startsWith('--'));

console.log(`Executing ${statements.length} statements...`);

for (let i = 0; i < statements.length; i++) {
  const stmt = statements[i].trim();
  if (!stmt) continue;
  
  try {
    console.log(`Executing statement ${i + 1}...`);
    db.exec(stmt);
    console.log(`✓ Statement ${i + 1} completed`);
  } catch (error) {
    // Check if it's a "table already exists" error, which is OK
    if (error.message.includes('already exists')) {
      console.log(`⚠ Statement ${i + 1} skipped (already exists)`);
    } else {
      console.error(`✗ Statement ${i + 1} failed:`, error.message);
      throw error;
    }
  }
}

// Check if tables exist
const roleMappingsExists = db.prepare("SELECT name FROM sqlite_master WHERE type='table' AND name='role_module_role_mappings'").get();
const overridesExists = db.prepare("SELECT name FROM sqlite_master WHERE type='table' AND name='member_module_role_overrides'").get();

console.log('\nVerification:');
console.log(`role_module_role_mappings: ${roleMappingsExists ? '✓' : '✗'}`);
console.log(`member_module_role_overrides: ${overridesExists ? '✓' : '✗'}`);

db.close();
console.log('\nMigration fix completed!');

