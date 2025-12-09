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
              <Icon
                v-if="module.icon"
                :icon="module.icon"
                class="h-6 w-6 flex-shrink-0 text-brand"
              />
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
            <div class="flex flex-col gap-2 rounded-lg border border-slate-200 p-3 dark:border-white/10">
              <p class="text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-300">
                {{ t('adminTenants.modules.policyTitle') }}
              </p>
              <div class="flex flex-col gap-2">
                <label
                  v-for="option in modeOptions"
                  :key="option.value"
                  class="flex items-center gap-2 text-sm text-slate-700 dark:text-slate-200"
                >
                  <input
                    :checked="module.uiMode === option.value"
                    :disabled="module.updating"
                    type="radio"
                    class="h-4 w-4 text-brand focus:ring-brand dark:border-white/20"
                    :value="option.value"
                    :name="`policy-${module.key}`"
                    @change="onModeChange(module, option.value as PolicyMode)"
                  />
                  <span>{{ t(`adminTenants.modules.modes.${option.value}`) }}</span>
                </label>
              </div>
              <div v-if="module.uiMode === 'allowlist'" class="space-y-1">
                <div class="mt-3 space-y-2 rounded-lg border border-slate-200 bg-slate-50 p-3 text-xs dark:border-white/10 dark:bg-white/5">
                  <div class="flex items-center justify-between">
                    <span class="font-semibold text-slate-700 dark:text-slate-200">Permissions (manifest)</span>
                    <button
                      class="rounded border border-slate-200 px-2 py-1 text-[11px] font-semibold text-slate-700 transition hover:bg-white dark:border-white/10 dark:text-slate-100 dark:hover:bg-white/10"
                      :disabled="permissionState(module.key).loading"
                      @click="loadModulePermissions(module)"
                    >
                      {{ permissionState(module.key).items.length ? t('common.refresh') : t('common.load') }}
                    </button>
                  </div>
                  <p v-if="permissionState(module.key).error" class="text-red-600 dark:text-red-300">
                    {{ permissionState(module.key).error }}
                  </p>
                  <p v-else-if="permissionState(module.key).loading" class="text-slate-500 dark:text-slate-400">
                    {{ t('adminTenants.modules.loadingPermissions') }}
                  </p>
                  <div v-else-if="!permissionState(module.key).items.length" class="text-slate-500 dark:text-slate-400">
                    {{ t('adminTenants.modules.noPermissions') }}
                  </div>
                  <div v-else class="grid grid-cols-1 gap-2 md:grid-cols-2">
                    <label
                      v-for="perm in permissionState(module.key).items"
                      :key="perm.key"
                      class="flex items-start gap-2 rounded-md border border-slate-200 bg-white px-2 py-1 text-[11px] text-slate-700 shadow-sm dark:border-white/10 dark:bg-slate-900 dark:text-slate-200"
                    >
                      <input
                        type="checkbox"
                        class="mt-1 h-4 w-4 text-brand focus:ring-brand dark:border-white/20"
                        :checked="module.uiAllowedPermissions.includes(perm.key)"
                        :disabled="module.updating"
                        @change="onAllowedPermissionsChange(module, perm.key, ($event.target as HTMLInputElement).checked)"
                      />
                      <div class="flex-1">
                        <p class="font-semibold">{{ perm.key }}</p>
                        <p v-if="perm.description" class="text-[10px] text-slate-500 dark:text-slate-400">
                          {{ perm.description }}
                        </p>
                      </div>
                    </label>
                  </div>
                </div>
              </div>
              <p v-if="module.error" class="text-xs text-red-600 dark:text-red-400">
                {{ module.error }}
              </p>
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
import { computed, ref, useFetch, useI18n, useRoute, watch } from '#imports'
import { Icon } from '@iconify/vue'
import StatusPill from '~/components/shared/StatusPill.vue'
import type { ModuleStatus } from '~/lib/module-registry'
import type { ModuleStatusDto, PolicyMode } from '~/types/modules'

definePageMeta({
  layout: 'default'
})

const { t } = useI18n()
const route = useRoute()
const tenantId = computed(() => route.params.id as string)

type UiModule = ModuleStatusDto & {
  uiMode: PolicyMode
  uiAllowedPermissions: string[]
  updating?: boolean
  error?: string | null
}

const modeOptions: { value: PolicyMode }[] = [
  { value: 'inherit' },
  { value: 'default-closed' },
  { value: 'allowlist' },
  { value: 'blocked' }
]

const { data: tenantResponse } = await useFetch<{ tenant: { name: string } }>(() =>
  `/api/admin/tenants/${tenantId.value}`
)

const { data, pending, error, refresh } = await useFetch<{ modules: ModuleStatusDto[] }>(() =>
  tenantId.value ? `/api/admin/tenants/${tenantId.value}/modules` : null
)

const permissionCache = ref<
  Record<
    string,
    {
      loading: boolean
      error: string
      items: { key: string; description?: string | null }[]
    }
  >
>({})

const permissionState = (moduleKey: string) => {
  if (!permissionCache.value[moduleKey]) {
    permissionCache.value[moduleKey] = { loading: false, error: '', items: [] }
  }
  return permissionCache.value[moduleKey]
}

const loadModulePermissions = async (module: UiModule) => {
  const state = permissionState(module.key)
  if (state.loading || state.items.length) return
  state.loading = true
  state.error = ''
  try {
    const res = await $fetch<{ permissions: { key: string; description?: string | null }[] }>(
      `/api/modules/${module.key}/permissions`
    )
    state.items = res.permissions ?? []
  } catch (err: any) {
    state.error = err?.data?.message ?? err?.message ?? 'Kunde inte hämta permissions.'
  } finally {
    state.loading = false
  }
}

const ensurePermissionsLoaded = (module: UiModule) => {
  const state = permissionState(module.key)
  if (module.uiMode === 'allowlist' && !state.loading && state.items.length === 0) {
    void loadModulePermissions(module)
  }
}

const modules = computed(() => data.value?.modules ?? [])
const moduleRows = ref<UiModule[]>([])
const modulesError = computed(() => error.value?.message ?? '')
const tenantName = computed(() => tenantResponse.value?.tenant?.name ?? '...')

watch(
  modules,
  (list: ModuleStatusDto[] | undefined) => {
    const safeList = list ?? []
    moduleRows.value = safeList.map((module: ModuleStatusDto) => ({
      ...module,
      uiMode: module.tenantPolicy?.mode ?? 'inherit',
      uiAllowedPermissions:
        module.tenantPolicy?.allowedPermissions ??
        module.effectivePolicy.allowedPermissions ??
        module.requiredPermissions ??
        [],
      updating: false,
      error: null
    }))
    moduleRows.value.forEach(ensurePermissionsLoaded)
  },
  { immediate: true }
)

const searchInput = ref('')
const categoryFilter = ref<string>('all')

const categories = computed(() => {
  const unique = new Set(moduleRows.value.map((module) => module.category))
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
  return moduleRows.value.filter((module) => {
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

const updatePolicy = async (
  module: UiModule,
  patch: { mode?: PolicyMode; allowedPermissions?: string[] }
) => {
  module.updating = true
  module.error = null

  const payload = {
    moduleKey: module.key,
    mode: patch.mode ?? module.uiMode,
    allowedPermissions:
      (patch.mode ?? module.uiMode) === 'allowlist'
        ? patch.allowedPermissions ?? module.uiAllowedPermissions
        : []
  }

  try {
    const response = await $fetch<ModuleStatusDto>(`/api/admin/tenants/${tenantId.value}/modules`, {
      method: 'PUT',
      body: payload
    })

    module.uiMode = response.tenantPolicy?.mode ?? 'inherit'
    module.uiAllowedPermissions =
      response.tenantPolicy?.allowedPermissions ??
      response.effectivePolicy.allowedPermissions ??
      module.requiredPermissions ??
      []
    Object.assign(module, response)
  } catch (err: any) {
    module.error = err?.data?.message ?? err?.message ?? t('adminTenants.modules.updateFailed')
  } finally {
    module.updating = false
    await refresh()
  }
}

const onModeChange = async (module: UiModule, mode: PolicyMode) => {
  module.uiMode = mode
  if (mode !== 'allowlist') {
    module.uiAllowedPermissions = []
  } else {
    ensurePermissionsLoaded(module)
  }
  await updatePolicy(module, {
    mode,
    allowedPermissions: module.uiAllowedPermissions
  })
}

const onAllowedPermissionsChange = async (module: UiModule, key: string, checked: boolean) => {
  const next = new Set(module.uiAllowedPermissions)
  if (checked) {
    next.add(key)
  } else {
    next.delete(key)
  }
  module.uiAllowedPermissions = Array.from(next)
  await updatePolicy(module, {
    allowedPermissions: module.uiAllowedPermissions
  })
}
</script>

