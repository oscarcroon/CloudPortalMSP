<template>
  <section class="space-y-8">
    <header class="space-y-1">
      <p class="text-xs uppercase tracking-[0.3em] text-slate-400 dark:text-slate-500">Superadmin</p>
      <h1 class="text-2xl font-semibold text-slate-900 dark:text-white">
        Modulrättigheter - {{ tenant?.name ?? 'Laddar...' }}
      </h1>
      <p class="text-sm text-slate-600 dark:text-slate-400">
        Hantera vilka moduler som är tillgängliga och vilka rättigheter som är tillåtna för denna tenant.
        Dessa inställningar ärvs av underordnade tenants och organisationer.
      </p>
    </header>

    <div v-if="error" class="rounded-lg bg-red-500/10 px-4 py-3 text-sm text-red-700 dark:text-red-300">
      {{ error }}
    </div>

    <div v-if="pending" class="text-sm text-slate-600 dark:text-slate-400">Laddar modulrättigheter...</div>

    <div v-else-if="tenant" class="space-y-6">
      <!-- Search input and expand all button -->
      <div class="flex items-center gap-3">
        <div class="relative flex-1">
          <Icon icon="mdi:magnify" class="absolute left-3 top-1/2 h-5 w-5 -translate-y-1/2 text-slate-400" />
          <input
            v-model="moduleSearchQuery"
            type="text"
            placeholder="Sök efter moduler..."
            class="w-full rounded-lg border border-slate-300 bg-white px-10 py-2.5 text-sm text-slate-900 placeholder:text-slate-400 focus:border-brand focus:outline-none focus:ring-1 focus:ring-brand dark:border-slate-600 dark:bg-slate-800 dark:text-slate-100 dark:placeholder:text-slate-500"
          />
        </div>
        <button
          @click="toggleAllPermissions"
          class="flex items-center gap-2 rounded-lg border border-slate-300 bg-white px-3 py-2.5 text-sm font-medium text-slate-700 transition hover:bg-slate-50 dark:border-slate-600 dark:bg-slate-800 dark:text-slate-300 dark:hover:bg-slate-700"
        >
          <Icon :icon="allPermissionsExpanded ? 'mdi:unfold-less-horizontal' : 'mdi:unfold-more-horizontal'" class="h-5 w-5" />
          {{ allPermissionsExpanded ? 'Dölj alla rättigheter' : 'Visa alla rättigheter' }}
        </button>
      </div>

      <div v-if="filteredPolicies.length === 0" class="rounded-xl border border-slate-200 bg-white p-8 text-center shadow-sm dark:border-white/10 dark:bg-[#0c1524]">
        <Icon icon="mdi:puzzle-outline" class="mx-auto h-12 w-12 text-slate-400" />
        <p class="mt-4 text-sm text-slate-600 dark:text-slate-400">
          {{ moduleSearchQuery ? 'Inga moduler matchade sökningen' : 'Inga moduler hittades för denna tenant.' }}
        </p>
      </div>

      <div
        v-for="policy in filteredPolicies"
        :key="policy.moduleId"
        class="rounded-xl border border-slate-200 bg-white shadow-sm dark:border-white/10 dark:bg-[#0c1524]"
        :class="{
          'opacity-50': policy.distributorLevelDisabled
        }"
      >
        <div class="border-b border-slate-200 px-6 py-4 dark:border-white/5">
          <div class="flex items-center justify-between">
            <div class="flex items-center gap-3">
              <Icon :icon="policy.module.icon" class="h-6 w-6 text-brand" />
              <div>
                <h3 class="text-lg font-semibold text-slate-900 dark:text-white">{{ policy.module.name }}</h3>
                <p class="text-xs text-slate-500 dark:text-slate-400">{{ policy.module.description }}</p>
              </div>
            </div>
            <!-- Show controls if module is enabled at distributor level and not disabled -->
            <div v-if="policy.distributorLevelEnabled !== false && !policy.distributorLevelDisabled" class="flex items-center gap-4">
              <!-- Avaktivera (gray out module) -->
              <div class="flex flex-col items-end gap-1">
                <label class="relative inline-flex cursor-pointer items-center">
                  <input
                    type="checkbox"
                    class="peer sr-only"
                    :checked="policy.disabled"
                    :disabled="!policy.enabled"
                    @change="updateModuleDisabled(policy.moduleId, ($event.target as HTMLInputElement).checked)"
                  />
                  <div
                    class="peer h-6 w-11 rounded-full bg-slate-300 transition-colors after:absolute after:left-[2px] after:top-[2px] after:h-5 after:w-5 after:rounded-full after:bg-white after:transition-all after:content-[''] peer-checked:bg-yellow-500 peer-checked:after:translate-x-full peer-focus:ring-2 peer-focus:ring-yellow-500 peer-disabled:opacity-50 peer-disabled:cursor-not-allowed dark:bg-slate-600"
                  />
                </label>
                <span class="text-xs text-slate-500 dark:text-slate-400">Avaktivera</span>
                <p class="text-xs text-slate-400 dark:text-slate-500">Visar utgråad</p>
              </div>
              <!-- Aktivera/Inaktivera (show/hide module) -->
              <div class="flex flex-col items-end gap-1">
                <label class="relative inline-flex cursor-pointer items-center">
                  <input
                    type="checkbox"
                    class="peer sr-only"
                    :checked="policy.enabled"
                    @change="updateModuleEnabled(policy.moduleId, ($event.target as HTMLInputElement).checked)"
                  />
                  <div
                    class="peer h-6 w-11 rounded-full bg-slate-300 transition-colors after:absolute after:left-[2px] after:top-[2px] after:h-5 after:w-5 after:rounded-full after:bg-white after:transition-all after:content-[''] peer-checked:bg-green-500 peer-checked:after:translate-x-full peer-focus:ring-2 peer-focus:ring-green-500 dark:bg-slate-600"
                  />
                </label>
                <span class="text-xs font-medium" :class="policy.enabled ? 'text-green-600 dark:text-green-400' : 'text-red-600 dark:text-red-400'">
                  {{ policy.enabled ? 'Aktiv' : 'Inaktiverad' }}
                </span>
                <p class="text-xs text-slate-400 dark:text-slate-500">
                  {{ policy.enabled ? 'Modulen är synlig' : 'Döljer modulen' }}
                </p>
              </div>
            </div>
            <!-- Show message if module is deactivated (disabled=true) at distributor level -->
            <div v-else-if="policy.distributorLevelDisabled" class="flex items-center gap-2 rounded-lg bg-yellow-50 px-3 py-2 dark:bg-yellow-900/20">
              <Icon icon="mdi:alert-circle-outline" class="h-5 w-5 text-yellow-600 dark:text-yellow-400" />
              <span class="text-sm font-medium text-yellow-800 dark:text-yellow-200">Modulen är avaktiverad på högre nivå</span>
            </div>
          </div>
        </div>

        <div v-if="policy.enabled && !policy.disabled && !policy.distributorLevelDisabled && policy.module.permissions.length > 0" class="border-t border-slate-200 px-6 py-4 dark:border-white/5">
          <button
            @click="toggleModulePermissions(policy.moduleId)"
            class="flex w-full items-center justify-between text-left"
          >
            <p class="text-sm font-medium text-slate-700 dark:text-slate-300">Rättigheter</p>
            <Icon 
              :icon="expandedPermissions[policy.moduleId] ? 'mdi:chevron-up' : 'mdi:chevron-down'" 
              class="h-5 w-5 text-slate-400" 
            />
          </button>
          <div v-if="expandedPermissions[policy.moduleId]" class="mt-4 space-y-3">
            <label
              v-for="permission in policy.module.permissions"
              :key="permission"
              class="flex items-center justify-between rounded-lg border border-slate-200 px-4 py-3 transition hover:bg-slate-50 dark:border-white/10 dark:hover:bg-white/5"
            >
              <div>
                <span class="font-mono text-sm text-slate-900 dark:text-white">{{ permission }}</span>
                <p class="mt-1 text-xs text-slate-500 dark:text-slate-400">
                  {{ getPermissionDescription(permission) }}
                </p>
              </div>
              <label class="relative inline-flex cursor-pointer items-center">
                <input
                  type="checkbox"
                  class="peer sr-only"
                  :checked="policy.permissionOverrides[permission] !== false"
                  @change="togglePermission(policy.moduleId, permission, ($event.target as HTMLInputElement).checked)"
                />
                <div
                  class="peer h-5 w-9 rounded-full bg-slate-300 transition-colors after:absolute after:left-[2px] after:top-[2px] after:h-4 after:w-4 after:rounded-full after:bg-white after:transition-all after:content-[''] peer-checked:bg-green-500 peer-checked:after:translate-x-full peer-focus:ring-2 peer-focus:ring-green-500 dark:bg-slate-600"
                />
              </label>
            </label>
          </div>
        </div>

        <div v-if="policy.roleDefinitions.length > 0" class="border-t border-slate-200 px-6 py-4 dark:border-white/5">
          <div class="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <p class="text-sm font-medium text-slate-700 dark:text-slate-300">Modulspecifika roller</p>
              <p class="mt-1 text-xs text-slate-500 dark:text-slate-400">
                Definiera vilka modulroller som är tillåtna på denna nivå. Underliggande nivåer kan endast begränsa vidare.
              </p>
            </div>
            <div class="flex flex-wrap gap-2 text-xs">
              <label class="inline-flex items-center gap-1 text-slate-600 dark:text-slate-400">
                <input
                  type="radio"
                  :name="`role-mode-${policy.moduleId}`"
                  value="inherit"
                  :checked="getRoleMode(policy) === 'inherit'"
                  :disabled="isParentRoleBlock(policy)"
                  @change="updateRoleMode(policy, 'inherit')"
                />
                Ärver
              </label>
              <label class="inline-flex items-center gap-1 text-slate-600 dark:text-slate-400">
                <input
                  type="radio"
                  :name="`role-mode-${policy.moduleId}`"
                  value="custom"
                  :checked="getRoleMode(policy) === 'custom'"
                  :disabled="isParentRoleBlock(policy)"
                  @change="updateRoleMode(policy, 'custom')"
                />
                Anpassad
              </label>
              <label class="inline-flex items-center gap-1 text-slate-600 dark:text-slate-400">
                <input
                  type="radio"
                  :name="`role-mode-${policy.moduleId}`"
                  value="block"
                  :checked="getRoleMode(policy) === 'block'"
                  :disabled="isParentRoleBlock(policy)"
                  @change="updateRoleMode(policy, 'block')"
                />
                Blockera
              </label>
            </div>
          </div>

          <div
            v-if="getRoleMode(policy) === 'custom' && !isParentRoleBlock(policy)"
            class="mt-4 grid gap-3 md:grid-cols-2"
          >
            <label
              v-for="role in policy.roleDefinitions"
              :key="role.key"
              class="flex items-center justify-between rounded-lg border border-slate-200 px-4 py-3 dark:border-white/10"
            >
              <div class="pr-3">
                <p class="text-sm font-medium text-slate-800 dark:text-slate-100">{{ role.label }}</p>
                <p class="text-xs text-slate-500 dark:text-slate-400">
                  {{ role.description || 'Ingen beskrivning' }}
                </p>
              </div>
              <label class="relative inline-flex cursor-pointer items-center">
                <input
                  type="checkbox"
                  class="peer sr-only"
                  :checked="policy.allowedRoles?.includes(role.key) ?? false"
                  :disabled="isParentRoleBlock(policy)"
                  @change="toggleModuleRoleSelection(policy, role.key, ($event.target as HTMLInputElement).checked)"
                />
                <div
                  class="peer h-5 w-9 rounded-full bg-slate-300 transition-colors after:absolute after:left-[2px] after:top-[2px] after:h-4 after:w-4 after:rounded-full after:bg-white after:transition-all after:content-[''] peer-checked:bg-brand peer-checked:after:translate-x-full peer-focus:ring-2 peer-focus:ring-brand dark:bg-slate-600"
                />
              </label>
            </label>
          </div>

          <p
            v-else-if="isParentRoleBlock(policy)"
            class="mt-3 text-xs font-medium text-yellow-600 dark:text-yellow-400"
          >
            Modulroller blockeras på {{ getRoleSourceLabel(policy.parentRolesSource ?? null) }}.
          </p>

          <p
            v-else-if="getRoleMode(policy) === 'block'"
            class="mt-3 text-xs font-medium text-red-600 dark:text-red-400"
          >
            Alla modulroller blockeras på denna nivå.
          </p>
        </div>
      </div>
    </div>
  </section>
</template>

<script setup lang="ts">
import { ref, onMounted, computed, watch } from 'vue'
import { Icon } from '@iconify/vue'
import { useRoute } from 'vue-router'
import type { ModuleRoleDefinition } from '~/constants/modules'

definePageMeta({
  layout: 'default',
  superAdmin: true
})

const route = useRoute()
const tenantId = route.params.id as string

interface ModulePolicy {
  moduleId: string
  module: {
    id: string
    name: string
    description: string
    category: string
    permissions: string[]
    icon: string
  }
  enabled: boolean
  disabled: boolean
  permissionOverrides: Record<string, boolean>
  allowedRoles: string[] | null
  visibilityMode: 'everyone' | 'moduleRoles'
  roleDefinitions: ModuleRoleDefinition[]
  defaultAllowedRoles: string[] | null
  distributorLevelEnabled?: boolean // Whether the module is enabled at distributor level
  distributorLevelDisabled?: boolean // Whether the module is disabled (grayed out) at distributor level
  parentRolesBlocked?: boolean
  parentRolesSource?: 'distributor' | null
}

type ModuleRoleMode = 'inherit' | 'custom' | 'block'

const getRoleMode = (policy: ModulePolicy): ModuleRoleMode => {
  if (policy.allowedRoles === null) {
    return 'inherit'
  }
  if (Array.isArray(policy.allowedRoles) && policy.allowedRoles.length === 0) {
    return 'block'
  }
  return 'custom'
}

const determineCustomRoles = (policy: ModulePolicy): string[] => {
  if (policy.allowedRoles && policy.allowedRoles.length > 0) {
    return [...policy.allowedRoles]
  }
  if (policy.defaultAllowedRoles && policy.defaultAllowedRoles.length > 0) {
    return [...policy.defaultAllowedRoles]
  }
  if (policy.roleDefinitions.length > 0) {
    return policy.roleDefinitions.map((role) => role.key)
  }
  return []
}

const isParentRoleBlock = (policy: ModulePolicy): boolean => Boolean(policy.parentRolesBlocked)

const roleSourceLabels: Record<'distributor', string> = {
  distributor: 'distributörsnivå'
}

const getRoleSourceLabel = (source?: 'distributor' | null): string => {
  if (!source) {
    return 'högre nivå'
  }
  return roleSourceLabels[source] ?? 'högre nivå'
}

const tenant = ref<any>(null)
const policies = ref<ModulePolicy[]>([])
const pending = ref(true)
const error = ref<string | null>(null)
const moduleSearchQuery = ref('')
const expandedPermissions = ref<Record<string, boolean>>({})
const allPermissionsExpanded = ref(false)

// Normalize text for fuzzy search (same as ContextSwitcher and settings/modules)
function normalizeText(value: string) {
  return value
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .trim()
}

function matchesSearch(value: string, query: string) {
  if (!query) {
    return true
  }
  return normalizeText(value).includes(normalizeText(query))
}

// Filter policies: hide modules inactivated (enabled=false) at distributor level, show deactivated (disabled=true) with message, filter by search query
const filteredPolicies = computed(() => {
  // Hide modules that are inactivated (enabled=false) at distributor level
  // These should be completely hidden
  // But show modules that are deactivated (disabled=true) at distributor level with a message
  let filtered = policies.value.filter((policy) => {
    // If distributorLevelEnabled is explicitly false, hide the module completely
    // If it's undefined or true, show it (even if disabled at distributor level)
    return policy.distributorLevelEnabled !== false
  })
  
  // Apply search query if present
  const query = moduleSearchQuery.value
  if (!query) {
    return filtered
  }
  
  const normalizedQuery = normalizeText(query)
  return filtered.filter((policy) => {
    return (
      matchesSearch(policy.module.name, normalizedQuery) ||
      matchesSearch(policy.module.description, normalizedQuery) ||
      matchesSearch(policy.module.category, normalizedQuery)
    )
  })
})

const fetchTenant = async () => {
  try {
    const response = await $fetch(`/api/admin/tenants/${tenantId}`)
    tenant.value = response.tenant
  } catch (err: any) {
    error.value = err.message || 'Kunde inte hämta tenant'
  }
}

const fetchPolicies = async () => {
  try {
    pending.value = true
    const response = await $fetch(`/api/admin/tenants/${tenantId}/modules`)
    policies.value = response.policies || []
  } catch (err: any) {
    error.value = err.message || 'Kunde inte hämta modulrättigheter'
    console.error('Failed to fetch module policies:', err)
  } finally {
    pending.value = false
  }
}

const updateModulePolicy = async (
  moduleId: string,
  enabled: boolean | undefined,
  disabled: boolean | undefined,
  permissionOverrides: Record<string, boolean>,
  allowedRoles?: string[] | null
) => {
  const policy = policies.value.find((p) => p.moduleId === moduleId)
  if (!policy) return

  // Store original values for rollback
  const originalEnabled = policy.enabled
  const originalDisabled = policy.disabled
  const originalOverrides = { ...policy.permissionOverrides }
  const originalAllowedRoles = policy.allowedRoles

  // Optimistically update UI
  if (enabled !== undefined) {
    policy.enabled = enabled
    // If disabling, also clear disabled state
    if (!enabled) {
      policy.disabled = false
    }
  }
  if (disabled !== undefined) {
    policy.disabled = disabled
  }
  policy.permissionOverrides = { ...permissionOverrides }
  if (allowedRoles !== undefined) {
    policy.allowedRoles = allowedRoles
  }

  try {
    const body: any = {
      moduleId,
      permissionOverrides
    }
    // Only include enabled/disabled if explicitly provided
    if (enabled !== undefined) {
      body.enabled = enabled
    }
    if (disabled !== undefined) {
      body.disabled = disabled
    }
    if (allowedRoles !== undefined) {
      body.allowedRoles = allowedRoles
    }

    const response = await $fetch(`/api/admin/tenants/${tenantId}/modules`, {
      method: 'PUT',
      body
    })
    
    // Update policy with response data to ensure consistency
    if (response) {
      policy.enabled = response.enabled
      policy.disabled = response.disabled ?? false
      policy.permissionOverrides = response.permissionOverrides || {}
      policy.allowedRoles = response.allowedRoles ?? policy.allowedRoles ?? null
    }
    
    return response
  } catch (err: any) {
    // Revert on error
    policy.enabled = originalEnabled
    policy.disabled = originalDisabled
    policy.permissionOverrides = originalOverrides
    policy.allowedRoles = originalAllowedRoles
    error.value = err.message || 'Kunde inte uppdatera modulrättigheter'
    console.error('Failed to update module policy:', err)
    throw err
  }
}

const updateModuleEnabled = async (moduleId: string, enabled: boolean) => {
  const policy = policies.value.find((p) => p.moduleId === moduleId)
  if (!policy) return
  await updateModulePolicy(moduleId, enabled, undefined, policy.permissionOverrides)
}

const updateModuleDisabled = async (moduleId: string, disabled: boolean) => {
  const policy = policies.value.find((p) => p.moduleId === moduleId)
  if (!policy) return
  await updateModulePolicy(moduleId, undefined, disabled, policy.permissionOverrides)
}

const togglePermission = async (moduleId: string, permission: string, allowed: boolean) => {
  const policy = policies.value.find((p) => p.moduleId === moduleId)
  if (!policy) return

  // Store original value for rollback
  const originalOverrides = { ...policy.permissionOverrides }

  // Optimistically update UI
  const newOverrides = { ...policy.permissionOverrides }
  if (allowed) {
    delete newOverrides[permission]
  } else {
    newOverrides[permission] = false
  }
  policy.permissionOverrides = newOverrides

  try {
    // Only update permission overrides, don't change enabled/disabled state
    // Pass undefined for enabled/disabled to indicate we don't want to change them
    const response = await updateModulePolicy(moduleId, undefined, undefined, newOverrides)
    
    // Update with response data to ensure consistency
    if (response) {
      policy.permissionOverrides = response.permissionOverrides || {}
    }
  } catch (err: any) {
    // Revert on error
    policy.permissionOverrides = originalOverrides
    error.value = err.message || 'Kunde inte uppdatera rättighet'
    console.error('Failed to toggle permission:', err)
  }
}

const updateRoleMode = async (policy: ModulePolicy, mode: ModuleRoleMode) => {
  if (isParentRoleBlock(policy)) {
    return
  }
  const currentMode = getRoleMode(policy)
  if (currentMode === mode) {
    return
  }

  if (mode === 'inherit') {
    await updateModulePolicy(policy.moduleId, undefined, undefined, policy.permissionOverrides, null)
    return
  }

  if (mode === 'block') {
    await updateModulePolicy(policy.moduleId, undefined, undefined, policy.permissionOverrides, [])
    return
  }

  const nextRoles = determineCustomRoles(policy)
  await updateModulePolicy(policy.moduleId, undefined, undefined, policy.permissionOverrides, nextRoles)
}

const toggleModuleRoleSelection = async (
  policy: ModulePolicy,
  roleKey: string,
  selected: boolean
) => {
  if (isParentRoleBlock(policy)) {
    return
  }
  const currentRoles = new Set(policy.allowedRoles ?? [])
  if (selected) {
    currentRoles.add(roleKey)
  } else {
    currentRoles.delete(roleKey)
  }

  await updateModulePolicy(
    policy.moduleId,
    undefined,
    undefined,
    policy.permissionOverrides,
    Array.from(currentRoles)
  )
}

const getPermissionDescription = (permission: string): string => {
  const descriptions: Record<string, string> = {
    'cloudflare:read': 'Läs åtkomst till DNS-zoner och poster',
    'cloudflare:write': 'Skriv åtkomst för att skapa och ändra DNS-poster',
    'containers:read': 'Läs åtkomst till containers',
    'containers:write': 'Skriv åtkomst för att hantera containers',
    'vms:read': 'Läs åtkomst till virtuella maskiner',
    'vms:write': 'Skriv åtkomst för att hantera virtuella maskiner',
    'wordpress:read': 'Läs åtkomst till WordPress-sajter',
    'wordpress:write': 'Skriv åtkomst för att hantera WordPress-sajter',
    'org:read': 'Läs åtkomst till organisationsinformation'
  }
  return descriptions[permission] || permission
}

const toggleModulePermissions = (moduleId: string) => {
  expandedPermissions.value[moduleId] = !expandedPermissions.value[moduleId]
}

const toggleAllPermissions = () => {
  allPermissionsExpanded.value = !allPermissionsExpanded.value
  // Update all module permissions to match the "all" state
  filteredPolicies.value.forEach((policy) => {
    if (policy.enabled && !policy.disabled && policy.module.permissions.length > 0) {
      expandedPermissions.value[policy.moduleId] = allPermissionsExpanded.value
    }
  })
}

// Watch for changes in individual permissions to update "all" state
watch(expandedPermissions, (newVal) => {
  const modulesWithPermissions = filteredPolicies.value.filter(
    (p) => p.enabled && !p.disabled && p.module.permissions.length > 0
  )
  if (modulesWithPermissions.length === 0) {
    allPermissionsExpanded.value = false
    return
  }
  const allExpanded = modulesWithPermissions.every(
    (p) => newVal[p.moduleId] === true
  )
  const allCollapsed = modulesWithPermissions.every(
    (p) => newVal[p.moduleId] !== true
  )
  // Only update if all are in the same state
  if (allExpanded) {
    allPermissionsExpanded.value = true
  } else if (allCollapsed) {
    allPermissionsExpanded.value = false
  }
}, { deep: true })

onMounted(async () => {
  await Promise.all([fetchTenant(), fetchPolicies()])
})
</script>

