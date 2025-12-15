import { getDb } from '../server/utils/db'
import { organizationModulePolicies, organizations } from '../server/database/schema'
import { eq, and } from 'drizzle-orm'

async function checkOrgPolicies() {
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
  
  console.log(`Checking organization policies for: ${org.name} (${org.id})\n`)
  
  const modulesToCheck = ['containers', 'vms']
  
  for (const moduleId of modulesToCheck) {
    console.log(`\nModule: ${moduleId}`)
    
    const [orgPolicy] = await db
      .select()
      .from(organizationModulePolicies)
      .where(
        and(
          eq(organizationModulePolicies.organizationId, org.id),
          eq(organizationModulePolicies.moduleId, moduleId)
        )
      )
    
    if (orgPolicy) {
      const enabled = typeof orgPolicy.enabled === 'boolean' ? orgPolicy.enabled : orgPolicy.enabled === 1
      const disabled = typeof orgPolicy.disabled === 'boolean' ? orgPolicy.disabled : orgPolicy.disabled === 1
      
      console.log(`  Organization policy exists:`)
      console.log(`    enabled: ${enabled} (raw: ${orgPolicy.enabled})`)
      console.log(`    disabled: ${disabled} (raw: ${orgPolicy.disabled})`)
      console.log(`    id: ${orgPolicy.id}`)
      
      if (!enabled) {
        console.log(`  ⚠️  PROBLEM: Organization policy has enabled=false, which prevents activation!`)
        console.log(`  💡 Solution: Delete this policy or set enabled=true`)
      }
    } else {
      console.log(`  No organization policy (inherits from tenant)`)
    }
  }
}

checkOrgPolicies()
  .then(() => {
    console.log('\n✅ Check complete')
    process.exit(0)
  })
  .catch((error) => {
    console.error('❌ Error:', error)
    process.exit(1)
  })

