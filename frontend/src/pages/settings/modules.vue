<template>
  <section class="space-y-8">
    <header class="space-y-1">
      <p class="text-xs uppercase tracking-[0.3em] text-slate-400 dark:text-slate-500">Inställningar</p>
      <h1 class="text-2xl font-semibold text-slate-900 dark:text-white">Modulrättigheter</h1>
      <p class="text-sm text-slate-600 dark:text-slate-400">
        Hantera vilka moduler som är synliga och vilka rättigheter som är tillgängliga för din organisation.
      </p>
    </header>

    <div v-if="loading" class="flex items-center justify-center py-12">
      <div class="h-8 w-8 animate-spin rounded-full border-4 border-brand border-t-transparent" />
    </div>

    <div v-else-if="error" class="rounded-xl border border-red-200 bg-red-50 p-4 dark:border-red-800 dark:bg-red-900/20">
      <p class="text-sm text-red-800 dark:text-red-200">{{ error }}</p>
    </div>

    <div v-else class="space-y-6">
      <div
        v-for="policy in policies"
        :key="policy.moduleId"
        class="rounded-xl border border-slate-200 bg-white shadow-sm dark:border-white/10 dark:bg-[#0c1524]"
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
            <label class="relative inline-flex cursor-pointer items-center">
              <input
                v-model="policy.enabled"
                type="checkbox"
                class="peer sr-only"
                @change="updateModulePolicy(policy.moduleId, policy.enabled, policy.permissionOverrides)"
              />
              <div
                class="peer h-6 w-11 rounded-full bg-slate-300 transition-colors after:absolute after:left-[2px] after:top-[2px] after:h-5 after:w-5 after:rounded-full after:bg-white after:transition-all after:content-[''] peer-checked:bg-brand peer-checked:after:translate-x-full peer-focus:ring-2 peer-focus:ring-brand dark:bg-slate-600"
              />
            </label>
          </div>
        </div>

        <div v-if="policy.enabled && policy.module.permissions.length > 0" class="p-6">
          <p class="mb-4 text-sm font-medium text-slate-700 dark:text-slate-300">Rättigheter</p>
          <div class="space-y-3">
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
                  v-model="policy.permissionOverrides"
                  :value="permission"
                  type="checkbox"
                  class="peer sr-only"
                  :checked="policy.permissionOverrides[permission] !== false"
                  @change="togglePermission(policy.moduleId, permission, $event.target.checked)"
                />
                <div
                  class="peer h-5 w-9 rounded-full bg-slate-300 transition-colors after:absolute after:left-[2px] after:top-[2px] after:h-4 after:w-4 after:rounded-full after:bg-white after:transition-all after:content-[''] peer-checked:bg-green-500 peer-checked:after:translate-x-full peer-focus:ring-2 peer-focus:ring-green-500 dark:bg-slate-600"
                />
              </label>
            </label>
          </div>
        </div>
      </div>
    </div>
  </section>
</template>

<script setup lang="ts">
import { ref, onMounted } from 'vue'
import { Icon } from '@iconify/vue'
import { useAuth } from '~/composables/useAuth'
import { usePermission } from '~/composables/usePermission'

definePageMeta({
  layout: 'default',
  middleware: 'auth'
})

const auth = useAuth()
const { hasPermission } = usePermission()

// Check if user has org:manage permission
if (!hasPermission('org:manage')) {
  throw createError({
    statusCode: 403,
    message: 'Du saknar behörighet att hantera modulrättigheter'
  })
}

interface ModulePolicy {
  moduleId: string
  module: {
    id: string
    name: string
    description: string
    category: string
    permissions: string[]
  }
  enabled: boolean
  permissionOverrides: Record<string, boolean>
}

const policies = ref<ModulePolicy[]>([])
const loading = ref(true)
const error = ref<string | null>(null)

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
  enabled: boolean,
  permissionOverrides: Record<string, boolean>
) => {
  const currentOrgId = auth.currentOrg.value?.id
  if (!currentOrgId) return

  try {
    await $fetch(`/api/organizations/${currentOrgId}/modules`, {
      method: 'PUT',
      body: {
        moduleId,
        enabled,
        permissionOverrides
      }
    })
    // Refresh policies to get updated effective values
    await fetchPolicies()
  } catch (err: any) {
    error.value = err.message || 'Kunde inte uppdatera modulrättigheter'
    console.error('Failed to update module policy:', err)
    // Revert on error
    await fetchPolicies()
  }
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

  await updateModulePolicy(moduleId, policy.enabled, newOverrides)
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

onMounted(() => {
  fetchPolicies()
})

// Refetch when organization changes
watch(() => auth.currentOrg.value?.id, () => {
  fetchPolicies()
})
</script>

