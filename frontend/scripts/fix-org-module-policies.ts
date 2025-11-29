import { getDb } from '../server/utils/db'
import { organizationModulePolicies, organizations, tenantModulePolicies, tenants } from '../server/database/schema'
import { eq, and } from 'drizzle-orm'

async function fixOrgModulePolicies() {
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
  
  console.log(`Fixing organization module policies for: ${org.name} (${org.id})\n`)
  
  // Get organization's tenant
  const [tenant] = await db.select().from(tenants).where(eq(tenants.id, org.tenantId))
  if (!tenant) {
    console.log('No tenant found')
    return
  }
  
  console.log(`Tenant: ${tenant.name} (${tenant.id})\n`)
  
  const modulesToFix = ['containers', 'vms']
  
  for (const moduleId of modulesToFix) {
    console.log(`\nModule: ${moduleId}`)
    
    // Check tenant policy
    const [tenantPolicy] = await db
      .select()
      .from(tenantModulePolicies)
      .where(and(eq(tenantModulePolicies.tenantId, tenant.id), eq(tenantModulePolicies.moduleId, moduleId)))
    
    const tenantEnabled = tenantPolicy 
      ? (typeof tenantPolicy.enabled === 'boolean' ? tenantPolicy.enabled : tenantPolicy.enabled === 1)
      : true // Default enabled
    
    console.log(`  Tenant policy: enabled=${tenantEnabled}`)
    
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
      const orgEnabled = typeof orgPolicy.enabled === 'boolean' ? orgPolicy.enabled : orgPolicy.enabled === 1
      const orgDisabled = typeof orgPolicy.disabled === 'boolean' ? orgPolicy.disabled : orgPolicy.disabled === 1
      
      console.log(`  Current org policy: enabled=${orgEnabled}, disabled=${orgDisabled}`)
      
      // If tenant has enabled=true but org has enabled=false, fix it
      if (tenantEnabled && !orgEnabled) {
        console.log(`  ⚠️  FIXING: Setting org enabled=true to match tenant`)
        db.update(organizationModulePolicies)
          .set({
            enabled: 1,
            updatedAt: new Date()
          })
          .where(eq(organizationModulePolicies.id, orgPolicy.id))
          .run()
        console.log(`  ✅ Fixed`)
      } else if (orgEnabled && orgDisabled) {
        console.log(`  ℹ️  Policy is correct: enabled=true, disabled=true (module is activated but deactivated)`)
        console.log(`  💡 To fully activate, set disabled=false`)
      } else {
        console.log(`  ℹ️  Policy is correct`)
      }
    } else {
      console.log(`  No organization policy (inherits from tenant)`)
    }
  }
  
  console.log('\n✅ Fix complete')
}

fixOrgModulePolicies()
  .then(() => {
    process.exit(0)
  })
  .catch((error) => {
    console.error('❌ Error:', error)
    process.exit(1)
  })

