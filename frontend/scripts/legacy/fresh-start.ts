// @ts-nocheck
import fs from 'node:fs'
import path from 'node:path'
import Database from 'better-sqlite3'

const freshStart = async () => {
  console.log('🔄 Startar fresh start av databasen...')

  // 1. Ta bort databasfilen
  const dbPath = process.env.DATABASE_URL?.replace('file:', '') || '.data/dev.db'
  const absoluteDbPath = path.isAbsolute(dbPath) 
    ? dbPath 
    : path.resolve(process.cwd(), dbPath)

  if (fs.existsSync(absoluteDbPath)) {
    console.log('🗑️  Försöker ta bort befintlig databas...')
    try {
      fs.unlinkSync(absoluteDbPath)
      console.log('✅ Databasfilen har tagits bort')
    } catch (error: any) {
      if (error.code === 'EBUSY' || error.message.includes('being used')) {
        console.warn('⚠️  Databasfilen är låst av en annan process.')
        console.warn('   Fortsätter med att uppdatera journal-filen...')
        console.warn('   Du behöver manuellt ta bort databasen senare:')
        console.warn(`   Remove-Item "${absoluteDbPath}" -Force`)
      } else {
        throw error
      }
    }
  } else {
    console.log('ℹ️  Ingen befintlig databas hittades')
  }

  // 2. Läs alla migrationer från migrations-mappen
  const migrationsDir = path.resolve(process.cwd(), 'server/database/migrations')
  const migrationFiles = fs.readdirSync(migrationsDir)
    .filter(file => file.endsWith('.sql') && !file.startsWith('.'))
    .sort()

  console.log(`📋 Hittade ${migrationFiles.length} migrationsfiler`)

  // 3. Skapa journal-fil med alla migrationer markerade som körda
  const journalPath = path.resolve(process.cwd(), 'server/database/migrations/meta/_journal.json')
  const journalDir = path.dirname(journalPath)
  
  if (!fs.existsSync(journalDir)) {
    fs.mkdirSync(journalDir, { recursive: true })
  }

  const journalEntries = migrationFiles.map((file, idx) => {
    const tag = file.replace('.sql', '')
    return {
      breakpoints: true,
      when: Date.now() / 1000, // Unix timestamp
      tag: tag,
      version: "6",
      idx: idx
    }
  })

  const journal = {
    dialect: "sqlite",
    entries: journalEntries,
    version: "6"
  }

  fs.writeFileSync(journalPath, JSON.stringify(journal, null, 2))
  console.log('✅ Journal-fil har uppdaterats med alla migrationer')

  console.log('\n📝 Nästa steg:')
  console.log('   1. Kör: npm run db:push')
  console.log('      Detta skapar alla tabeller baserat på schemat')
  console.log('   2. Kör: npm run seed:user (om du vill seeda en användare)')
  console.log('\n✅ Fresh start klar! Du kan nu köra db:push för att skapa alla tabeller.')
}

freshStart().catch((error) => {
  console.error('❌ Misslyckades:', error)
  process.exitCode = 1
})

