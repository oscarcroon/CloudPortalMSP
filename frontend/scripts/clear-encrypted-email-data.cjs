/**
 * Script för att rensa gammal krypterad e-postkonfiguration
 * 
 * Detta script tar bort alla e-postkonfigurationer som inte kan dekrypteras
 * med den nuvarande EMAIL_CRYPTO_KEY.
 * 
 * Användning:
 *   node scripts/clear-encrypted-email-data.cjs
 */

require('dotenv/config')
const Database = require('better-sqlite3')
const path = require('path')
const crypto = require('node:crypto')

const dbPath = process.env.DATABASE_URL?.replace('file:', '') || path.resolve(__dirname, '../.data/dev.db')
const cryptoKey = process.env.EMAIL_CRYPTO_KEY

if (!cryptoKey) {
  console.error('❌ EMAIL_CRYPTO_KEY saknas i miljövariablerna.')
  console.error('   Sätt EMAIL_CRYPTO_KEY i din .env-fil innan du kör detta script.')
  process.exit(1)
}

console.log('🔍 Kontrollerar krypterad e-postkonfiguration...')
console.log(`📁 Databas: ${dbPath}`)
console.log(`🔑 Använder EMAIL_CRYPTO_KEY: ${cryptoKey.substring(0, 8)}...`)

const db = new Database(dbPath)

// Hämta alla e-postkonfigurationer
const records = db.prepare(`
  SELECT 
    target_key,
    target_type,
    from_email,
    encrypted_config,
    encryption_iv,
    encryption_auth_tag
  FROM email_provider_profiles
  WHERE encrypted_config IS NOT NULL
`).all()

console.log(`\n📊 Hittade ${records.length} krypterade konfigurationer\n`)

// Dekrypteringsfunktion (samma som i email-kit)
function decryptConfig(payload, secret) {
  const ALGORITHM = 'aes-256-gcm'
  
  // Resolve key (samma logik som i email-kit)
  const trimmed = secret?.trim()
  if (!trimmed) {
    throw new Error('Missing EMAIL_CRYPTO_KEY.')
  }
  
  let key
  const HEX_64 = /^[a-f0-9]{64}$/i
  if (HEX_64.test(trimmed)) {
    key = Buffer.from(trimmed, 'hex')
  } else {
    try {
      key = Buffer.from(trimmed, 'base64')
    } catch {
      key = Buffer.from(trimmed, 'utf8')
    }
  }
  
  if (key.length !== 32) {
    throw new Error('EMAIL_CRYPTO_KEY must resolve to 32 bytes (256 bits).')
  }
  
  // Decrypt
  const decipher = crypto.createDecipheriv(ALGORITHM, key, Buffer.from(payload.iv, 'base64'))
  decipher.setAuthTag(Buffer.from(payload.authTag, 'base64'))
  const decrypted = Buffer.concat([
    decipher.update(Buffer.from(payload.cipherText, 'base64')),
    decipher.final()
  ])
  return JSON.parse(decrypted.toString('utf8'))
}

let validCount = 0
let invalidCount = 0
const invalidRecords = []

for (const record of records) {
  try {
    const payload = {
      cipherText: record.encrypted_config,
      iv: record.encryption_iv,
      authTag: record.encryption_auth_tag
    }
    decryptConfig(payload, cryptoKey)
    validCount++
    console.log(`✓ ${record.target_type}:${record.target_key} - OK`)
  } catch (error) {
    invalidCount++
    invalidRecords.push(record)
    console.log(`✗ ${record.target_type}:${record.target_key} - Kan inte dekrypteras`)
  }
}

console.log(`\n📈 Sammanfattning:`)
console.log(`   ✓ Giltiga: ${validCount}`)
console.log(`   ✗ Ogiltiga: ${invalidCount}`)

if (invalidRecords.length === 0) {
  console.log('\n✅ Alla konfigurationer kan dekrypteras. Inget att rensa.')
  db.close()
  process.exit(0)
}

console.log(`\n⚠️  ${invalidRecords.length} konfigurationer kan inte dekrypteras.`)
console.log('\nFöljande konfigurationer kommer att raderas:')
invalidRecords.forEach(record => {
  console.log(`   - ${record.target_type}:${record.target_key} (${record.from_email || 'ingen e-post'})`)
})

// Fråga om bekräftelse
const readline = require('readline')
const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout
})

rl.question('\nVill du fortsätta och radera dessa konfigurationer? (ja/nej): ', (answer) => {
  if (answer.toLowerCase() !== 'ja' && answer.toLowerCase() !== 'j' && answer.toLowerCase() !== 'yes' && answer.toLowerCase() !== 'y') {
    console.log('\n❌ Avbrutet. Inga ändringar gjorda.')
    rl.close()
    db.close()
    process.exit(0)
  }

  console.log('\n🗑️  Raderar ogiltiga konfigurationer...')
  
  const deleteStmt = db.prepare(`
    DELETE FROM email_provider_profiles
    WHERE target_key = ?
  `)

  const deleteMany = db.transaction((records) => {
    for (const record of records) {
      deleteStmt.run(record.target_key)
    }
  })

  deleteMany(invalidRecords)

  console.log(`✅ ${invalidRecords.length} konfigurationer raderade.`)
  console.log('\n💡 Du kan nu konfigurera e-postinställningarna på nytt i admin-gränssnittet.')
  
  rl.close()
  db.close()
  process.exit(0)
})

