<template>
  <section class="space-y-6">
    <header class="space-y-1">
      <p class="text-xs uppercase tracking-[0.3em] text-slate-400 dark:text-slate-500">
        Superadmin
      </p>
      <h1 class="text-2xl font-semibold text-slate-900 dark:text-white">
        {{ t('adminModules.title') }}
      </h1>
      <p class="text-sm text-slate-600 dark:text-slate-400">
        {{ t('adminModules.description') }}
      </p>
    </header>

    <div class="rounded-xl border border-slate-200 bg-white p-4 shadow-sm dark:border-white/10 dark:bg-white/5">
      <p class="text-sm text-slate-700 dark:text-slate-200">
        {{ t('adminModules.info') }}
      </p>
    </div>

    <div class="flex flex-col gap-3 rounded-xl border border-slate-200 bg-white p-4 shadow-sm dark:border-white/10 dark:bg-white/5 md:flex-row md:items-center md:justify-between">
      <div class="flex flex-1 flex-col gap-3 md:flex-row">
        <div class="relative flex-1">
          <input
            v-model="searchInput"
            type="text"
            class="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 pr-10 text-sm text-slate-900 focus:border-brand focus:outline-none focus:ring-1 focus:ring-brand dark:border-white/10 dark:bg-black/20 dark:text-white"
            :placeholder="t('adminModules.searchPlaceholder')"
          />
          <button
            v-if="searchInput"
            type="button"
            class="absolute right-2 top-1/2 -translate-y-1/2 rounded p-1 text-slate-400 transition hover:text-slate-600 dark:hover:text-slate-300"
            @click="searchInput = ''"
            :title="t('adminModules.clearSearch')"
          >
            <Icon icon="mdi:close-circle" class="h-5 w-5" />
          </button>
        </div>
        <select
          v-model="categoryFilter"
          class="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 focus:border-brand focus:outline-none focus:ring-1 focus:ring-brand dark:border-white/10 dark:bg-black/20 dark:text-white md:w-48"
        >
          <option value="all">{{ t('adminModules.filters.allCategories') }}</option>
          <option v-for="category in categories" :key="category" :value="category">
            {{ category }}
          </option>
        </select>
        <select
          v-model="scopeFilter"
          class="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 focus:border-brand focus:outline-none focus:ring-1 focus:ring-brand dark:border-white/10 dark:bg-black/20 dark:text-white md:w-40"
        >
          <option value="all">{{ t('adminModules.filters.allScopes') }}</option>
          <option v-for="scope in scopeOptions" :key="scope" :value="scope">
            {{ t(`adminModules.scopes.${scope}`) }}
          </option>
        </select>
      </div>
      <div class="text-xs text-slate-500 dark:text-slate-300">
        {{ t('adminModules.results', { count: filteredModules.length }) }}
      </div>
    </div>

    <div v-if="pending" class="rounded-xl border border-dashed border-slate-200 p-6 text-sm text-slate-600 dark:border-white/10 dark:text-slate-300">
      {{ t('adminModules.loading') }}
    </div>

    <div v-else class="space-y-3">
      <div
        v-for="module in filteredModules"
        :key="module.key"
        :class="[
          'rounded-xl border p-4 shadow-sm',
          module.enabled
            ? 'border-slate-200 bg-white dark:border-white/10 dark:bg-white/5'
            : 'border-slate-300 bg-slate-50 dark:border-white/5 dark:bg-slate-900/50'
        ]"
      >
        <div class="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
          <div class="space-y-2">
            <div class="flex items-center gap-2">
              <Icon
                v-if="module.icon"
                :icon="module.icon"
                :class="[
                  'h-6 w-6 flex-shrink-0',
                  module.enabled ? 'text-brand' : 'text-slate-400 dark:text-slate-500'
                ]"
              />
              <p class="text-lg font-semibold text-slate-900 dark:text-white">
                {{ module.name }}
              </p>
              <StatusPill :variant="module.enabled ? 'success' : 'danger'">
                {{
                  module.enabled
                    ? t('adminModules.enabledState.enabled')
                    : t('adminModules.enabledState.disabled')
                }}
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
            <div v-if="module.moduleRoles?.length" class="space-y-1">
              <p class="text-xs uppercase tracking-wide text-slate-500 dark:text-slate-400">
                {{ t('adminModules.moduleRoles') }}
              </p>
              <div class="flex flex-wrap gap-2">
                <span
                  v-for="role in module.moduleRoles"
                  :key="role.key"
                  class="rounded-md border border-slate-200 bg-indigo-50 px-2 py-1 text-[11px] text-indigo-700 dark:border-indigo-500/30 dark:bg-indigo-900/30 dark:text-indigo-100"
                >
                  {{ role.label }} <span class="text-[10px] text-indigo-500">({{ role.key }})</span>
                </span>
              </div>
            </div>
          </div>

          <div class="flex flex-col items-start gap-3 md:items-end">
            <div class="flex flex-col gap-2 rounded-lg border border-slate-200 p-3 dark:border-white/10">
              <p class="text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-300">
                {{ t('adminModules.enabledStatus') }}
              </p>
              <label class="flex items-center gap-2 text-sm text-slate-700 dark:text-slate-200">
                <input
                  :checked="module.enabled"
                  :disabled="module.updating"
                  type="checkbox"
                  class="h-4 w-4 rounded border-slate-300 text-brand focus:ring-brand dark:border-white/20"
                  @change="onEnabledChange(module, ($event.target as HTMLInputElement).checked)"
                />
                <span>{{ module.enabled ? t('adminModules.enabled') : t('adminModules.disabled') }}</span>
              </label>
              <p v-if="!module.enabled" class="text-xs text-slate-500 dark:text-slate-400">
                {{ t('adminModules.disabledNote') }}
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
              {{ t('adminModules.routeLabel') }} {{ module.rootRoute }}
            </p>
          </div>
        </div>
      </div>

      <div
        v-if="!filteredModules.length"
        class="rounded-xl border border-slate-200 bg-white p-6 text-sm text-slate-600 shadow-sm dark:border-white/10 dark:bg-white/5 dark:text-slate-300"
      >
        {{ t('adminModules.empty') }}
      </div>
    </div>
  </section>
</template>

<script setup lang="ts">
import { computed, ref, useI18n, useFetch } from '#imports'
import { Icon } from '@iconify/vue'
import StatusPill from '~/components/shared/StatusPill.vue'
import type { ModuleStatus } from '~/lib/module-registry'
import type { ModuleMeta } from '~/lib/module-registry'

definePageMeta({
  layout: 'default'
})

const { t } = useI18n()

type ModuleWithEnabled = ModuleMeta & { enabled: boolean; updating?: boolean }

const { data, pending, refresh } = await useFetch<{ modules: ModuleWithEnabled[] }>('/api/admin/modules')
const modules = computed(() => data.value?.modules ?? [])
const searchInput = ref('')
const categoryFilter = ref<string>('all')
const scopeFilter = ref<'all' | 'tenant' | 'org' | 'user'>('all')

const categories = computed(() => {
  const unique = new Set<string>(modules.value.map((module: ModuleWithEnabled) => module.category))
  return Array.from(unique)
})

const scopeOptions: Array<'tenant' | 'org' | 'user'> = ['tenant', 'org', 'user']

const normalized = (value: string) =>
  value
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .trim()

const filteredModules = computed(() => {
  const query = normalized(searchInput.value)
  return modules.value.filter((module: ModuleWithEnabled) => {
    const matchesSearch =
      !query ||
      normalized(module.name).includes(query) ||
      normalized(module.description).includes(query) ||
      normalized(module.category).includes(query)

    const matchesCategory = categoryFilter.value === 'all' || module.category === categoryFilter.value
    const matchesScope =
      scopeFilter.value === 'all' || module.scopes.includes(scopeFilter.value as any)

    return matchesSearch && matchesCategory && matchesScope
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

const onEnabledChange = async (module: ModuleWithEnabled, enabled: boolean) => {
  module.updating = true
  try {
    await $fetch(`/api/admin/modules/${module.key}/enable`, {
      method: 'PUT',
      body: { enabled }
    })
    module.enabled = enabled
    await refresh()
  } catch (error: any) {
    console.error('Failed to update module enabled status:', error)
    // Revert checkbox on error
    module.enabled = !enabled
  } finally {
    module.updating = false
  }
}
</script>

