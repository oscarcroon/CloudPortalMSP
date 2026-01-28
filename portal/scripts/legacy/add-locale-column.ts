// @ts-nocheck
import Database from 'better-sqlite3'
import { getDb, resetDbInstance } from '../server/utils/db'

const addLocaleColumn = async () => {
  const dbPath = process.env.DATABASE_URL?.replace('file:', '') || '.data/dev.db'
  const sqlite = new Database(dbPath)

  console.log('🔧 Kontrollerar om locale-kolumnen finns...')

  try {
    // Kontrollera om locale-kolumnen redan finns
    const tableInfo = sqlite.prepare("PRAGMA table_info(users)").all()
    const hasLocale = tableInfo.some((col: any) => col.name === 'locale')

    if (hasLocale) {
      console.log('✅ locale-kolumnen finns redan. Inget att göra.')
      return
    }

    console.log('➕ Lägger till locale-kolumn...')
    sqlite.exec(`
      ALTER TABLE users ADD COLUMN locale TEXT NOT NULL DEFAULT 'sv';
      UPDATE users SET locale = 'sv' WHERE locale IS NULL OR locale = '';
    `)

    console.log('✅ locale-kolumnen har lagts till!')
  } catch (error: any) {
    if (error.message.includes('duplicate column')) {
      console.log('✅ locale-kolumnen finns redan.')
    } else {
      console.error('❌ Misslyckades med att lägga till locale-kolumn:', error)
      process.exitCode = 1
    }
  } finally {
    sqlite.close()
    resetDbInstance()
  }
}

addLocaleColumn()

