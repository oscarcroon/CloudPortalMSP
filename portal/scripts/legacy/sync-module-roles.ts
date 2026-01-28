import { syncModuleRoles } from '../server/utils/syncModuleRoles'

async function main() {
  console.log('🔄 Syncing module role definitions...')
  await syncModuleRoles()
  console.log('✅ Module roles synced')
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error('❌ Failed to sync module roles', error)
    process.exit(1)
  })

