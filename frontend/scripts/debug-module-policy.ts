import { getDb } from '../src/server/utils/db'
import { getEffectiveModulePolicyForOrg } from '../src/server/utils/modulePolicy'
import { organizations } from '../src/server/database/schema'
import { eq } from 'drizzle-orm'

async function debugModulePolicy() {
  const db = getDb()
  
  // Find Blomsterlandet organization
  const [org] = await db
    .select()
    .from(organizations)
    .where(eq(organizations.id, 'org-coreit'))
  
  if (!org) {
    console.log('Organization not found')
    return
  }
  
  console.log(`Debugging module policy for: ${org.name} (${org.id})\n`)
  
  const modulesToCheck = ['containers', 'vms']
  
  for (const moduleId of modulesToCheck) {
    console.log(`\nModule: ${moduleId}`)
    const policy = await getEffectiveModulePolicyForOrg(org.id, moduleId as any)
    console.log(`  Effective policy:`, JSON.stringify(policy, null, 2))
  }
}

debugModulePolicy()
  .then(() => {
    console.log('\n✅ Debug complete')
    process.exit(0)
  })
  .catch((error) => {
    console.error('❌ Error:', error)
    process.exit(1)
  })

