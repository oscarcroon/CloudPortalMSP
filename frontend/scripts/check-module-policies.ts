import { getDb } from '../src/server/utils/db'
import { organizationModulePolicies, tenantModulePolicies, organizations, tenants } from '../src/server/database/schema'
import { eq, and } from 'drizzle-orm'

async function checkModulePolicies() {
  const db = getDb()
  
  // Get all organizations
  const orgs = await db.select().from(organizations)
  
  console.log('Checking module policies for all organizations...\n')
  
  for (const org of orgs) {
    console.log(`\nOrganization: ${org.name} (${org.id})`)
    
    // Get organization's tenant
    const [tenant] = await db.select().from(tenants).where(eq(tenants.id, org.tenantId))
    if (!tenant) {
      console.log('  No tenant found')
      continue
    }
    
    console.log(`  Tenant: ${tenant.name} (${tenant.id}, type: ${tenant.type})`)
    
    // Check for containers and vms modules
    const modulesToCheck = ['containers', 'vms']
    
    for (const moduleId of modulesToCheck) {
      console.log(`\n  Module: ${moduleId}`)
      
      // Check tenant policy
      const [tenantPolicy] = await db
        .select()
        .from(tenantModulePolicies)
        .where(and(eq(tenantModulePolicies.tenantId, tenant.id), eq(tenantModulePolicies.moduleId, moduleId)))
      
      if (tenantPolicy) {
        const enabled = typeof tenantPolicy.enabled === 'boolean' ? tenantPolicy.enabled : tenantPolicy.enabled === 1
        console.log(`    Tenant policy: enabled=${enabled}`)
      } else {
        console.log(`    Tenant policy: none (default enabled)`)
      }
      
      // Check organization policy
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
        console.log(`    Organization policy: enabled=${enabled}, disabled=${disabled}`)
        
        if (!enabled) {
          console.log(`    ⚠️  WARNING: Organization has enabled=false, which will disable the module even if tenant has it enabled!`)
        }
      } else {
        console.log(`    Organization policy: none (inherits from tenant)`)
      }
    }
  }
}

checkModulePolicies()
  .then(() => {
    console.log('\n✅ Check complete')
    process.exit(0)
  })
  .catch((error) => {
    console.error('❌ Error:', error)
    process.exit(1)
  })

