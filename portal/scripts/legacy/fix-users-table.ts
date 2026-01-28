// @ts-nocheck
import Database from 'better-sqlite3'
import { getDb, resetDbInstance } from '../server/utils/db'

const fixUsersTable = async () => {
  const dbPath = process.env.DATABASE_URL?.replace('file:', '') || '.data/dev.db'
  const sqlite = new Database(dbPath)

  console.log('🔧 Kontrollerar users-tabellen och lägger till saknade kolumner...')

  try {
    // Hämta alla kolumner i users-tabellen
    const tableInfo = sqlite.prepare("PRAGMA table_info(users)").all()
    const existingColumns = new Set(tableInfo.map((col: any) => col.name))

    // Lista över kolumner som ska finnas (baserat på schema)
    const requiredColumns = [
      { name: 'locale', sql: "ALTER TABLE users ADD COLUMN locale TEXT NOT NULL DEFAULT 'sv'" },
      { name: 'password_reset_token_hash', sql: 'ALTER TABLE users ADD COLUMN password_reset_token_hash text' },
      { name: 'password_reset_expires_at', sql: 'ALTER TABLE users ADD COLUMN password_reset_expires_at integer' },
    ]

    let addedCount = 0
    for (const col of requiredColumns) {
      if (!existingColumns.has(col.name)) {
        console.log(`➕ Lägger till kolumn: ${col.name}`)
        try {
          sqlite.exec(col.sql)
          addedCount++
        } catch (error: any) {
          if (error.message.includes('duplicate column')) {
            console.log(`⚠️  Kolumn ${col.name} finns redan (trots kontroll)`)
          } else {
            console.error(`❌ Misslyckades med att lägga till ${col.name}:`, error.message)
          }
        }
      } else {
        console.log(`✅ Kolumn ${col.name} finns redan`)
      }
    }

    if (addedCount > 0) {
      console.log(`✅ ${addedCount} kolumn(er) har lagts till!`)
    } else {
      console.log('✅ Alla kolumner finns redan!')
    }
  } catch (error: any) {
    console.error('❌ Misslyckades:', error)
    process.exitCode = 1
  } finally {
    sqlite.close()
    resetDbInstance()
  }
}

fixUsersTable()

