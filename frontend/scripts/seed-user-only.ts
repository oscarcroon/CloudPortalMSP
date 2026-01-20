// @ts-nocheck
import { createId } from '@paralleldrive/cuid2'
import { eq } from 'drizzle-orm'
import { getDb, resetDbInstance } from '../server/utils/db'
import { users } from '../server/database/schema'
import { hashPassword } from '../server/utils/crypto'

// Konfiguration
const superAdminEmail = process.env.SEED_SUPERADMIN_EMAIL || 'owner@example.com'
const superAdminPassword = process.env.SEED_SUPERADMIN_PASSWORD || 'OwnerPass123!'
const superAdminName = process.env.SEED_SUPERADMIN_NAME || 'Cloud Portal Owner'

const seed = async () => {
  const db = getDb()
  const ownerPasswordHash = await hashPassword(superAdminPassword)

  console.log('🌱 Startar seed av användare...')

  try {
    // 1. Kontrollera om användaren redan finns
    const existing = db.select().from(users).where(eq(users.email, superAdminEmail)).limit(1).all()
    
    if (existing.length > 0) {
      console.log(`⚠️  Användare med email ${superAdminEmail} finns redan. Hoppar över.`)
      return
    }

    // 2. Skapa superadmin-användaren
    db.insert(users)
      .values({
        id: createId(),
        email: superAdminEmail,
        passwordHash: ownerPasswordHash,
        fullName: superAdminName,
        status: 'active',
        isSuperAdmin: 1,     // Sätter flaggan så att du kommer åt allt
        defaultOrgId: null,  // VIKTIGT: Null eftersom inga organisationer skapas här
        createdAt: new Date(),
        updatedAt: new Date()
      })
      .run()

    console.log(`✅ Användare skapad!`)
    console.log(`📧 Email: ${superAdminEmail}`)
    console.log(`🔑 Lösenord: ${superAdminPassword}`)

  } catch (error) {
    console.error('❌ Misslyckades med att skapa användare:', error)
    process.exitCode = 1
  } finally {
    resetDbInstance()
  }
}

seed()