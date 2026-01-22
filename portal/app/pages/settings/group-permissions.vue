<template>
  <section class="space-y-6">
    <header class="space-y-1">
      <p class="text-xs uppercase tracking-[0.3em] text-slate-400 dark:text-slate-500">
        {{ t('settings.administration') }}
      </p>
      <h1 class="text-2xl font-semibold text-slate-900 dark:text-white">
        {{ t('settings.groupPermissions.title') }}
      </h1>
      <p class="text-sm text-slate-600 dark:text-slate-400">
        {{ t('settings.groupPermissions.description') }}
      </p>
    </header>

    <div v-if="!currentOrgId" class="rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800 dark:border-amber-500/30 dark:bg-amber-500/10 dark:text-amber-100">
      {{ t('settings.groupPermissions.noOrg') }}
    </div>

    <template v-else>
      <!-- Info box explaining the permission system -->
      <div class="rounded-xl border border-blue-200 bg-blue-50 p-4 dark:border-blue-500/30 dark:bg-blue-500/10">
        <div class="flex gap-3">
          <Icon icon="mdi:information-outline" class="h-5 w-5 flex-shrink-0 text-blue-600 dark:text-blue-400" />
          <div class="space-y-2 text-sm text-blue-800 dark:text-blue-200">
            <p class="font-semibold">{{ t('settings.groupPermissions.help.title') }}</p>
            <ul class="space-y-1 text-blue-700 dark:text-blue-300">
              <li class="flex items-start gap-2">
                <span class="inline-block rounded bg-emerald-500 px-1.5 py-0.5 text-xs font-medium text-white">{{ t('settings.groupPermissions.grant') }}</span>
                <span>{{ t('settings.groupPermissions.help.grantDesc') }}</span>
              </li>
              <li class="flex items-start gap-2">
                <span class="inline-block rounded bg-red-500 px-1.5 py-0.5 text-xs font-medium text-white">{{ t('settings.groupPermissions.deny') }}</span>
                <span>{{ t('settings.groupPermissions.help.denyDesc') }}</span>
              </li>
              <li class="flex items-start gap-2">
                <span class="inline-block rounded bg-slate-200 px-1.5 py-0.5 text-xs font-medium text-slate-600 dark:bg-slate-600 dark:text-slate-200">{{ t('settings.groupPermissions.help.inherit') }}</span>
                <span>{{ t('settings.groupPermissions.help.inheritDesc') }}</span>
              </li>
            </ul>
          </div>
        </div>
      </div>

      <!-- Error message -->
      <div v-if="errorMessage" class="rounded-lg bg-red-500/10 px-4 py-3 text-sm text-red-700 dark:text-red-300">
        {{ errorMessage }}
      </div>

      <!-- Success message -->
      <div v-if="successMessage" class="rounded-lg bg-emerald-500/10 px-4 py-3 text-sm text-emerald-600 dark:text-emerald-300">
        {{ successMessage }}
      </div>

      <!-- Groups list -->
      <div class="flex items-center justify-between">
        <div class="text-xs text-slate-500 dark:text-slate-300">
          {{ t('settings.groupPermissions.results', { count: groups.length }) }}
        </div>
        <button
          class="inline-flex items-center gap-1 rounded border border-slate-200 bg-white px-3 py-1.5 text-xs font-semibold text-slate-700 shadow-sm transition hover:bg-slate-50 disabled:opacity-50 dark:border-white/10 dark:bg-white/5 dark:text-slate-100 dark:hover:bg-white/10"
          :disabled="loadingGroups"
          @click="fetchGroups"
        >
          <Icon icon="mdi:refresh" class="h-4 w-4" />
          {{ t('common.refresh') }}
        </button>
      </div>

      <div v-if="loadingGroups" class="rounded-xl border border-dashed border-slate-200 p-6 text-sm text-slate-600 dark:border-white/10 dark:text-slate-300">
        {{ t('settings.groupPermissions.loading') }}
      </div>

      <div v-else-if="groups.length === 0" class="rounded-xl border border-slate-200 bg-white p-6 text-sm text-slate-600 shadow-sm dark:border-white/10 dark:bg-white/5 dark:text-slate-300">
        {{ t('settings.groupPermissions.empty') }}
      </div>

      <div v-else class="space-y-3">
        <div
          v-for="group in groups"
          :key="group.id"
          class="rounded-xl border border-slate-200 bg-white shadow-sm transition dark:border-white/10 dark:bg-white/5"
        >
          <!-- Group header -->
          <div
            class="flex cursor-pointer items-center justify-between p-4"
            @click="toggleGroup(group.id)"
          >
            <div class="flex items-center gap-3">
              <Icon icon="mdi:account-group-outline" class="h-5 w-5 text-slate-500 dark:text-slate-400" />
              <div>
                <p class="font-semibold text-slate-900 dark:text-white">{{ group.name }}</p>
                <p v-if="group.description" class="text-xs text-slate-500 dark:text-slate-400">
                  {{ group.description }}
                </p>
              </div>
            </div>
            <div class="flex items-center gap-3">
              <span class="text-xs text-slate-500 dark:text-slate-400">
                {{ getPermissionCount(group.id) }} {{ t('settings.groupPermissions.permissionsSet') }}
              </span>
              <Icon
                :icon="expandedGroups[group.id] ? 'mdi:chevron-up' : 'mdi:chevron-down'"
                class="h-5 w-5 text-slate-400"
              />
            </div>
          </div>

          <!-- Group permissions (expandable) -->
          <div v-if="expandedGroups[group.id]" class="border-t border-slate-200 p-4 dark:border-white/10">
            <div v-if="loadingPermissions[group.id]" class="text-sm text-slate-500">
              {{ t('settings.groupPermissions.loadingPermissions') }}
            </div>

            <div v-else-if="groupPermissions[group.id]" class="space-y-4">
              <!-- Search and filter row -->
              <div class="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                <div class="flex-1 max-w-md">
                  <input
                    v-model="moduleSearch[group.id]"
                    type="text"
                    class="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 placeholder:text-slate-400 focus:border-brand focus:outline-none focus:ring-1 focus:ring-brand dark:border-white/10 dark:bg-black/20 dark:text-white"
                    :placeholder="t('settings.groupPermissions.searchModules')"
                  />
                </div>
                <label class="flex items-center gap-2 text-sm text-slate-600 dark:text-slate-400">
                  <input
                    v-model="showOnlyEnabled"
                    type="checkbox"
                    class="rounded border-slate-300 text-brand focus:ring-brand dark:border-white/20"
                  />
                  {{ t('settings.groupPermissions.showOnlyEnabled') }}
                </label>
              </div>

              <!-- Modules list -->
              <div class="space-y-2">
                <div
                  v-for="module in filteredModules(group.id)"
                  :key="module.id"
                  class="rounded-lg border border-slate-200 bg-slate-50 dark:border-white/10 dark:bg-white/5"
                >
                  <!-- Module header - always visible with quick actions -->
                  <div class="flex items-center justify-between p-3">
                    <div
                      class="flex flex-1 cursor-pointer items-center gap-2"
                      @click="toggleModule(group.id, module.id)"
                    >
                      <Icon
                        :icon="expandedModules[group.id]?.[module.id] ? 'mdi:chevron-down' : 'mdi:chevron-right'"
                        class="h-4 w-4 text-slate-400"
                      />
                      <Icon v-if="module.icon" :icon="module.icon" class="h-5 w-5 text-slate-600 dark:text-slate-400" />
                      <span class="font-semibold text-slate-800 dark:text-slate-100">{{ module.name }}</span>
                      <span
                        v-if="!module.isEnabled"
                        class="rounded bg-slate-200 px-2 py-0.5 text-xs text-slate-600 dark:bg-white/10 dark:text-slate-400"
                      >
                        {{ t('settings.groupPermissions.moduleDisabled') }}
                      </span>
                      <span class="text-xs text-slate-500 dark:text-slate-400">
                        ({{ getModulePermissionSummary(group.id, module) }})
                      </span>
                    </div>
                    <!-- Quick action buttons - always visible -->
                    <div class="flex gap-1">
                      <button
                        class="rounded px-2 py-1 text-xs font-medium text-emerald-700 hover:bg-emerald-100 dark:text-emerald-400 dark:hover:bg-emerald-900/30"
                        :title="t('settings.groupPermissions.grantAll')"
                        @click.stop="setAllPermissions(group.id, module.id, 'grant')"
                      >
                        <Icon icon="mdi:check-all" class="h-4 w-4" />
                      </button>
                      <button
                        class="rounded px-2 py-1 text-xs font-medium text-red-700 hover:bg-red-100 dark:text-red-400 dark:hover:bg-red-900/30"
                        :title="t('settings.groupPermissions.denyAll')"
                        @click.stop="setAllPermissions(group.id, module.id, 'deny')"
                      >
                        <Icon icon="mdi:close-circle-outline" class="h-4 w-4" />
                      </button>
                      <button
                        class="rounded px-2 py-1 text-xs font-medium text-slate-600 hover:bg-slate-100 dark:text-slate-400 dark:hover:bg-white/10"
                        :title="t('settings.groupPermissions.clearAll')"
                        @click.stop="setAllPermissions(group.id, module.id, null)"
                      >
                        <Icon icon="mdi:eraser" class="h-4 w-4" />
                      </button>
                    </div>
                  </div>

                  <!-- Permissions grid - expandable -->
                  <div
                    v-if="expandedModules[group.id]?.[module.id]"
                    class="border-t border-slate-200 p-3 dark:border-white/10"
                  >
                    <div class="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
                      <div
                        v-for="perm in module.permissions"
                        :key="perm.key"
                        class="flex items-center justify-between rounded bg-white px-3 py-2 dark:bg-black/20"
                      >
                        <div class="flex-1 min-w-0">
                          <p class="truncate text-sm font-medium text-slate-700 dark:text-slate-200">
                            {{ perm.label || formatPermissionKey(perm.key) }}
                          </p>
                          <p v-if="perm.description" class="truncate text-xs text-slate-500 dark:text-slate-400">
                            {{ perm.description }}
                          </p>
                        </div>
                        <div class="ml-2 flex gap-1">
                          <button
                            :class="[
                              'rounded px-2 py-1 text-xs font-medium transition',
                              getEffectiveEffect(group.id, perm.key, perm.effect) === 'grant'
                                ? 'bg-emerald-500 text-white'
                                : 'bg-slate-100 text-slate-600 hover:bg-emerald-100 hover:text-emerald-700 dark:bg-white/10 dark:text-slate-400 dark:hover:bg-emerald-900/30 dark:hover:text-emerald-400'
                            ]"
                            @click="togglePermission(group.id, module.id, perm.key, 'grant')"
                          >
                            {{ t('settings.groupPermissions.grant') }}
                          </button>
                          <button
                            :class="[
                              'rounded px-2 py-1 text-xs font-medium transition',
                              getEffectiveEffect(group.id, perm.key, perm.effect) === 'deny'
                                ? 'bg-red-500 text-white'
                                : 'bg-slate-100 text-slate-600 hover:bg-red-100 hover:text-red-700 dark:bg-white/10 dark:text-slate-400 dark:hover:bg-red-900/30 dark:hover:text-red-400'
                            ]"
                            @click="togglePermission(group.id, module.id, perm.key, 'deny')"
                          >
                            {{ t('settings.groupPermissions.deny') }}
                          </button>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              <!-- No results -->
              <div
                v-if="filteredModules(group.id).length === 0"
                class="rounded-lg border border-dashed border-slate-200 p-4 text-center text-sm text-slate-500 dark:border-white/10 dark:text-slate-400"
              >
                {{ t('settings.groupPermissions.noModulesFound') }}
              </div>

              <!-- Save button -->
              <div class="flex items-center justify-end gap-3 pt-2">
                <span v-if="Object.keys(pendingChanges[group.id] || {}).length > 0" class="text-xs text-amber-600 dark:text-amber-400">
                  {{ t('settings.groupPermissions.unsavedChanges', { count: Object.keys(pendingChanges[group.id] || {}).length }) }}
                </span>
                <button
                  class="inline-flex items-center gap-2 rounded-lg bg-brand px-4 py-2 text-sm font-semibold text-white transition hover:bg-brand/90 disabled:opacity-50"
                  :disabled="savingPermissions[group.id] || Object.keys(pendingChanges[group.id] || {}).length === 0"
                  @click="savePermissions(group.id)"
                >
                  <Icon v-if="savingPermissions[group.id]" icon="mdi:loading" class="h-4 w-4 animate-spin" />
                  {{ t('settings.groupPermissions.save') }}
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>
    </template>
  </section>
</template>

<script setup lang="ts">
import { Icon } from '@iconify/vue'
import { computed, ref, reactive, watch } from 'vue'
import { useI18n } from '#imports'
import { useAuth } from '~/composables/useAuth'

const { t } = useI18n()
const auth = useAuth()
const currentOrgId = computed(() => auth.currentOrg.value?.id)
const authReady = computed(() => auth.initialized.value)

// State
const loadingGroups = ref(false)
const errorMessage = ref('')
const successMessage = ref('')

interface GroupBasic {
  id: string
  name: string
  description: string | null
  slug?: string
}

interface ModulePermission {
  key: string
  description?: string
  label?: string
  action: string
  effect: 'grant' | 'deny' | null
}

interface ModuleWithPermissions {
  id: string
  name: string
  description: string
  category: string
  icon?: string
  riskClass: 'high' | 'medium' | 'low'
  isEnabled: boolean
  permissions: ModulePermission[]
}

interface GroupPermissionsData {
  group: GroupBasic
  modules: ModuleWithPermissions[]
}

const groups = ref<GroupBasic[]>([])
const expandedGroups = reactive<Record<string, boolean>>({})
const expandedModules = reactive<Record<string, Record<string, boolean>>>({})
const loadingPermissions = reactive<Record<string, boolean>>({})
const savingPermissions = reactive<Record<string, boolean>>({})
const groupPermissions = reactive<Record<string, GroupPermissionsData>>({})
const pendingChanges = reactive<Record<string, Record<string, 'grant' | 'deny' | null>>>({})
const showOnlyEnabled = ref(true)
const moduleSearch = reactive<Record<string, string>>({})

// Fetch groups
const fetchGroups = async () => {
  if (!currentOrgId.value) return
  loadingGroups.value = true
  errorMessage.value = ''
  
  try {
    const res = await $fetch<{ groups: GroupBasic[] }>(`/api/organizations/${currentOrgId.value}/groups`)
    groups.value = res.groups
  } catch (error: any) {
    errorMessage.value = error?.data?.message || error?.message || 'Could not load groups'
  } finally {
    loadingGroups.value = false
  }
}

// Fetch permissions for a specific group
const fetchGroupPermissions = async (groupId: string) => {
  if (!currentOrgId.value) return
  loadingPermissions[groupId] = true
  
  try {
    const res = await $fetch<GroupPermissionsData>(
      `/api/organizations/${currentOrgId.value}/groups/${groupId}/permissions`
    )
    groupPermissions[groupId] = res
    pendingChanges[groupId] = {}
    moduleSearch[groupId] = ''
    if (!expandedModules[groupId]) {
      expandedModules[groupId] = {}
    }
  } catch (error: any) {
    errorMessage.value = error?.data?.message || error?.message || 'Could not load permissions'
  } finally {
    loadingPermissions[groupId] = false
  }
}

// Toggle group expansion
const toggleGroup = async (groupId: string) => {
  expandedGroups[groupId] = !expandedGroups[groupId]
  
  if (expandedGroups[groupId] && !groupPermissions[groupId]) {
    await fetchGroupPermissions(groupId)
  }
}

// Toggle module expansion
const toggleModule = (groupId: string, moduleId: string) => {
  if (!expandedModules[groupId]) {
    expandedModules[groupId] = {}
  }
  expandedModules[groupId][moduleId] = !expandedModules[groupId][moduleId]
}

// Filter modules based on enabled status and search
const filteredModules = (groupId: string): ModuleWithPermissions[] => {
  const data = groupPermissions[groupId]
  if (!data) return []
  
  let modules = data.modules
  
  // Filter by enabled status
  if (showOnlyEnabled.value) {
    modules = modules.filter(m => m.isEnabled)
  }
  
  // Filter by search
  const search = (moduleSearch[groupId] || '').toLowerCase().trim()
  if (search) {
    modules = modules.filter(m => 
      m.name.toLowerCase().includes(search) ||
      m.description.toLowerCase().includes(search) ||
      m.category.toLowerCase().includes(search)
    )
  }
  
  return modules
}

// Get permission count for a group
const getPermissionCount = (groupId: string): number => {
  const data = groupPermissions[groupId]
  if (!data) return 0
  
  let count = 0
  for (const module of data.modules) {
    for (const perm of module.permissions) {
      if (perm.effect) count++
    }
  }
  return count
}

// Get summary of module permissions (e.g., "3 granted, 1 denied")
const getModulePermissionSummary = (groupId: string, module: ModuleWithPermissions): string => {
  let granted = 0
  let denied = 0
  
  for (const perm of module.permissions) {
    const effect = getEffectiveEffect(groupId, perm.key, perm.effect)
    if (effect === 'grant') granted++
    else if (effect === 'deny') denied++
  }
  
  if (granted === 0 && denied === 0) {
    return t('settings.groupPermissions.noPermissions')
  }
  
  const parts = []
  if (granted > 0) parts.push(`${granted} ${t('settings.groupPermissions.granted')}`)
  if (denied > 0) parts.push(`${denied} ${t('settings.groupPermissions.denied')}`)
  return parts.join(', ')
}

// Get effective effect (considering pending changes)
const getEffectiveEffect = (groupId: string, permKey: string, originalEffect: 'grant' | 'deny' | null): 'grant' | 'deny' | null => {
  if (pendingChanges[groupId]?.[permKey] !== undefined) {
    return pendingChanges[groupId][permKey]
  }
  return originalEffect
}

// Format permission key for display
const formatPermissionKey = (key: string): string => {
  const parts = key.split(':')
  return parts[parts.length - 1]
    .replace(/-/g, ' ')
    .replace(/\b\w/g, c => c.toUpperCase())
}

// Toggle a single permission
const togglePermission = (groupId: string, moduleId: string, permKey: string, effect: 'grant' | 'deny') => {
  if (!pendingChanges[groupId]) {
    pendingChanges[groupId] = {}
  }
  
  const data = groupPermissions[groupId]
  if (!data) return
  
  const module = data.modules.find(m => m.id === moduleId)
  if (!module) return
  
  const perm = module.permissions.find(p => p.key === permKey)
  if (!perm) return
  
  const currentEffect = getEffectiveEffect(groupId, permKey, perm.effect)
  
  if (currentEffect === effect) {
    // Toggle off - set to null (inherit)
    pendingChanges[groupId][permKey] = null
  } else {
    pendingChanges[groupId][permKey] = effect
  }
}

// Set all permissions for a module
const setAllPermissions = (groupId: string, moduleId: string, effect: 'grant' | 'deny' | null) => {
  // Ensure permissions are loaded
  if (!groupPermissions[groupId]) {
    // Need to load permissions first
    fetchGroupPermissions(groupId).then(() => {
      applyAllPermissions(groupId, moduleId, effect)
    })
    return
  }
  
  applyAllPermissions(groupId, moduleId, effect)
}

const applyAllPermissions = (groupId: string, moduleId: string, effect: 'grant' | 'deny' | null) => {
  const data = groupPermissions[groupId]
  if (!data) return
  
  const module = data.modules.find(m => m.id === moduleId)
  if (!module) return
  
  if (!pendingChanges[groupId]) {
    pendingChanges[groupId] = {}
  }
  
  for (const perm of module.permissions) {
    pendingChanges[groupId][perm.key] = effect
  }
}

// Save permissions for a group
const savePermissions = async (groupId: string) => {
  if (!currentOrgId.value) return
  
  const changes = pendingChanges[groupId]
  if (!changes || Object.keys(changes).length === 0) return
  
  const data = groupPermissions[groupId]
  if (!data) return
  
  savingPermissions[groupId] = true
  errorMessage.value = ''
  successMessage.value = ''
  
  try {
    // Build permissions array with module keys
    const permissions: { moduleKey: string; permissionKey: string; effect: 'grant' | 'deny' | null }[] = []
    
    for (const module of data.modules) {
      for (const perm of module.permissions) {
        if (changes[perm.key] !== undefined) {
          permissions.push({
            moduleKey: module.id,
            permissionKey: perm.key,
            effect: changes[perm.key]
          })
        }
      }
    }
    
    await $fetch(`/api/organizations/${currentOrgId.value}/groups/${groupId}/permissions`, {
      method: 'PUT',
      body: { permissions }
    })
    
    // Refresh permissions
    await fetchGroupPermissions(groupId)
    successMessage.value = t('settings.groupPermissions.saved')
    
    setTimeout(() => {
      successMessage.value = ''
    }, 3000)
  } catch (error: any) {
    errorMessage.value = error?.data?.message || error?.message || 'Could not save permissions'
  } finally {
    savingPermissions[groupId] = false
  }
}

// Watch for auth to be ready and org to be selected
watch(
  [authReady, currentOrgId],
  ([ready, orgId]) => {
    if (ready && orgId && groups.value.length === 0 && !loadingGroups.value) {
      fetchGroups()
    }
  },
  { immediate: true }
)

// Also watch for org changes to refetch
watch(currentOrgId, (newOrgId, oldOrgId) => {
  if (newOrgId && newOrgId !== oldOrgId) {
    // Reset state when org changes
    groups.value = []
    Object.keys(expandedGroups).forEach(k => delete expandedGroups[k])
    Object.keys(groupPermissions).forEach(k => delete groupPermissions[k])
    Object.keys(pendingChanges).forEach(k => delete pendingChanges[k])
    fetchGroups()
  }
})
</script>
