<template>
  <section class="space-y-8">
    <header class="space-y-1">
      <p class="text-xs uppercase tracking-[0.3em] text-slate-400 dark:text-slate-500">Inställningar</p>
      <h1 class="text-2xl font-semibold text-slate-900 dark:text-white">Modulrättigheter</h1>
      <p class="text-sm text-slate-600 dark:text-slate-400">
        Hantera vilka moduler som är synliga och vilka rättigheter som är tillgängliga för din organisation.
        Du kan också sätta granulära rättigheter per användare för varje modul.
      </p>
    </header>

    <div v-if="loading" class="flex items-center justify-center py-12">
      <div class="h-8 w-8 animate-spin rounded-full border-4 border-brand border-t-transparent" />
    </div>

    <div v-else-if="error" class="rounded-xl border border-red-200 bg-red-50 p-4 dark:border-red-800 dark:bg-red-900/20">
      <p class="text-sm text-red-800 dark:text-red-200">{{ error }}</p>
    </div>

    <div v-else class="space-y-6">
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
          {{ moduleSearchQuery ? 'Inga moduler matchade sökningen' : 'Inga moduler hittades för din organisation.' }}
        </p>
      </div>
      
      <div
        v-for="policy in filteredPolicies"
        :key="policy.moduleId"
        :class="[
          'rounded-xl border shadow-sm transition',
          policy.disabled
            ? 'border-slate-300 bg-slate-50 opacity-60 dark:border-slate-600 dark:bg-slate-800/50'
            : !policy.enabled
            ? 'border-red-200 bg-red-50/50 dark:border-red-800/50 dark:bg-red-900/10'
            : 'border-slate-200 bg-white dark:border-white/10 dark:bg-[#0c1524]'
        ]"
      >
        <div class="border-b border-slate-200 px-6 py-4 dark:border-white/5">
          <div class="flex items-center justify-between">
            <div class="flex items-center gap-3">
              <Icon 
                :icon="policy.module.icon" 
                :class="[
                  'h-6 w-6',
                  policy.disabled 
                    ? 'text-slate-400 dark:text-slate-500' 
                    : !policy.enabled
                    ? 'text-red-400 dark:text-red-500'
                    : 'text-brand'
                ]" 
              />
              <div>
                <h3 
                  :class="[
                    'text-lg font-semibold',
                    policy.disabled 
                      ? 'text-slate-400 dark:text-slate-500' 
                      : !policy.enabled
                      ? 'text-red-600 dark:text-red-400'
                      : 'text-slate-900 dark:text-white'
                  ]"
                >
                  {{ policy.module.name }}
                  <span v-if="!policy.enabled && !policy.disabled" class="ml-2 text-xs font-normal text-red-500 dark:text-red-400">
                    (Inaktiverad)
                  </span>
                  <span v-else-if="policy.disabled && policy.enabled" class="ml-2 text-xs font-normal text-yellow-600 dark:text-yellow-400">
                    (Avaktiverad)
                  </span>
                </h3>
                <p 
                  :class="[
                    'text-xs',
                    policy.disabled 
                      ? 'text-slate-400 dark:text-slate-500' 
                      : !policy.enabled
                      ? 'text-red-500 dark:text-red-400'
                      : 'text-slate-500 dark:text-slate-400'
                  ]"
                >
                  {{ policy.module.description }}
                </p>
              </div>
            </div>
            <!-- Show toggles if module is not disabled at tenant level -->
            <div v-if="!policy.tenantLevelDisabled" class="flex items-center gap-4">
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
                    :disabled="policy.tenantLevelEnabled === false"
                    @change="updateModuleEnabled(policy.moduleId, ($event.target as HTMLInputElement).checked)"
                  />
                  <div
                    :class="[
                      'peer h-6 w-11 rounded-full bg-slate-300 transition-colors after:absolute after:left-[2px] after:top-[2px] after:h-5 after:w-5 after:rounded-full after:bg-white after:transition-all after:content-[\'\'] peer-checked:bg-green-500 peer-checked:after:translate-x-full peer-focus:ring-2 peer-focus:ring-green-500 dark:bg-slate-600',
                      policy.tenantLevelEnabled === false ? 'peer-disabled:opacity-50 peer-disabled:cursor-not-allowed' : ''
                    ]"
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
            <!-- Show message if module is disabled at tenant level -->
            <div v-else class="flex items-center gap-2 rounded-lg bg-yellow-50 px-3 py-2 dark:bg-yellow-900/20">
              <Icon icon="mdi:alert-circle-outline" class="h-5 w-5 text-yellow-600 dark:text-yellow-400" />
              <span class="text-sm font-medium text-yellow-800 dark:text-yellow-200">Modulen är avaktiverad på högre nivå</span>
            </div>
          </div>
        </div>

        <div v-if="policy.enabled && !policy.disabled && policy.module.permissions.length > 0" class="border-t border-slate-200 px-6 py-4 dark:border-white/5">
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

        <!-- User-specific permissions section -->
        <div v-if="policy.enabled && !policy.disabled" class="border-t border-slate-200 px-6 py-4 dark:border-white/5">
          <button
            @click="toggleUserPermissions(policy.moduleId)"
            class="flex w-full items-center justify-between text-left"
          >
            <div>
              <p class="text-sm font-medium text-slate-700 dark:text-slate-300">Användarrättigheter</p>
              <p class="mt-1 text-xs text-slate-500 dark:text-slate-400">
                Hantera rättigheter per användare för denna modul. Du kan neka specifika rättigheter för användare även om deras roll normalt ger dem.
              </p>
            </div>
            <Icon 
              :icon="expandedModules[policy.moduleId] ? 'mdi:chevron-up' : 'mdi:chevron-down'" 
              class="h-5 w-5 text-slate-400" 
            />
          </button>

          <div v-if="expandedModules[policy.moduleId]" class="mt-4 space-y-4">
              <!-- Search input -->
              <div class="relative">
                <Icon icon="mdi:magnify" class="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                <input
                  v-model="userSearchQueries[policy.moduleId]"
                  type="text"
                  placeholder="Sök efter användare..."
                  class="w-full rounded-lg border border-slate-300 bg-white pl-10 pr-4 py-2 text-sm text-slate-900 placeholder:text-slate-400 focus:border-brand focus:outline-none focus:ring-1 focus:ring-brand dark:border-slate-600 dark:bg-slate-800 dark:text-slate-100 dark:placeholder:text-slate-500"
                />
              </div>

              <div v-if="loadingUsers[policy.moduleId]" class="flex items-center justify-center py-4">
                <div class="h-6 w-6 animate-spin rounded-full border-2 border-brand border-t-transparent" />
              </div>

              <div v-else-if="filteredUsers[policy.moduleId]?.length === 0" class="text-center py-4 text-sm text-slate-500 dark:text-slate-400">
                {{ userSearchQueries[policy.moduleId] ? 'Inga användare matchade sökningen' : 'Inga användare hittades' }}
              </div>

              <!-- Compact table layout for users -->
              <div v-else class="overflow-x-auto rounded-lg border border-slate-200 dark:border-white/10">
                <table class="w-full text-sm">
                  <thead class="bg-slate-50 dark:bg-slate-800/50">
                    <tr>
                      <th class="px-4 py-2 text-left text-xs font-medium uppercase tracking-wider text-slate-700 dark:text-slate-300">
                        Användare
                      </th>
                      <th class="px-4 py-2 text-left text-xs font-medium uppercase tracking-wider text-slate-700 dark:text-slate-300">
                        Roll
                      </th>
                      <th
                        v-for="permission in policy.module.permissions"
                        :key="permission"
                        class="px-4 py-2 text-center text-xs font-medium uppercase tracking-wider text-slate-700 dark:text-slate-300"
                      >
                        <div class="flex flex-col items-center gap-1">
                          <span class="font-mono text-[10px]">{{ permission }}</span>
                          <span class="text-[10px] font-normal normal-case">{{ getPermissionDescription(permission) }}</span>
                        </div>
                      </th>
                    </tr>
                  </thead>
                  <tbody class="divide-y divide-slate-200 dark:divide-white/5">
                    <tr
                      v-for="user in filteredUsers[policy.moduleId]"
                      :key="user.userId"
                      class="transition hover:bg-slate-50 dark:hover:bg-slate-800/30"
                    >
                      <td class="px-4 py-3">
                        <div>
                          <p class="font-medium text-slate-900 dark:text-white">
                            {{ user.fullName || 'Inget namn' }}
                          </p>
                          <p class="text-xs text-slate-500 dark:text-slate-400">{{ user.email }}</p>
                        </div>
                      </td>
                      <td class="px-4 py-3">
                        <span class="text-xs text-slate-600 dark:text-slate-400">{{ getRoleName(user.role) }}</span>
                      </td>
                      <td
                        v-for="permission in policy.module.permissions"
                        :key="permission"
                        class="px-4 py-3 text-center"
                      >
                        <label
                          class="relative inline-flex cursor-pointer items-center"
                          :title="!user.rolePermissions.includes(permission) ? 'Rollen ger inte denna rättighet' : user.deniedPermissions.includes(permission) ? 'Klicka för att tillåta' : 'Klicka för att neka'"
                        >
                          <input
                            type="checkbox"
                            class="peer sr-only"
                            :checked="!user.deniedPermissions.includes(permission)"
                            :disabled="!user.rolePermissions.includes(permission) || updatingUsers[`${policy.moduleId}-${user.userId}`]"
                            @change="toggleUserPermission(policy.moduleId, user.userId, permission, ($event.target as HTMLInputElement).checked)"
                          />
                          <div
                            class="peer h-5 w-9 rounded-full bg-slate-300 transition-colors after:absolute after:left-[2px] after:top-[2px] after:h-4 after:w-4 after:rounded-full after:bg-white after:transition-all after:content-[''] peer-checked:bg-green-500 peer-checked:after:translate-x-full peer-focus:ring-2 peer-focus:ring-green-500 peer-disabled:opacity-50 peer-disabled:cursor-not-allowed dark:bg-slate-600"
                          />
                        </label>
                      </td>
                    </tr>
                  </tbody>
                </table>
              </div>
            </div>
        </div>
      </div>
    </div>
  </section>
</template>

<script setup lang="ts">
import { ref, onMounted, watch, computed } from 'vue'
import { Icon } from '@iconify/vue'
import { useAuth } from '~/composables/useAuth'
import { usePermission } from '~/composables/usePermission'

definePageMeta({
  layout: 'default'
})

const auth = useAuth()
const { hasPermission } = usePermission()

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
  tenantLevelEnabled?: boolean // Whether the module is enabled at tenant level
  tenantLevelDisabled?: boolean // Whether the module is disabled (grayed out) at tenant level
}

interface UserPermission {
  userId: string
  email: string
  fullName: string | null
  role: string
  rolePermissions: string[]
  deniedPermissions: string[]
  effectivePermissions: string[]
}

const policies = ref<ModulePolicy[]>([])
const loading = ref(true)
const error = ref<string | null>(null)
const expandedModules = ref<Record<string, boolean>>({})
const expandedPermissions = ref<Record<string, boolean>>({})
const allPermissionsExpanded = ref(false)
const userPermissions = ref<Record<string, UserPermission[]>>({})
const loadingUsers = ref<Record<string, boolean>>({})
const updatingUsers = ref<Record<string, boolean>>({})
const userSearchQueries = ref<Record<string, string>>({})
const moduleSearchQuery = ref('')

// Normalize text for fuzzy search (same as ContextSwitcher)
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

// Filter policies: hide modules disabled at tenant level, filter by search query
const filteredPolicies = computed(() => {
  // Hide modules that are disabled (enabled=false) at tenant level
  // These cannot be activated at organization level anyway
  // But show modules that are deactivated (disabled=true) at tenant level with a message
  let filtered = policies.value.filter((policy) => {
    // If tenantLevelEnabled is explicitly false, hide the module completely
    // If it's undefined or true, show it (even if disabled at tenant level)
    return policy.tenantLevelEnabled !== false
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

// Filtered users based on search query
const filteredUsers = computed(() => {
  const result: Record<string, UserPermission[]> = {}
  for (const [moduleId, users] of Object.entries(userPermissions.value)) {
    const query = userSearchQueries.value[moduleId] || ''
    if (!query) {
      result[moduleId] = users
    } else {
      result[moduleId] = users.filter(
        (user) =>
          matchesSearch(user.email, query) ||
          matchesSearch(user.fullName || '', query) ||
          matchesSearch(getRoleName(user.role), query)
      )
    }
  }
  return result
})

const fetchPolicies = async () => {
  const currentOrgId = auth.currentOrg.value?.id
  if (!currentOrgId) {
    error.value = 'Ingen organisation vald'
    loading.value = false
    return
  }

  try {
    loading.value = true
    const response = await $fetch(`/api/organizations/${currentOrgId}/modules`)
    policies.value = response.policies || []
  } catch (err: any) {
    error.value = err.message || 'Kunde inte hämta modulrättigheter'
    console.error('Failed to fetch module policies:', err)
  } finally {
    loading.value = false
  }
}

const updateModulePolicy = async (
  moduleId: string,
  enabled: boolean | undefined,
  disabled: boolean | undefined,
  permissionOverrides: Record<string, boolean> | undefined
) => {
  const currentOrgId = auth.currentOrg.value?.id
  if (!currentOrgId) return

  const policy = policies.value.find((p) => p.moduleId === moduleId)
  if (!policy) return

  // Store original values for rollback
  const originalEnabled = policy.enabled
  const originalDisabled = policy.disabled
  const originalOverrides = { ...policy.permissionOverrides }

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
  if (permissionOverrides !== undefined) {
    policy.permissionOverrides = { ...permissionOverrides }
  }

  try {
    await $fetch(`/api/organizations/${currentOrgId}/modules`, {
      method: 'PUT',
      body: {
        moduleId,
        enabled: enabled !== undefined ? enabled : policy.enabled,
        disabled: disabled !== undefined ? disabled : policy.disabled,
        permissionOverrides: permissionOverrides !== undefined ? permissionOverrides : policy.permissionOverrides
      }
    })
    // Refresh policies to get updated effective values
    await fetchPolicies()
  } catch (err: any) {
    error.value = err.message || 'Kunde inte uppdatera modulrättigheter'
    console.error('Failed to update module policy:', err)
    // Rollback on error
    policy.enabled = originalEnabled
    policy.disabled = originalDisabled
    policy.permissionOverrides = originalOverrides
  }
}

const updateModuleEnabled = async (moduleId: string, enabled: boolean) => {
  const policy = policies.value.find((p) => p.moduleId === moduleId)
  if (!policy) return
  await updateModulePolicy(moduleId, enabled, undefined, undefined)
}

const updateModuleDisabled = async (moduleId: string, disabled: boolean) => {
  await updateModulePolicy(moduleId, undefined, disabled, undefined)
}

const togglePermission = async (moduleId: string, permission: string, allowed: boolean) => {
  const policy = policies.value.find((p) => p.moduleId === moduleId)
  if (!policy) return

  const newOverrides = { ...policy.permissionOverrides }
  if (allowed) {
    // Remove override (allow default)
    delete newOverrides[permission]
  } else {
    // Set override to false
    newOverrides[permission] = false
  }

  await updateModulePolicy(moduleId, undefined, undefined, newOverrides)
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

const getRoleName = (role: string): string => {
  const roleNames: Record<string, string> = {
    owner: 'Ägare',
    admin: 'Administratör',
    member: 'Medlem',
    operator: 'Operatör',
    viewer: 'Visare'
  }
  return roleNames[role] || role
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

const toggleUserPermissions = async (moduleId: string) => {
  expandedModules.value[moduleId] = !expandedModules.value[moduleId]
  
  // Initialize search query if not exists
  if (!userSearchQueries.value[moduleId]) {
    userSearchQueries.value[moduleId] = ''
  }
  
  // Fetch users when expanding
  if (expandedModules.value[moduleId] && !userPermissions.value[moduleId]) {
    await fetchUsersForModule(moduleId)
  }
}

const fetchUsersForModule = async (moduleId: string) => {
  const currentOrgId = auth.currentOrg.value?.id
  if (!currentOrgId) return

  try {
    loadingUsers.value[moduleId] = true
    const response = await $fetch(`/api/organizations/${currentOrgId}/modules/${moduleId}/users`)
    userPermissions.value[moduleId] = response.users || []
  } catch (err: any) {
    console.error('Failed to fetch users for module:', err)
    error.value = err.message || 'Kunde inte hämta användare'
    userPermissions.value[moduleId] = []
  } finally {
    loadingUsers.value[moduleId] = false
  }
}

const toggleUserPermission = async (
  moduleId: string,
  userId: string,
  permission: string,
  allowed: boolean
) => {
  const currentOrgId = auth.currentOrg.value?.id
  if (!currentOrgId) return

  const key = `${moduleId}-${userId}`
  const user = userPermissions.value[moduleId]?.find((u) => u.userId === userId)
  if (!user) return

  // Store original state for rollback
  const originalDenied = [...user.deniedPermissions]

  // Optimistically update UI
  if (allowed) {
    user.deniedPermissions = user.deniedPermissions.filter((p) => p !== permission)
  } else {
    if (!user.deniedPermissions.includes(permission)) {
      user.deniedPermissions.push(permission)
    }
  }

  // Update effective permissions
  user.effectivePermissions = user.rolePermissions.filter(
    (p) => !user.deniedPermissions.includes(p)
  )

  try {
    updatingUsers.value[key] = true

    // Build denied permissions object
    const deniedPermissions: Record<string, boolean> = {}
    for (const perm of user.deniedPermissions) {
      deniedPermissions[perm] = true
    }

    await $fetch(`/api/organizations/${currentOrgId}/modules/${moduleId}/users/${userId}`, {
      method: 'PUT',
      body: {
        deniedPermissions
      }
    })

    // Refresh user permissions to get updated state
    await fetchUsersForModule(moduleId)
  } catch (err: any) {
    console.error('Failed to update user permission:', err)
    error.value = err.message || 'Kunde inte uppdatera användarrättighet'
    
    // Rollback on error
    user.deniedPermissions = originalDenied
    user.effectivePermissions = user.rolePermissions.filter(
      (p) => !user.deniedPermissions.includes(p)
    )
  } finally {
    updatingUsers.value[key] = false
  }
}

onMounted(async () => {
  // Wait for auth to be initialized before checking permissions
  if (!auth.state.value.initialized && !auth.state.value.loading) {
    await auth.bootstrap()
  }
  
  // Check if user has org:manage permission after auth is initialized
  if (auth.state.value.initialized && !hasPermission('org:manage')) {
    navigateTo('/settings', { replace: true })
    return
  }
  
  fetchPolicies()
})

// Refetch when organization changes
watch(() => auth.currentOrg.value?.id, () => {
  fetchPolicies()
  // Clear user permissions when org changes
  userPermissions.value = {}
  expandedModules.value = {}
  userSearchQueries.value = {}
})
</script>
