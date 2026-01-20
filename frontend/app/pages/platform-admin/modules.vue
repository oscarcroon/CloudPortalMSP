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
          'rounded-xl border p-4 shadow-sm transition',
          getModuleStatusClass(module)
        ]"
      >
        <!-- Top row: Module name + Status dropdown + Open button -->
        <div class="flex items-center justify-between gap-4">
          <div class="flex min-w-0 flex-1 items-center gap-3">
            <Icon
              v-if="module.icon"
              :icon="module.icon"
              :class="[
                'h-7 w-7 flex-shrink-0',
                getModuleStatus(module) === 'disabled' || getModuleStatus(module) === 'coming-soon'
                  ? 'text-slate-400 dark:text-slate-500'
                  : 'text-brand'
              ]"
            />
            <div class="min-w-0 flex-1">
              <p
                :class="[
                  'text-lg font-semibold truncate',
                  getModuleStatus(module) === 'disabled' || getModuleStatus(module) === 'coming-soon'
                    ? 'text-slate-400 dark:text-slate-500'
                    : 'text-slate-900 dark:text-white'
                ]"
              >
                {{ module.name }}
              </p>
              <span class="text-xs text-slate-500 dark:text-slate-400">{{ module.category }} · {{ module.layerKey }}</span>
            </div>
          </div>
          
          <!-- Status + Open button (always on the right, horizontal) -->
          <div class="flex shrink-0 items-center gap-2">
            <!-- Status icon + dropdown -->
            <div class="flex items-center gap-1.5">
              <Icon 
                :icon="getStatusIcon(getModuleStatus(module))" 
                :class="['h-5 w-5', getStatusIconClass(getModuleStatus(module))]"
              />
              <select
                :value="getModuleStatus(module)"
                :disabled="module.updating"
                :class="[
                  'rounded-lg border px-3 py-1.5 text-sm font-medium transition focus:border-brand focus:outline-none focus:ring-1 focus:ring-brand',
                  getStatusSelectClass(getModuleStatus(module))
                ]"
                @change="onStatusChange(module, ($event.target as HTMLSelectElement).value as ModuleStatusValue)"
              >
                <option value="active">{{ t('modules.statusModal.options.active.title') }}</option>
                <option value="disabled">{{ t('modules.statusModal.options.disabled.title') }}</option>
                <option value="hidden">{{ t('modules.statusModal.options.hidden.title') }}</option>
                <option value="coming-soon">{{ t('modules.statusModal.options.comingSoon.title') }}</option>
              </select>
              <Icon v-if="module.updating" icon="mdi:loading" class="h-4 w-4 animate-spin text-brand" />
            </div>
            
            <UTooltip :text="t('adminModules.openModule')">
              <NuxtLink
                :to="module.rootRoute"
                class="inline-flex items-center justify-center rounded-lg bg-brand p-2 text-white shadow transition hover:bg-brand-600"
                target="_blank"
                rel="noopener"
              >
                <Icon icon="mdi:open-in-new" class="h-5 w-5" />
              </NuxtLink>
            </UTooltip>
          </div>
        </div>

        <!-- Coming soon message input (below top row) -->
        <div v-if="getModuleStatus(module) === 'coming-soon'" class="mt-3">
          <div class="flex items-center gap-2">
            <Icon icon="mdi:message-text-outline" class="h-4 w-4 text-amber-500" />
            <input
              :value="getModuleComingSoonMessage(module) ?? ''"
              type="text"
              :placeholder="t('modules.statusModal.comingSoonMessage.placeholder')"
              class="flex-1 rounded-lg border border-amber-300 bg-amber-50 px-3 py-1.5 text-sm text-amber-900 placeholder:text-amber-400 focus:border-amber-500 focus:outline-none focus:ring-1 focus:ring-amber-500 dark:border-amber-700 dark:bg-amber-900/30 dark:text-amber-100 dark:placeholder:text-amber-600"
              @blur="onComingSoonMessageChange(module, ($event.target as HTMLInputElement).value)"
              @keydown.enter="onComingSoonMessageChange(module, ($event.target as HTMLInputElement).value)"
            />
          </div>
        </div>

        <!-- Module details -->
        <div class="mt-4 flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
          <div class="space-y-2">
            <p
              :class="[
                'text-sm',
                getModuleStatus(module) === 'disabled' || getModuleStatus(module) === 'coming-soon'
                  ? 'text-slate-400 dark:text-slate-500'
                  : 'text-slate-600 dark:text-slate-400'
              ]"
            >
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

type ModuleWithEnabled = ModuleMeta & {
  enabled: boolean
  disabled?: boolean
  comingSoonMessage?: string | null
  updating?: boolean
}

type ModuleStatusValue = 'active' | 'disabled' | 'hidden' | 'coming-soon'

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

const getStatusSelectClass = (status: ModuleStatusValue) => {
  switch (status) {
    case 'active':
      return 'border-emerald-300 bg-emerald-50 text-emerald-700 dark:border-emerald-600 dark:bg-emerald-900/30 dark:text-emerald-300'
    case 'disabled':
      return 'border-slate-300 bg-slate-100 text-slate-600 dark:border-white/20 dark:bg-slate-800 dark:text-slate-300'
    case 'hidden':
      return 'border-red-300 bg-red-50 text-red-700 dark:border-red-600 dark:bg-red-900/30 dark:text-red-300'
    case 'coming-soon':
      return 'border-amber-300 bg-amber-50 text-amber-700 dark:border-amber-600 dark:bg-amber-900/30 dark:text-amber-300'
    default:
      return 'border-slate-200 bg-white text-slate-700 dark:border-white/10 dark:bg-white/5 dark:text-slate-200'
  }
}

const getStatusIcon = (status: ModuleStatusValue) => {
  switch (status) {
    case 'active':
      return 'mdi:check-circle'
    case 'disabled':
      return 'mdi:pause-circle'
    case 'hidden':
      return 'mdi:eye-off'
    case 'coming-soon':
      return 'mdi:clock-outline'
    default:
      return 'mdi:help-circle'
  }
}

const getStatusIconClass = (status: ModuleStatusValue) => {
  switch (status) {
    case 'active':
      return 'text-emerald-500 dark:text-emerald-400'
    case 'disabled':
      return 'text-slate-400 dark:text-slate-500'
    case 'hidden':
      return 'text-red-500 dark:text-red-400'
    case 'coming-soon':
      return 'text-amber-500 dark:text-amber-400'
    default:
      return 'text-slate-400'
  }
}

const onStatusChange = async (module: ModuleWithEnabled, newStatus: ModuleStatusValue) => {
  let enabled = true
  let disabled = false
  let comingSoonMessage: string | null = null

  switch (newStatus) {
    case 'active':
      enabled = true
      disabled = false
      comingSoonMessage = null
      break
    case 'disabled':
      enabled = true
      disabled = true
      comingSoonMessage = null
      break
    case 'hidden':
      enabled = false
      disabled = false
      comingSoonMessage = null
      break
    case 'coming-soon':
      enabled = true
      disabled = true
      // Keep existing message if switching to coming-soon, otherwise use default
      // Filter out broken translation key if it was saved by mistake
      const existingMessage = module.comingSoonMessage
      const isValidMessage = existingMessage && !existingMessage.startsWith('modules.')
      comingSoonMessage = isValidMessage ? existingMessage : 'Kommer snart! Kontakta oss för mer information.'
      break
  }

  module.updating = true
  try {
    await $fetch(`/api/admin/modules/${module.key}/enable`, {
      method: 'PUT',
      body: {
        enabled,
        disabled,
        comingSoonMessage
      }
    })
    module.enabled = enabled
    module.disabled = disabled
    module.comingSoonMessage = comingSoonMessage
    await refresh()
  } catch (error: any) {
    console.error('Failed to update module status:', error)
  } finally {
    module.updating = false
  }
}

const onComingSoonMessageChange = async (module: ModuleWithEnabled, message: string) => {
  const trimmed = message.trim()
  // Only update if message actually changed
  const currentMessage = module.comingSoonMessage ?? ''
  if (trimmed === currentMessage) return

  module.updating = true
  try {
    await $fetch(`/api/admin/modules/${module.key}/enable`, {
      method: 'PUT',
      body: {
        enabled: true,
        disabled: true,
        comingSoonMessage: trimmed || null
      }
    })
    module.comingSoonMessage = trimmed || null
    await refresh()
  } catch (error: any) {
    console.error('Failed to update coming soon message:', error)
  } finally {
    module.updating = false
  }
}

const getModuleStatus = (module: ModuleWithEnabled): 'active' | 'disabled' | 'hidden' | 'coming-soon' => {
  if (module.comingSoonMessage && module.disabled) {
    return 'coming-soon'
  }
  if (module.disabled) {
    return 'disabled'
  }
  if (module.enabled === false) {
    return 'hidden'
  }
  return 'active'
}

const getModuleStatusClass = (module: ModuleWithEnabled) => {
  const status = getModuleStatus(module)
  if (status === 'hidden') {
    return 'border-slate-300 bg-slate-50 dark:border-white/5 dark:bg-slate-900/50 opacity-60'
  }
  if (status === 'disabled' || status === 'coming-soon') {
    return 'border-slate-200 bg-slate-50 dark:border-white/10 dark:bg-slate-900/30 opacity-75'
  }
  return 'border-slate-200 bg-white dark:border-white/10 dark:bg-white/5'
}

const getModuleStatusBadgeVariant = (module: ModuleWithEnabled) => {
  const status = getModuleStatus(module)
  switch (status) {
    case 'active':
      return 'success'
    case 'disabled':
      return 'warning'
    case 'hidden':
      return 'danger'
    case 'coming-soon':
      return 'info'
    default:
      return 'success'
  }
}

const getModuleStatusLabel = (module: ModuleWithEnabled) => {
  const status = getModuleStatus(module)
  return t(`modules.statusModal.options.${status === 'coming-soon' ? 'comingSoon' : status}.title`)
}

const getModuleComingSoonMessage = (module: ModuleWithEnabled) => {
  const message = module.comingSoonMessage ?? null
  // Filter out broken translation keys that were saved by mistake
  if (message && message.startsWith('modules.')) {
    return null
  }
  return message
}
</script>

