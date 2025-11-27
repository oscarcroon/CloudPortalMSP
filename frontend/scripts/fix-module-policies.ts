import { getDb } from '../src/server/utils/db'
import { organizationModulePolicies, organizations } from '../src/server/database/schema'
import { eq, and } from 'drizzle-orm'

async function fixModulePolicies() {
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
  
  console.log(`Fixing module policies for: ${org.name} (${org.id})\n`)
  
  const modulesToFix = ['containers', 'vms']
  
  for (const moduleId of modulesToFix) {
    console.log(`\nModule: ${moduleId}`)
    
    // Check current organization policy
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
      
      console.log(`  Current: enabled=${enabled}, disabled=${disabled}`)
      
      // If enabled is true but disabled is also true, we should keep it as is
      // But if enabled is false, we should remove the policy to inherit from tenant
      if (!enabled) {
        console.log(`  ⚠️  Removing organization policy with enabled=false to inherit from tenant`)
        db.delete(organizationModulePolicies)
          .where(eq(organizationModulePolicies.id, orgPolicy.id))
          .run()
        console.log(`  ✅ Removed organization policy`)
      } else if (enabled && disabled) {
        console.log(`  ℹ️  Policy is correct: enabled=true, disabled=true (module is activated but deactivated)`)
      } else {
        console.log(`  ℹ️  Policy is correct: enabled=true, disabled=false`)
      }
    } else {
      console.log(`  ℹ️  No organization policy (inherits from tenant)`)
    }
  }
  
  console.log('\n✅ Fix complete')
}

fixModulePolicies()
  .then(() => {
    process.exit(0)
  })
  .catch((error) => {
    console.error('❌ Error:', error)
    process.exit(1)
  })

