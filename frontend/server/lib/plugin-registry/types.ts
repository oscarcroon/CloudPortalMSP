export interface PluginModuleManifest {
  module: {
    key: string
    name: string
    description?: string
    category?: string
  }
  permissions: {
    key: string
    description?: string
  }[]
  roles: {
    key: string
    label: string
    description?: string
    sortOrder?: number
    permissions: string[]
  }[]
  roleDefaults: {
    appRoleKey: string
    moduleRoleKey: string
  }[]
}



