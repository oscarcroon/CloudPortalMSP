<template>
  <section class="space-y-6">
    <header class="space-y-2">
      <NuxtLink
        :to="`/admin/tenants/${tenantId}`"
        class="text-xs uppercase tracking-[0.3em] text-slate-400 transition hover:text-brand dark:text-slate-500"
      >
        ← {{ t('adminTenants.mspRoles.back') }}
      </NuxtLink>
      <div>
        <p class="text-xs uppercase tracking-[0.3em] text-slate-400 dark:text-slate-500">Superadmin</p>
        <h1 class="text-2xl font-semibold text-slate-900 dark:text-white">
          {{ t('adminTenants.mspRoles.title', { name: tenantName }) }}
        </h1>
        <p class="text-sm text-slate-600 dark:text-slate-400">
          {{ t('adminTenants.mspRoles.description') }}
        </p>
      </div>
    </header>

    <div v-if="errorMessage" class="rounded-lg bg-red-500/10 px-4 py-3 text-sm text-red-700 dark:text-red-300">
      {{ errorMessage }}
    </div>

    <div v-if="successMessage" class="rounded-lg bg-emerald-500/10 px-4 py-3 text-sm text-emerald-600 dark:text-emerald-300">
      {{ successMessage }}
    </div>

    <div class="flex items-center justify-between">
      <div class="text-xs text-slate-500 dark:text-slate-300">
        {{ t('adminTenants.mspRoles.results', { count: roles.length }) }}
      </div>
      <button
        class="inline-flex items-center gap-2 rounded-lg bg-brand px-4 py-2 text-sm font-semibold text-white transition hover:bg-brand/90"
        @click="openCreateModal"
      >
        <Icon icon="mdi:plus" class="h-4 w-4" />
        {{ t('adminTenants.mspRoles.create') }}
      </button>
    </div>

    <div v-if="pending" class="rounded-xl border border-dashed border-slate-200 p-6 text-sm text-slate-600 dark:border-white/10 dark:text-slate-300">
      {{ t('adminTenants.mspRoles.loading') }}
    </div>

    <div
      v-else-if="!roles.length"
      class="rounded-xl border border-slate-200 bg-white p-6 text-sm text-slate-600 shadow-sm dark:border-white/10 dark:bg-white/5 dark:text-slate-300"
    >
      {{ t('adminTenants.mspRoles.empty') }}
    </div>

    <div v-else class="space-y-3">
      <div
        v-for="role in roles"
        :key="role.id"
        class="rounded-xl border border-slate-200 bg-white p-4 shadow-sm transition hover:shadow dark:border-white/10 dark:bg-white/5"
      >
        <div class="flex items-start justify-between">
          <div class="flex-1 space-y-2">
            <div class="flex items-center gap-2">
              <p class="text-lg font-semibold text-slate-900 dark:text-white">{{ role.name }}</p>
              <span class="rounded bg-slate-100 px-2 py-0.5 text-xs font-mono text-slate-600 dark:bg-white/10 dark:text-slate-400">
                {{ role.key }}
              </span>
              <span v-if="role.isSystem" class="rounded bg-blue-100 px-2 py-0.5 text-xs font-semibold text-blue-700 dark:bg-blue-900/30 dark:text-blue-400">
                System
              </span>
              <span v-if="role.removedCount > 0" class="rounded bg-yellow-100 px-2 py-0.5 text-xs font-semibold text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-400">
                {{ t('adminTenants.mspRoles.removedPermissions', { count: role.removedCount }) }}
              </span>
            </div>
            <div v-if="role.usageCount > 0" class="text-xs text-slate-500 dark:text-slate-400">
              {{ t('adminTenants.mspRoles.usedBy', { count: role.usageCount }) }}
            </div>
            <p v-if="role.description" class="text-sm text-slate-600 dark:text-slate-400">
              {{ role.description }}
            </p>
            <div v-if="role.permissions.length" class="mt-3 space-y-2">
              <p class="text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">
                {{ t('adminTenants.mspRoles.permissions') }}
              </p>
              <div class="space-y-1">
                <div
                  v-for="(perms, moduleKey) in groupedPermissions(role.permissions)"
                  :key="moduleKey"
                  class="rounded border border-slate-200 bg-slate-50 p-2 text-xs dark:border-white/10 dark:bg-white/5"
                >
                  <p class="font-semibold text-slate-700 dark:text-slate-200">{{ moduleKey }}</p>
                  <div class="mt-1 flex flex-wrap gap-1">
                    <span
                      v-for="perm in perms"
                      :key="perm"
                      class="rounded bg-white px-2 py-0.5 text-slate-600 dark:bg-black/20 dark:text-slate-300"
                    >
                      {{ perm }}
                    </span>
                  </div>
                </div>
              </div>
            </div>
            <div v-else class="mt-2 text-xs text-slate-500 dark:text-slate-400">
              {{ t('adminTenants.mspRoles.noPermissions') }}
            </div>
          </div>
          <div class="ml-4 flex gap-2">
            <button
              class="rounded-lg border border-slate-300 px-3 py-1.5 text-xs font-medium text-slate-700 transition hover:bg-slate-50 dark:border-white/10 dark:text-slate-200 dark:hover:bg-white/10"
              @click="openEditModal(role)"
            >
              {{ t('adminTenants.mspRoles.edit') }}
            </button>
            <button
              class="rounded-lg border border-red-300 px-3 py-1.5 text-xs font-medium text-red-700 transition hover:bg-red-50 dark:border-red-500/50 dark:text-red-400 dark:hover:bg-red-500/10"
              @click="deleteRole(role)"
            >
              {{ t('adminTenants.mspRoles.delete') }}
            </button>
          </div>
        </div>
      </div>
    </div>

    <!-- Create/Edit Modal -->
    <div
      v-if="showModal"
      class="fixed inset-0 z-50 flex items-center justify-center bg-black/40 px-4 py-8"
    >
      <div class="w-full max-w-4xl max-h-[90vh] overflow-y-auto rounded-2xl border border-slate-200 bg-white p-6 shadow-2xl dark:border-white/10 dark:bg-[#0f172a]">
        <div class="flex items-center justify-between mb-4">
          <h3 class="text-lg font-semibold text-slate-900 dark:text-white">
            {{ editingRole ? t('adminTenants.mspRoles.editTitle') : t('adminTenants.mspRoles.createTitle') }}
          </h3>
          <button
            class="rounded-lg p-1 text-slate-400 transition hover:bg-slate-100 hover:text-slate-600 dark:hover:bg-white/10 dark:hover:text-slate-200"
            @click="closeModal"
          >
            <Icon icon="mdi:close" class="h-5 w-5" />
          </button>
        </div>

        <div class="space-y-4">
          <!-- Role Name -->
          <div>
            <label class="text-xs uppercase tracking-wide text-slate-500 dark:text-slate-400">
              {{ t('adminTenants.mspRoles.form.name') }}
            </label>
            <input
              v-model="form.name"
              type="text"
              class="mt-1 w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 placeholder:text-slate-400 focus:border-brand focus:outline-none focus:ring-1 focus:ring-brand dark:border-white/10 dark:bg-black/20 dark:text-white"
              :placeholder="t('adminTenants.mspRoles.form.namePlaceholder')"
            />
          </div>

          <!-- Description -->
          <div>
            <label class="text-xs uppercase tracking-wide text-slate-500 dark:text-slate-400">
              {{ t('adminTenants.mspRoles.form.description') }}
            </label>
            <textarea
              v-model="form.description"
              rows="2"
              class="mt-1 w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 placeholder:text-slate-400 focus:border-brand focus:outline-none focus:ring-1 focus:ring-brand dark:border-white/10 dark:bg-black/20 dark:text-white"
              :placeholder="t('adminTenants.mspRoles.form.descriptionPlaceholder')"
            />
          </div>

          <!-- Permissions Selection -->
          <div>
            <label class="text-xs uppercase tracking-wide text-slate-500 dark:text-slate-400">
              {{ t('adminTenants.mspRoles.form.permissions') }}
            </label>
            <p class="mt-1 mb-3 text-xs text-slate-500 dark:text-slate-400">
              {{ t('adminTenants.mspRoles.form.permissionsHint') }}
            </p>

            <div v-if="availablePermissionsLoading" class="py-4 text-center text-sm text-slate-500 dark:text-slate-400">
              {{ t('adminTenants.mspRoles.loadingPermissions') }}
            </div>

            <div v-else-if="availablePermissions.length === 0" class="py-4 text-center text-sm text-slate-500 dark:text-slate-400">
              {{ t('adminTenants.mspRoles.noAvailablePermissions') }}
            </div>

            <div v-else>
              <div class="mb-2">
                <input
                  v-model="moduleSearchQuery"
                  type="text"
                  class="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 placeholder:text-slate-400 focus:border-brand focus:outline-none focus:ring-1 focus:ring-brand dark:border-white/10 dark:bg-black/20 dark:text-white"
                  :placeholder="t('adminTenants.mspRoles.form.searchPlaceholder', { default: 'Sök moduler eller rättigheter...' })"
                />
              </div>
              <div class="mt-2 space-y-3 max-h-96 overflow-y-auto rounded-lg border border-slate-200 p-3 dark:border-white/10 dark:bg-white/5">
                <div v-if="filteredModuleList.length === 0" class="py-4 text-center text-sm text-slate-500 dark:text-slate-400">
                  {{ t('adminTenants.mspRoles.form.noResults') }}
                </div>
                <details
                  v-for="module in filteredModuleList"
                  :key="module.moduleKey"
                  :open="moduleSearchQuery.trim() !== ''"
                  class="group rounded-lg bg-white p-3 dark:bg-black/20"
                >
                  <summary class="flex cursor-pointer items-center justify-between gap-2 text-sm font-semibold text-slate-800 dark:text-slate-100 hover:bg-slate-50 dark:hover:bg-white/5 rounded px-2 py-1 -mx-2 -my-1 transition-colors">
                    <div class="flex items-center gap-2 flex-1 min-w-0">
                      <Icon icon="mdi:chevron-down" class="chevron-icon h-4 w-4 text-slate-400 transition-transform duration-200 flex-shrink-0" />
                      <span class="truncate">{{ module.moduleName }}</span>
                    </div>
                    <div class="flex items-center gap-2 flex-shrink-0">
                      <span class="text-xs text-slate-500 whitespace-nowrap">{{ module.permissions.length }} st</span>
                      <button
                        type="button"
                        class="text-xs text-slate-500 hover:text-slate-700 dark:text-slate-400 dark:hover:text-slate-200"
                        @click.stop="toggleModule(module.moduleKey)"
                      >
                        {{ isModuleFullySelected(module) ? t('adminTenants.mspRoles.deselectAll') : t('adminTenants.mspRoles.selectAll') }}
                      </button>
                    </div>
                  </summary>
                  <div class="mt-3 space-y-2">
                    <label
                      v-for="perm in module.permissions"
                      :key="perm.key"
                      class="flex items-start gap-2 text-sm text-slate-700 dark:text-slate-200"
                    >
                      <input
                        type="checkbox"
                        :checked="isPermissionSelected(module.moduleKey, perm.key)"
                        class="mt-1 rounded border-slate-300 text-brand focus:ring-brand dark:border-white/20"
                        @change="togglePermission(module.moduleKey, perm.key, $event)"
                      />
                      <div class="flex-1">
                        <div class="flex items-center gap-2">
                          <p class="font-semibold">{{ perm.key }}</p>
                          <span
                            v-if="!perm.isActive || perm.status === 'removed'"
                            class="rounded bg-yellow-100 px-1.5 py-0.5 text-[10px] font-semibold text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-400"
                          >
                            {{ t('adminTenants.mspRoles.removed') }}
                          </span>
                          <span
                            v-else-if="perm.status === 'deprecated'"
                            class="rounded bg-orange-100 px-1.5 py-0.5 text-[10px] font-semibold text-orange-700 dark:bg-orange-900/30 dark:text-orange-400"
                          >
                            {{ t('adminTenants.mspRoles.deprecated') }}
                          </span>
                        </div>
                        <p v-if="perm.description" class="text-xs text-slate-500 dark:text-slate-400">
                          {{ perm.description }}
                        </p>
                      </div>
                    </label>
                  </div>
                </details>
              </div>
            </div>
          </div>
        </div>

        <div class="mt-6 flex justify-end gap-2">
          <button
            type="button"
            class="rounded-lg border border-slate-300 px-4 py-2 text-sm font-semibold text-slate-700 transition hover:bg-slate-50 disabled:opacity-50 dark:border-white/10 dark:text-slate-200 dark:hover:bg-white/10"
            :disabled="saving"
            @click="closeModal"
          >
            {{ t('adminTenants.mspRoles.cancel') }}
          </button>
          <button
            type="button"
            class="rounded-lg bg-brand px-4 py-2 text-sm font-semibold text-white transition hover:bg-brand/80 disabled:opacity-60"
            :disabled="saving || !form.name"
            @click="saveRole"
          >
            {{ saving ? t('adminTenants.mspRoles.saving') : t('adminTenants.mspRoles.save') }}
          </button>
        </div>
      </div>
    </div>
  </section>
</template>

<script setup lang="ts">
import { computed, reactive, ref, useFetch, useRoute, useI18n } from '#imports'
import { Icon } from '@iconify/vue'

const { t } = useI18n()

interface MspRole {
  id: string
  key: string
  name: string
  description: string | null
  isSystem: boolean
  permissions: Array<{ moduleKey: string; permissionKey: string }>
  usageCount: number
  removedCount: number
  createdAt: string | null
  updatedAt: string | null
}

interface AvailablePermission {
  moduleKey: string
  moduleName: string
  permissions: Array<{
    key: string
    description?: string | null
    isActive: boolean
    status: 'active' | 'deprecated' | 'removed'
  }>
}

const route = useRoute()
const tenantId = computed(() => route.params.id as string)

const { data, pending, refresh, error } = await useFetch<{ roles: MspRole[] }>(
  `/api/admin/tenants/${tenantId.value}/msp-roles`,
  {
    watch: [tenantId]
  }
)

const { data: availablePermissionsData, pending: availablePermissionsLoading } = await useFetch<{ permissions: AvailablePermission[] }>(
  `/api/admin/tenants/${tenantId.value}/msp-roles/available-permissions`,
  {
    watch: [tenantId]
  }
)

const roles = computed(() => data.value?.roles ?? [])
const availablePermissions = computed(() => availablePermissionsData.value?.permissions ?? [])
const tenantName = computed(() => route.query.name as string || 'Tenant')

// Filter modules based on search query
const filteredModuleList = computed(() => {
  if (!availablePermissions.value || !Array.isArray(availablePermissions.value)) {
    return []
  }
  
  if (!moduleSearchQuery.value.trim()) {
    return availablePermissions.value
  }
  
  const query = moduleSearchQuery.value.trim().toLowerCase()
  
  return availablePermissions.value
    .map((module) => {
      if (!module || !module.moduleName || !module.moduleKey) {
        return null
      }
      
      // Check if module name matches
      const nameMatches = module.moduleName.toLowerCase().includes(query) || module.moduleKey.toLowerCase().includes(query)
      
      // Filter permissions that match
      const modulePermissions = Array.isArray(module.permissions) ? module.permissions : []
      const matchingPermissions = modulePermissions.filter((perm) => {
        if (!perm || !perm.key) return false
        const keyMatches = perm.key.toLowerCase().includes(query)
        const labelMatches = perm.description?.toLowerCase().includes(query) ?? false
        return keyMatches || labelMatches
      })
      
      // Include module if name matches OR if it has matching permissions
      if (nameMatches) {
        return { ...module, permissions: modulePermissions }
      } else if (matchingPermissions.length > 0) {
        return { ...module, permissions: matchingPermissions }
      }
      
      return null
    })
    .filter((module): module is NonNullable<typeof module> => module !== null)
})

const errorMessage = ref('')
const successMessage = ref('')
const showModal = ref(false)
const editingRole = ref<MspRole | null>(null)
const saving = ref(false)

const form = reactive({
  name: '',
  description: '',
  permissions: [] as Array<{ moduleKey: string; permissionKey: string }>
})

const moduleSearchQuery = ref('')

const groupedPermissions = (permissions: Array<{ moduleKey: string; permissionKey: string }>) => {
  const grouped: Record<string, string[]> = {}
  for (const perm of permissions) {
    if (!grouped[perm.moduleKey]) {
      grouped[perm.moduleKey] = []
    }
    grouped[perm.moduleKey].push(perm.permissionKey)
  }
  return grouped
}

const isPermissionSelected = (moduleKey: string, permissionKey: string): boolean => {
  return form.permissions.some(
    (p) => p.moduleKey === moduleKey && p.permissionKey === permissionKey
  )
}

const togglePermission = (moduleKey: string, permissionKey: string, event: Event) => {
  const checked = (event.target as HTMLInputElement).checked
  if (checked) {
    if (!isPermissionSelected(moduleKey, permissionKey)) {
      form.permissions.push({ moduleKey, permissionKey })
    }
  } else {
    form.permissions = form.permissions.filter(
      (p) => !(p.moduleKey === moduleKey && p.permissionKey === permissionKey)
    )
  }
}

const isModuleFullySelected = (module: AvailablePermission): boolean => {
  return module.permissions.every((perm) => isPermissionSelected(module.moduleKey, perm.key))
}

const toggleModule = (moduleKey: string) => {
  const module = availablePermissions.value.find((m) => m.moduleKey === moduleKey)
  if (!module) return

  const allSelected = isModuleFullySelected(module)
  
  if (allSelected) {
    // Deselect all
    form.permissions = form.permissions.filter((p) => p.moduleKey !== moduleKey)
  } else {
    // Select all
    for (const perm of module.permissions) {
      if (!isPermissionSelected(moduleKey, perm.key)) {
        form.permissions.push({ moduleKey, permissionKey: perm.key })
      }
    }
  }
}

const openCreateModal = () => {
  editingRole.value = null
  form.name = ''
  form.description = ''
  form.permissions = []
  moduleSearchQuery.value = ''
  showModal.value = true
}

const openEditModal = (role: MspRole) => {
  editingRole.value = role
  form.name = role.name
  form.description = role.description || ''
  form.permissions = [...role.permissions]
  moduleSearchQuery.value = ''
  showModal.value = true
}

const closeModal = () => {
  showModal.value = false
  editingRole.value = null
  form.name = ''
  form.description = ''
  form.permissions = []
  moduleSearchQuery.value = ''
}

const saveRole = async () => {
  saving.value = true
  errorMessage.value = ''
  successMessage.value = ''

  try {
    if (editingRole.value) {
      // Update
      await $fetch(`/api/admin/tenants/${tenantId.value}/msp-roles/${editingRole.value.id}`, {
        method: 'PUT',
        body: {
          name: form.name,
          description: form.description || null,
          permissions: form.permissions
        }
      })
      successMessage.value = t('adminTenants.mspRoles.messages.updated')
    } else {
      // Create - key will be auto-generated from name
      await $fetch(`/api/admin/tenants/${tenantId.value}/msp-roles`, {
        method: 'POST',
        body: {
          name: form.name,
          description: form.description || null,
          permissions: form.permissions
        }
      })
      successMessage.value = t('adminTenants.mspRoles.messages.created')
    }
    
    await refresh()
    closeModal()
    setTimeout(() => {
      successMessage.value = ''
    }, 3000)
  } catch (err) {
    errorMessage.value = err instanceof Error ? err.message : t('adminTenants.mspRoles.messages.error')
  } finally {
    saving.value = false
  }
}

const cloneRole = async (role: MspRole) => {
  errorMessage.value = ''
  successMessage.value = ''

  try {
    const result = await $fetch<{ role: MspRole }>(`/api/admin/tenants/${tenantId.value}/msp-roles/${role.id}/clone`, {
      method: 'POST'
    })
    successMessage.value = t('adminTenants.mspRoles.messages.cloned')
    await refresh()
    setTimeout(() => {
      successMessage.value = ''
    }, 3000)
  } catch (err) {
    errorMessage.value = err instanceof Error ? err.message : t('adminTenants.mspRoles.messages.cloneError')
  }
}

const deleteRole = async (role: MspRole) => {
  if (!confirm(t('adminTenants.mspRoles.deleteConfirm', { name: role.name }))) {
    return
  }

  errorMessage.value = ''
  successMessage.value = ''

  try {
    await $fetch(`/api/admin/tenants/${tenantId.value}/msp-roles/${role.id}`, {
      method: 'DELETE'
    })
    successMessage.value = t('adminTenants.mspRoles.messages.deleted')
    await refresh()
    setTimeout(() => {
      successMessage.value = ''
    }, 3000)
  } catch (err) {
    errorMessage.value = err instanceof Error ? err.message : t('adminTenants.mspRoles.messages.deleteError')
  }
}

if (error.value) {
  errorMessage.value = error.value.message
}
</script>

<style scoped>
/* Rotate chevron when details is open */
details[open] summary .chevron-icon {
  transform: rotate(180deg);
}
</style>
