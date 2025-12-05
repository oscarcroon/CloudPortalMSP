<template>
  <section class="space-y-6">
    <header class="space-y-1">
      <p class="text-xs uppercase tracking-[0.3em] text-slate-400 dark:text-slate-500">
        {{ t('settings.administration') }}
      </p>
      <h1 class="text-2xl font-semibold text-slate-900 dark:text-white">
        {{ t('settings.modules.title') }}
      </h1>
      <p class="text-sm text-slate-600 dark:text-slate-400">
        {{ t('settings.modules.pageDescription') }}
      </p>
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
            :placeholder="t('settings.modules.searchPlaceholder')"
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
          <option value="all">{{ t('settings.modules.filters.allCategories') }}</option>
          <option v-for="category in categories" :key="category" :value="category">
            {{ category }}
          </option>
        </select>
      </div>
      <div class="text-xs text-slate-500 dark:text-slate-300">
        {{ t('settings.modules.results', { count: filteredModules.length }) }}
      </div>
    </div>

    <div v-if="pending" class="rounded-xl border border-dashed border-slate-200 p-6 text-sm text-slate-600 dark:border-white/10 dark:text-slate-300">
      {{ t('settings.modules.loading') }}
    </div>

    <div
      v-else-if="!filteredModules.length"
      class="rounded-xl border border-slate-200 bg-white p-6 text-sm text-slate-600 shadow-sm dark:border-white/10 dark:bg-white/5 dark:text-slate-300"
    >
      {{ t('settings.modules.noModules') }}
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
                {{ t('adminModules.layerLabel') }} {{ module.layerKey }}
              </span>
              <StatusPill v-if="module.tenantPolicy?.mode === 'blocked'" variant="danger">
                {{ t('settings.modules.tenantBlocked') }}
              </StatusPill>
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
                {{ t('settings.modules.policyTitle') }}
              </p>
              <div class="flex flex-col gap-2">
                <label
                  v-for="option in modeOptions"
                  :key="option.value"
                  class="flex items-center gap-2 text-sm text-slate-700 dark:text-slate-200"
                >
                  <input
                    :checked="module.uiMode === option.value"
                    :disabled="module.updating || module.tenantPolicy?.mode === 'blocked'"
                    type="radio"
                    class="h-4 w-4 text-brand focus:ring-brand dark:border-white/20"
                    :value="option.value"
                    :name="`policy-${module.key}`"
                    @change="onModeChange(module, option.value)"
                  />
                  <span>{{ option.label }}</span>
                </label>
              </div>
              <div v-if="module.uiMode === 'allowlist'" class="space-y-1">
                <label class="text-xs text-slate-500 dark:text-slate-300">
                  {{ t('settings.modules.allowedRolesLabel') }}
                </label>
                <select
                  multiple
                  class="w-64 rounded-md border border-slate-300 bg-white px-3 py-2 text-sm text-slate-800 focus:border-brand focus:outline-none focus:ring-1 focus:ring-brand dark:border-white/10 dark:bg-slate-900 dark:text-white"
                  :value="module.uiAllowedRoles"
                  :disabled="module.updating || module.tenantPolicy?.mode === 'blocked' || (module.moduleRoles?.length ?? 0) === 0"
                  @change="onAllowedRolesChange(module, $event)"
                >
                  <option
                    v-for="role in module.moduleRoles"
                    :key="role.key"
                    :value="role.key"
                  >
                    {{ role.label }}
                  </option>
                </select>
              </div>
              <p v-if="module.error" class="text-xs text-red-600 dark:text-red-400">
                {{ module.error }}
              </p>
              <p v-else-if="module.tenantPolicy?.mode === 'blocked'" class="text-xs text-slate-500 dark:text-slate-300">
                {{ t('settings.modules.lockedByTenant') }}
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
              {{ t('settings.modules.routeLabel') }} {{ module.rootRoute }}
            </p>
          </div>
        </div>
      </div>
    </div>
  </section>
</template>

<script setup lang="ts">
import { computed, ref, useFetch, useI18n, watch } from '#imports'
import { Icon } from '@iconify/vue'
import StatusPill from '~/components/shared/StatusPill.vue'
import { useAuth } from '~/composables/useAuth'
import type { ModuleStatus } from '~/lib/module-registry'
import type { ModuleStatusDto, PolicyMode } from '~/types/modules'

definePageMeta({
  layout: 'default'
})

const { t } = useI18n()
const auth = useAuth()
const currentOrgId = computed(() => auth.currentOrg.value?.id)

type UiModule = ModuleStatusDto & {
  uiMode: PolicyMode
  uiAllowedRoles: string[]
  updating?: boolean
  error?: string | null
}

const modeOptions: { value: PolicyMode; label: string }[] = [
  { value: 'inherit', label: t('settings.modules.modes.inherit') },
  { value: 'default-closed', label: t('settings.modules.modes.defaultClosed') },
  { value: 'allowlist', label: t('settings.modules.modes.allowlist') },
  { value: 'blocked', label: t('settings.modules.modes.blocked') }
]

const { data, pending, error, refresh } = await useFetch<{ modules: ModuleStatusDto[] }>(() =>
  currentOrgId.value ? `/api/organizations/${currentOrgId.value}/modules` : null
)

const modules = computed(() => data.value?.modules ?? [])
const moduleRows = ref<UiModule[]>([])
const modulesError = computed(() => error.value?.message ?? '')

watch(
  modules,
  (list) => {
    moduleRows.value = list.map((module) => ({
      ...module,
      uiMode: module.orgPolicy?.mode ?? 'inherit',
      uiAllowedRoles: module.orgPolicy?.allowedRoles ?? module.effectivePolicy.allowedRoles ?? [],
      updating: false,
      error: null
    }))
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
  patch: { mode?: PolicyMode; allowedRoles?: string[] }
) => {
  if (module.tenantPolicy?.mode === 'blocked') {
    return
  }

  module.updating = true
  module.error = null

  const payload = {
    moduleKey: module.key,
    mode: patch.mode ?? module.uiMode,
    allowedRoles:
      (patch.mode ?? module.uiMode) === 'allowlist'
        ? patch.allowedRoles ?? module.uiAllowedRoles
        : []
  }

  try {
    const response = await $fetch<ModuleStatusDto>(
      `/api/organizations/${currentOrgId.value}/modules`,
      {
        method: 'PUT',
        body: payload
      }
    )

    module.uiMode = response.orgPolicy?.mode ?? 'inherit'
    module.uiAllowedRoles =
      response.orgPolicy?.allowedRoles ?? response.effectivePolicy.allowedRoles ?? []
    Object.assign(module, response)
  } catch (err: any) {
    module.error = err?.data?.message ?? err?.message ?? t('settings.modules.updateFailed')
  } finally {
    module.updating = false
    await refresh()
  }
}

const onModeChange = async (module: UiModule, mode: PolicyMode) => {
  module.uiMode = mode
  if (mode !== 'allowlist') {
    module.uiAllowedRoles = []
  }
  await updatePolicy(module, { mode, allowedRoles: module.uiAllowedRoles })
}

const onAllowedRolesChange = async (module: UiModule, event: Event) => {
  const target = event.target as HTMLSelectElement
  const values = Array.from(target.selectedOptions).map((option) => option.value)
  module.uiAllowedRoles = values
  await updatePolicy(module, { allowedRoles: values })
}
</script>

