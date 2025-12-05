<template>
  <section class="space-y-6">
    <header class="space-y-2">
      <NuxtLink
        :to="`/admin/tenants/${tenantId}`"
        class="text-xs uppercase tracking-[0.3em] text-slate-400 transition hover:text-brand dark:text-slate-500"
      >
        ← {{ t('adminTenants.modules.back') }}
      </NuxtLink>
      <div>
        <p class="text-xs uppercase tracking-[0.3em] text-slate-400 dark:text-slate-500">Superadmin</p>
        <h1 class="text-2xl font-semibold text-slate-900 dark:text-white">
          {{ t('adminTenants.modules.title', { name: tenantName }) }}
        </h1>
        <p class="text-sm text-slate-600 dark:text-slate-400">
          {{ t('adminTenants.modules.description') }}
        </p>
      </div>
    </header>

    <div v-if="modulesError" class="rounded-lg bg-red-500/10 px-4 py-3 text-sm text-red-700 dark:text-red-300">
      {{ modulesError }}
    </div>

    <div class="flex flex-col gap-3 rounded-xl border border-slate-200 bg-white p-4 shadow-sm dark:border-white/10 dark:bg-white/5 md:flex-row md:items-center md:justify-between">
      <div class="flex flex-1 flex-col gap-3 md:flex-row">
        <div class="relative flex-1">
          <input
            v-model="searchInput"
            type="text"
            class="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 pr-10 text-sm text-slate-900 focus:border-brand focus:outline-none focus:ring-1 focus:ring-brand dark:border-white/10 dark:bg-black/20 dark:text-white"
            :placeholder="t('adminTenants.modules.searchPlaceholder')"
          />
          <button
            v-if="searchInput"
            type="button"
            class="absolute right-2 top-1/2 -translate-y-1/2 rounded p-1 text-slate-400 transition hover:text-slate-600 dark:hover:text-slate-300"
            @click="searchInput = ''"
          >
            <Icon icon="mdi:close-circle" class="h-5 w-5" />
          </button>
        </div>
        <select
          v-model="categoryFilter"
          class="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 focus:border-brand focus:outline-none focus:ring-1 focus:ring-brand dark:border-white/10 dark:bg-black/20 dark:text-white md:w-48"
        >
          <option value="all">{{ t('adminTenants.modules.filters.allCategories') }}</option>
          <option v-for="category in categories" :key="category" :value="category">
            {{ category }}
          </option>
        </select>
      </div>
      <div class="text-xs text-slate-500 dark:text-slate-300">
        {{ t('adminTenants.modules.results', { count: filteredModules.length }) }}
      </div>
    </div>

    <div v-if="pending" class="rounded-xl border border-dashed border-slate-200 p-6 text-sm text-slate-600 dark:border-white/10 dark:text-slate-300">
      {{ t('adminTenants.modules.loading') }}
    </div>

    <div
      v-else-if="!filteredModules.length"
      class="rounded-xl border border-slate-200 bg-white p-6 text-sm text-slate-600 shadow-sm dark:border-white/10 dark:bg-white/5 dark:text-slate-300"
    >
      {{ t('adminTenants.modules.empty') }}
    </div>

    <div v-else class="space-y-3">
      <div
        v-for="module in filteredModules"
        :key="module.key"
        class="rounded-xl border border-slate-200 bg-white p-4 shadow-sm dark:border-white/10 dark:bg-white/5"
      >
        <div class="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
          <div class="space-y-2">
            <div class="flex items-center gap-2">
              <p class="text-lg font-semibold text-slate-900 dark:text-white">
                {{ module.name }}
              </p>
              <StatusPill :variant="statusVariant(module.status)">
                {{ t(`adminModules.status.${module.status ?? 'active'}`) }}
              </StatusPill>
              <span class="rounded-full bg-slate-100 px-3 py-1 text-xs text-slate-700 dark:bg-white/10 dark:text-slate-200">
                Layer: {{ module.layerKey }}
              </span>
            </div>
            <p class="text-sm text-slate-600 dark:text-slate-400">
              {{ module.description }}
            </p>
            <div class="flex flex-wrap gap-2">
              <span class="rounded-full bg-blue-50 px-3 py-1 text-xs font-medium text-blue-700 dark:bg-blue-900/40 dark:text-blue-100">
                {{ module.category }}
              </span>
              <span
                v-for="scope in module.scopes"
                :key="scope"
                class="rounded-full bg-slate-100 px-3 py-1 text-xs font-medium text-slate-700 dark:bg-white/10 dark:text-slate-200"
              >
                {{ t(`adminModules.scopes.${scope}`) }}
              </span>
              <span
                v-if="module.featureFlag"
                class="rounded-full bg-amber-50 px-3 py-1 text-xs font-medium text-amber-700 dark:bg-amber-900/40 dark:text-amber-100"
              >
                {{ module.featureFlag }}
              </span>
            </div>
            <div class="flex flex-wrap gap-2">
              <span
                v-for="permission in module.requiredPermissions"
                :key="permission"
                class="rounded-md border border-slate-200 bg-slate-50 px-2 py-1 text-[11px] text-slate-700 dark:border-white/10 dark:bg-white/5 dark:text-slate-200"
              >
                {{ permission }}
              </span>
            </div>
          </div>

          <div class="flex flex-col items-start gap-3 md:items-end">
            <div class="flex items-center gap-2">
              <label class="flex items-center gap-2 text-sm text-slate-700 dark:text-slate-200">
                <input
                  :checked="module.tenantEnabled"
                  type="checkbox"
                  class="h-4 w-4 rounded border-slate-300 text-brand focus:ring-brand dark:border-white/20"
                  @change="onToggleEnabled(module, ($event.target as HTMLInputElement).checked)"
                />
                <span>{{ t('adminTenants.modules.toggleEnabled') }}</span>
              </label>
            </div>
            <div class="flex items-center gap-2">
              <label class="flex items-center gap-2 text-sm text-slate-700 dark:text-slate-200">
                <input
                  :checked="module.tenantDisabled"
                  :disabled="!module.tenantEnabled"
                  type="checkbox"
                  class="h-4 w-4 rounded border-slate-300 text-amber-500 focus:ring-amber-500 disabled:opacity-50 dark:border-white/20"
                  @change="onToggleDisabled(module, ($event.target as HTMLInputElement).checked)"
                />
                <span>{{ t('adminTenants.modules.toggleDisabled') }}</span>
              </label>
            </div>
            <NuxtLink
              :to="module.rootRoute"
              class="inline-flex items-center gap-2 rounded-lg bg-brand px-4 py-2 text-sm font-semibold text-white shadow transition hover:bg-brand-600"
              target="_blank"
              rel="noopener"
            >
              <Icon icon="mdi:open-in-new" class="h-4 w-4" />
              {{ t('adminModules.openModule') }}
            </NuxtLink>
            <p class="text-xs text-slate-500 dark:text-slate-400">
              {{ t('adminTenants.modules.routeLabel') }} {{ module.rootRoute }}
            </p>
          </div>
        </div>
      </div>
    </div>
  </section>
</template>

<script setup lang="ts">
import { computed, ref, useFetch, useI18n, useRoute } from '#imports'
import { Icon } from '@iconify/vue'
import StatusPill from '~/components/shared/StatusPill.vue'
import type { ModuleStatus } from '~/lib/module-registry'

definePageMeta({
  layout: 'default'
})

const { t } = useI18n()
const route = useRoute()
const tenantId = computed(() => route.params.id as string)

interface TenantModuleDto {
  key: string
  name: string
  description: string
  category: string
  layerKey: string
  rootRoute: string
  scopes: string[]
  status?: ModuleStatus
  featureFlag?: string
  requiredPermissions: string[]
  tenantEnabled: boolean
  tenantDisabled: boolean
  effectiveEnabled: boolean
}

const {
  data: tenantResponse
} = await useFetch<{ tenant: { name: string } }>(() => `/api/admin/tenants/${tenantId.value}`)

const {
  data,
  pending,
  error,
  refresh
} = await useFetch<{ modules: TenantModuleDto[] }>(() =>
  tenantId.value ? `/api/admin/tenants/${tenantId.value}/modules` : null
)

const modules = computed(() => data.value?.modules ?? [])
const modulesError = computed(() => error.value?.message ?? '')
const tenantName = computed(() => tenantResponse.value?.tenant?.name ?? '...')

const searchInput = ref('')
const categoryFilter = ref<string>('all')

const categories = computed(() => {
  const unique = new Set(modules.value.map((module) => module.category))
  return Array.from(unique)
})

const normalize = (value: string) =>
  value
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .trim()

const filteredModules = computed(() => {
  const query = normalize(searchInput.value)
  return modules.value.filter((module) => {
    const matchesSearch =
      !query ||
      normalize(module.name).includes(query) ||
      normalize(module.description).includes(query) ||
      normalize(module.category).includes(query)

    const matchesCategory = categoryFilter.value === 'all' || module.category === categoryFilter.value
    return matchesSearch && matchesCategory
  })
})

const statusVariant = (status: ModuleStatus | undefined) => {
  switch (status) {
    case 'beta':
      return 'warning'
    case 'deprecated':
      return 'danger'
    case 'coming-soon':
      return 'info'
    default:
      return 'success'
  }
}

const updateModule = async (module: TenantModuleDto, payload: Record<string, any>) => {
  const originalEnabled = module.tenantEnabled
  const originalDisabled = module.tenantDisabled

  if (payload.enabled !== undefined) {
    module.tenantEnabled = payload.enabled
    if (!payload.enabled) {
      module.tenantDisabled = false
    }
  }
  if (payload.disabled !== undefined) {
    module.tenantDisabled = payload.disabled
  }

  try {
    const response = await $fetch<TenantModuleDto>(`/api/admin/tenants/${tenantId.value}/modules`, {
      method: 'PUT',
      body: {
        moduleId: module.key,
        ...payload
      }
    })
    module.tenantEnabled = response.tenantEnabled
    module.tenantDisabled = response.tenantDisabled
  } catch (err: any) {
    module.tenantEnabled = originalEnabled
    module.tenantDisabled = originalDisabled
    console.error('Failed to update module', err)
  } finally {
    await refresh()
  }
}

const onToggleEnabled = (module: TenantModuleDto, enabled: boolean) => {
  updateModule(module, { enabled })
}

const onToggleDisabled = (module: TenantModuleDto, disabled: boolean) => {
  updateModule(module, { disabled })
}
</script>

