<template>
  <section class="space-y-6">
    <header class="space-y-2">
      <NuxtLink
        :to="`/admin/tenants/${distributorId}`"
        class="text-xs uppercase tracking-[0.3em] text-slate-400 transition hover:text-brand dark:text-slate-500"
      >
        ← {{ t('adminDistributors.templates.back') }}
      </NuxtLink>
      <div>
        <p class="text-xs uppercase tracking-[0.3em] text-slate-400 dark:text-slate-500">
          {{ t('adminDistributors.templates.breadcrumb') }}
        </p>
        <h1 class="text-2xl font-semibold text-slate-900 dark:text-white">
          {{ t('adminDistributors.templates.title', { name: distributorName }) }}
        </h1>
        <p class="text-sm text-slate-600 dark:text-slate-400">
          {{ t('adminDistributors.templates.description') }}
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
      <div class="flex items-center gap-4">
        <div class="text-xs text-slate-500 dark:text-slate-300">
          {{ t('adminDistributors.templates.results', { count: templates.length }) }}
        </div>
        <label class="flex items-center gap-2 text-xs text-slate-500 dark:text-slate-400">
          <input
            v-model="showUnpublished"
            type="checkbox"
            class="rounded border-slate-300 text-brand focus:ring-brand dark:border-white/20"
          />
          {{ t('adminDistributors.templates.showUnpublished') }}
        </label>
      </div>
      <button
        class="inline-flex items-center gap-2 rounded-lg bg-brand px-4 py-2 text-sm font-semibold text-white transition hover:bg-brand/90"
        @click="openCreateModal"
      >
        <Icon icon="mdi:plus" class="h-4 w-4" />
        {{ t('adminDistributors.templates.create') }}
      </button>
    </div>

    <div v-if="pending" class="rounded-xl border border-dashed border-slate-200 p-6 text-sm text-slate-600 dark:border-white/10 dark:text-slate-300">
      {{ t('adminDistributors.templates.loading') }}
    </div>

    <div
      v-else-if="!templates.length"
      class="rounded-xl border border-slate-200 bg-white p-6 text-sm text-slate-600 shadow-sm dark:border-white/10 dark:bg-white/5 dark:text-slate-300"
    >
      {{ t('adminDistributors.templates.empty') }}
    </div>

    <div v-else class="space-y-3">
      <div
        v-for="template in templates"
        :key="template.id"
        class="rounded-xl border border-slate-200 bg-white p-4 shadow-sm transition hover:shadow dark:border-white/10 dark:bg-white/5"
      >
        <div class="flex items-start justify-between">
          <div class="flex-1 space-y-2">
            <div class="flex items-center gap-2 flex-wrap">
              <p class="text-lg font-semibold text-slate-900 dark:text-white">{{ template.name }}</p>
              <span class="rounded bg-slate-100 px-2 py-0.5 text-xs font-mono text-slate-600 dark:bg-white/10 dark:text-slate-400">
                {{ template.key }}
              </span>
              <span
                v-if="template.isPublished"
                class="rounded bg-emerald-100 px-2 py-0.5 text-xs font-semibold text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400"
              >
                {{ t('adminDistributors.templates.published') }}
              </span>
              <span
                v-else
                class="rounded bg-slate-100 px-2 py-0.5 text-xs font-semibold text-slate-500 dark:bg-white/10 dark:text-slate-400"
              >
                {{ t('adminDistributors.templates.unpublished') }}
              </span>
              <span class="rounded bg-blue-100 px-2 py-0.5 text-xs font-semibold text-blue-700 dark:bg-blue-900/30 dark:text-blue-400">
                v{{ template.templateVersion }}
              </span>
            </div>
            <div class="flex items-center gap-4 text-xs text-slate-500 dark:text-slate-400">
              <span v-if="template.usageCount > 0">
                {{ t('adminDistributors.templates.usedBy', { count: template.usageCount }) }}
              </span>
              <span>
                {{ t('adminDistributors.templates.permissionCount', { count: template.permissionCount }) }}
              </span>
            </div>
            <p v-if="template.description" class="text-sm text-slate-600 dark:text-slate-400">
              {{ template.description }}
            </p>
            <div v-if="template.permissionCount > 0" class="mt-3 space-y-2">
              <details class="group">
                <summary class="cursor-pointer text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-200">
                  {{ t('adminDistributors.templates.permissions') }}
                  <Icon icon="mdi:chevron-down" class="inline h-4 w-4 transition-transform group-open:rotate-180" />
                </summary>
                <div class="mt-2 space-y-1">
                  <div
                    v-for="(perms, moduleKey) in template.permissionsByModule"
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
              </details>
            </div>
            <div v-else class="mt-2 text-xs text-slate-500 dark:text-slate-400">
              {{ t('adminDistributors.templates.noPermissions') }}
            </div>
          </div>
          <div class="ml-4 flex gap-2">
            <button
              class="rounded-lg border border-slate-300 px-3 py-1.5 text-xs font-medium text-slate-700 transition hover:bg-slate-50 dark:border-white/10 dark:text-slate-200 dark:hover:bg-white/10"
              @click="openEditModal(template)"
            >
              {{ t('adminDistributors.templates.edit') }}
            </button>
            <button
              v-if="!template.isPublished"
              class="rounded-lg border border-emerald-300 px-3 py-1.5 text-xs font-medium text-emerald-700 transition hover:bg-emerald-50 dark:border-emerald-500/50 dark:text-emerald-400 dark:hover:bg-emerald-500/10"
              @click="publishTemplate(template)"
            >
              {{ t('adminDistributors.templates.publish') }}
            </button>
            <button
              v-else
              class="rounded-lg border border-amber-300 px-3 py-1.5 text-xs font-medium text-amber-700 transition hover:bg-amber-50 dark:border-amber-500/50 dark:text-amber-400 dark:hover:bg-amber-500/10"
              @click="unpublishTemplate(template)"
            >
              {{ t('adminDistributors.templates.unpublish') }}
            </button>
            <button
              v-if="template.usageCount === 0"
              class="rounded-lg border border-red-300 px-3 py-1.5 text-xs font-medium text-red-700 transition hover:bg-red-50 dark:border-red-500/50 dark:text-red-400 dark:hover:bg-red-500/10"
              @click="deleteTemplate(template)"
            >
              {{ t('adminDistributors.templates.delete') }}
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
            {{ editingTemplate ? t('adminDistributors.templates.editTitle') : t('adminDistributors.templates.createTitle') }}
          </h3>
          <button
            class="rounded-lg p-1 text-slate-400 transition hover:bg-slate-100 hover:text-slate-600 dark:hover:bg-white/10 dark:hover:text-slate-200"
            @click="closeModal"
          >
            <Icon icon="mdi:close" class="h-5 w-5" />
          </button>
        </div>

        <div class="space-y-4">
          <!-- Template Key (only for create) -->
          <div v-if="!editingTemplate">
            <label class="text-xs uppercase tracking-wide text-slate-500 dark:text-slate-400">
              {{ t('adminDistributors.templates.form.key') }}
            </label>
            <input
              v-model="form.key"
              type="text"
              class="mt-1 w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 placeholder:text-slate-400 focus:border-brand focus:outline-none focus:ring-1 focus:ring-brand dark:border-white/10 dark:bg-black/20 dark:text-white"
              :placeholder="t('adminDistributors.templates.form.keyPlaceholder')"
            />
            <p class="mt-1 text-xs text-slate-500 dark:text-slate-400">
              {{ t('adminDistributors.templates.form.keyHint') }}
            </p>
          </div>

          <!-- Template Name -->
          <div>
            <label class="text-xs uppercase tracking-wide text-slate-500 dark:text-slate-400">
              {{ t('adminDistributors.templates.form.name') }}
            </label>
            <input
              v-model="form.name"
              type="text"
              class="mt-1 w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 placeholder:text-slate-400 focus:border-brand focus:outline-none focus:ring-1 focus:ring-brand dark:border-white/10 dark:bg-black/20 dark:text-white"
              :placeholder="t('adminDistributors.templates.form.namePlaceholder')"
            />
          </div>

          <!-- Description -->
          <div>
            <label class="text-xs uppercase tracking-wide text-slate-500 dark:text-slate-400">
              {{ t('adminDistributors.templates.form.description') }}
            </label>
            <textarea
              v-model="form.description"
              rows="2"
              class="mt-1 w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 placeholder:text-slate-400 focus:border-brand focus:outline-none focus:ring-1 focus:ring-brand dark:border-white/10 dark:bg-black/20 dark:text-white"
              :placeholder="t('adminDistributors.templates.form.descriptionPlaceholder')"
            />
          </div>

          <!-- Permissions Selection -->
          <div>
            <label class="text-xs uppercase tracking-wide text-slate-500 dark:text-slate-400">
              {{ t('adminDistributors.templates.form.permissions') }}
            </label>
            <p class="mt-1 mb-3 text-xs text-slate-500 dark:text-slate-400">
              {{ t('adminDistributors.templates.form.permissionsHint') }}
            </p>

            <div v-if="availablePermissionsLoading" class="py-4 text-center text-sm text-slate-500 dark:text-slate-400">
              {{ t('adminDistributors.templates.loadingPermissions') }}
            </div>

            <div v-else-if="availablePermissions.length === 0" class="py-4 text-center text-sm text-slate-500 dark:text-slate-400">
              {{ t('adminDistributors.templates.noAvailablePermissions') }}
            </div>

            <div v-else>
              <div class="mb-2">
                <input
                  v-model="moduleSearchQuery"
                  type="text"
                  class="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 placeholder:text-slate-400 focus:border-brand focus:outline-none focus:ring-1 focus:ring-brand dark:border-white/10 dark:bg-black/20 dark:text-white"
                  :placeholder="t('adminDistributors.templates.form.searchPlaceholder')"
                />
              </div>
              <div class="mt-2 space-y-3 max-h-96 overflow-y-auto rounded-lg border border-slate-200 p-3 dark:border-white/10 dark:bg-white/5">
                <div v-if="filteredModuleList.length === 0" class="py-4 text-center text-sm text-slate-500 dark:text-slate-400">
                  {{ t('adminDistributors.templates.form.noResults') }}
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
                        {{ isModuleFullySelected(module) ? t('adminDistributors.templates.deselectAll') : t('adminDistributors.templates.selectAll') }}
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
                            {{ t('adminDistributors.templates.removed') }}
                          </span>
                          <span
                            v-else-if="perm.status === 'deprecated'"
                            class="rounded bg-orange-100 px-1.5 py-0.5 text-[10px] font-semibold text-orange-700 dark:bg-orange-900/30 dark:text-orange-400"
                          >
                            {{ t('adminDistributors.templates.deprecated') }}
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
            {{ t('adminDistributors.templates.cancel') }}
          </button>
          <button
            type="button"
            class="rounded-lg bg-brand px-4 py-2 text-sm font-semibold text-white transition hover:bg-brand/80 disabled:opacity-60"
            :disabled="saving || !form.name || (!editingTemplate && !form.key)"
            @click="saveTemplate"
          >
            {{ saving ? t('adminDistributors.templates.saving') : t('adminDistributors.templates.save') }}
          </button>
        </div>
      </div>
    </div>
  </section>
</template>

<script setup lang="ts">
import { computed, reactive, ref, watch } from 'vue'
import { useFetch, useRoute, useI18n } from '#imports'
import { Icon } from '@iconify/vue'

const { t } = useI18n()

interface MspTemplate {
  id: string
  key: string
  name: string
  description: string | null
  isPublished: boolean
  publishedAt: string | null
  templateVersion: number
  usageCount: number
  permissions: Array<{ moduleKey: string; permissionKey: string }>
  permissionsByModule: Record<string, string[]>
  permissionCount: number
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
const distributorId = computed(() => route.params.id as string)
const showUnpublished = ref(true)

// Fetch templates
const { data, pending, refresh, error } = await useFetch<{ templates: MspTemplate[] }>(
  () => `/api/admin/distributors/${distributorId.value}/msp-role-templates?includeUnpublished=${showUnpublished.value}`,
  {
    watch: [distributorId, showUnpublished]
  }
)

// Fetch available permissions (using the tenant endpoint since permissions are global)
const { data: availablePermissionsData, pending: availablePermissionsLoading } = await useFetch<{ permissions: AvailablePermission[] }>(
  () => `/api/admin/tenants/${distributorId.value}/msp-roles/available-permissions`,
  {
    watch: [distributorId]
  }
)

const templates = computed(() => data.value?.templates ?? [])
const availablePermissions = computed(() => availablePermissionsData.value?.permissions ?? [])
const distributorName = computed(() => route.query.name as string || 'Distributör')

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
      
      const nameMatches = module.moduleName.toLowerCase().includes(query) || module.moduleKey.toLowerCase().includes(query)
      const modulePermissions = Array.isArray(module.permissions) ? module.permissions : []
      const matchingPermissions = modulePermissions.filter((perm) => {
        if (!perm || !perm.key) return false
        const keyMatches = perm.key.toLowerCase().includes(query)
        const labelMatches = perm.description?.toLowerCase().includes(query) ?? false
        return keyMatches || labelMatches
      })
      
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
const editingTemplate = ref<MspTemplate | null>(null)
const saving = ref(false)
const moduleSearchQuery = ref('')

const form = reactive({
  key: '',
  name: '',
  description: '',
  permissions: [] as Array<{ moduleKey: string; permissionKey: string }>
})

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
    form.permissions = form.permissions.filter((p) => p.moduleKey !== moduleKey)
  } else {
    for (const perm of module.permissions) {
      if (!isPermissionSelected(moduleKey, perm.key)) {
        form.permissions.push({ moduleKey, permissionKey: perm.key })
      }
    }
  }
}

const openCreateModal = () => {
  editingTemplate.value = null
  form.key = ''
  form.name = ''
  form.description = ''
  form.permissions = []
  moduleSearchQuery.value = ''
  showModal.value = true
}

const openEditModal = (template: MspTemplate) => {
  editingTemplate.value = template
  form.key = template.key
  form.name = template.name
  form.description = template.description || ''
  form.permissions = [...template.permissions]
  moduleSearchQuery.value = ''
  showModal.value = true
}

const closeModal = () => {
  showModal.value = false
  editingTemplate.value = null
  form.key = ''
  form.name = ''
  form.description = ''
  form.permissions = []
  moduleSearchQuery.value = ''
}

const saveTemplate = async () => {
  saving.value = true
  errorMessage.value = ''
  successMessage.value = ''

  try {
    if (editingTemplate.value) {
      await $fetch(`/api/admin/distributors/${distributorId.value}/msp-role-templates/${editingTemplate.value.id}`, {
        method: 'PUT',
        body: {
          name: form.name,
          description: form.description || null,
          permissions: form.permissions
        }
      })
      successMessage.value = t('adminDistributors.templates.messages.updated')
    } else {
      await $fetch(`/api/admin/distributors/${distributorId.value}/msp-role-templates`, {
        method: 'POST',
        body: {
          key: form.key,
          name: form.name,
          description: form.description || null,
          permissions: form.permissions
        }
      })
      successMessage.value = t('adminDistributors.templates.messages.created')
    }
    
    await refresh()
    closeModal()
    setTimeout(() => {
      successMessage.value = ''
    }, 3000)
  } catch (err: any) {
    errorMessage.value = err?.data?.message || err?.message || t('adminDistributors.templates.messages.error')
  } finally {
    saving.value = false
  }
}

const publishTemplate = async (template: MspTemplate) => {
  errorMessage.value = ''
  successMessage.value = ''

  try {
    await $fetch(`/api/admin/distributors/${distributorId.value}/msp-role-templates/${template.id}/publish`, {
      method: 'POST'
    })
    successMessage.value = t('adminDistributors.templates.messages.published')
    await refresh()
    setTimeout(() => {
      successMessage.value = ''
    }, 3000)
  } catch (err: any) {
    errorMessage.value = err?.data?.message || err?.message || t('adminDistributors.templates.messages.publishError')
  }
}

const unpublishTemplate = async (template: MspTemplate) => {
  errorMessage.value = ''
  successMessage.value = ''

  try {
    await $fetch(`/api/admin/distributors/${distributorId.value}/msp-role-templates/${template.id}/unpublish`, {
      method: 'POST'
    })
    successMessage.value = t('adminDistributors.templates.messages.unpublished')
    await refresh()
    setTimeout(() => {
      successMessage.value = ''
    }, 3000)
  } catch (err: any) {
    errorMessage.value = err?.data?.message || err?.message || t('adminDistributors.templates.messages.unpublishError')
  }
}

const deleteTemplate = async (template: MspTemplate) => {
  if (!confirm(t('adminDistributors.templates.deleteConfirm', { name: template.name }))) {
    return
  }

  errorMessage.value = ''
  successMessage.value = ''

  try {
    await $fetch(`/api/admin/distributors/${distributorId.value}/msp-role-templates/${template.id}`, {
      method: 'DELETE'
    })
    successMessage.value = t('adminDistributors.templates.messages.deleted')
    await refresh()
    setTimeout(() => {
      successMessage.value = ''
    }, 3000)
  } catch (err: any) {
    errorMessage.value = err?.data?.message || err?.message || t('adminDistributors.templates.messages.deleteError')
  }
}

if (error.value) {
  errorMessage.value = error.value.message
}
</script>

<style scoped>
details[open] summary .chevron-icon {
  transform: rotate(180deg);
}
</style>
