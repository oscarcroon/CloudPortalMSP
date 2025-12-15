import { createId } from '@paralleldrive/cuid2'
import { eq } from 'drizzle-orm'
import { getDb, resetDbInstance } from '../server/utils/db'
import { dnsRecords, dnsZones, organizations } from '../server/database/schema'

/**
 * Generates a domain name based on organization slug
 */
function generateDomainName(slug: string, index: number = 0): string {
  const cleanSlug = slug.replace(/[^a-z0-9-]/g, '')
  const domains = [
    `${cleanSlug}.example.com`,
    `${cleanSlug}.test.se`,
    `app-${cleanSlug}.com`,
    `www.${cleanSlug}.se`
  ]
  return domains[index % domains.length]
}

/**
 * Creates mock DNS records for a zone
 */
function createMockRecords(zoneId: string, orgId: string, zoneName: string) {
  const records = []

  // Root A record
  records.push({
    id: createId(),
    zoneId,
    organizationId: orgId,
    type: 'A',
    name: zoneName,
    content: `192.0.2.${Math.floor(Math.random() * 254) + 1}`,
    ttl: 3600,
    proxied: 1
  })

  // www CNAME
  records.push({
    id: createId(),
    zoneId,
    organizationId: orgId,
    type: 'CNAME',
    name: 'www',
    content: zoneName,
    ttl: 300,
    proxied: 0
  })

  // mail MX
  records.push({
    id: createId(),
    zoneId,
    organizationId: orgId,
    type: 'MX',
    name: zoneName,
    content: `10 mail.${zoneName}`,
    ttl: 3600,
    proxied: 0
  })

  // SPF TXT
  records.push({
    id: createId(),
    zoneId,
    organizationId: orgId,
    type: 'TXT',
    name: zoneName,
    content: '"v=spf1 include:_spf.google.com ~all"',
    ttl: 1800,
    proxied: 0
  })

  // DMARC TXT
  records.push({
    id: createId(),
    zoneId,
    organizationId: orgId,
    type: 'TXT',
    name: '_dmarc',
    content: '"v=DMARC1; p=none; rua=mailto:dmarc@example.com"',
    ttl: 3600,
    proxied: 0
  })

  // API subdomain A record
  records.push({
    id: createId(),
    zoneId,
    organizationId: orgId,
    type: 'A',
    name: 'api',
    content: `198.51.100.${Math.floor(Math.random() * 254) + 1}`,
    ttl: 300,
    proxied: 0
  })

  return records
}

async function seedDnsData() {
  const db = getDb()

  console.log('🔍 Fetching all organizations...')
  const allOrgs = await db.select().from(organizations)
  
  if (allOrgs.length === 0) {
    console.log('⚠️  No organizations found. Please seed organizations first.')
    return
  }

  console.log(`📦 Found ${allOrgs.length} organization(s)`)

  // Check existing zones for all organizations (outside transaction)
  const orgsWithZones = new Set<string>()
  for (const org of allOrgs) {
    const existingZones = await db
      .select()
      .from(dnsZones)
      .where(eq(dnsZones.organizationId, org.id))
    
    if (existingZones.length > 0) {
      console.log(`⏭️  Skipping ${org.name} - already has ${existingZones.length} zone(s)`)
      orgsWithZones.add(org.id)
    }
  }

  // Prepare all data outside transaction
  const zonesToInsert = []
  const recordsToInsert = []

  for (const org of allOrgs) {
    if (orgsWithZones.has(org.id)) {
      continue
    }

    // Create 1-2 zones per organization
    const numZones = Math.random() > 0.5 ? 2 : 1
    
    for (let i = 0; i < numZones; i++) {
      const zoneName = generateDomainName(org.slug, i)
      const zoneId = createId()

      zonesToInsert.push({
        id: zoneId,
        organizationId: org.id,
        name: zoneName,
        status: 'active',
        provider: 'cloudflare',
        accountId: `acc-${org.slug}`
      })

      // Create records for this zone
      const zoneRecords = createMockRecords(zoneId, org.id, zoneName)
      recordsToInsert.push(...zoneRecords)

      console.log(`✅ Created zone "${zoneName}" for ${org.name} with ${zoneRecords.length} records`)
    }
  }

  // Execute transaction synchronously
  if (zonesToInsert.length > 0 || recordsToInsert.length > 0) {
    db.transaction((tx) => {
      if (zonesToInsert.length > 0) {
        tx.insert(dnsZones).values(zonesToInsert).run()
        console.log(`\n📝 Inserted ${zonesToInsert.length} DNS zone(s)`)
      }

      if (recordsToInsert.length > 0) {
        tx.insert(dnsRecords).values(recordsToInsert).run()
        console.log(`📝 Inserted ${recordsToInsert.length} DNS record(s)`)
      }
    })()
  }

  console.log('\n✨ DNS data seeding completed!')
}

seedDnsData()
  .catch((error) => {
    console.error('❌ Failed to seed DNS data:', error)
    process.exitCode = 1
  })
  .finally(() => {
    resetDbInstance()
  })
