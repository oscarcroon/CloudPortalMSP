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

    <div class="rounded-xl border border-slate-200 bg-white p-4 shadow-sm dark:border-white/10 dark:bg-white/5">
      <div class="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
        <div class="space-y-1">
          <p class="text-sm font-semibold text-slate-800 dark:text-slate-100">
            {{ t('settings.modules.groups.title') }}
          </p>
          <p class="text-sm text-slate-600 dark:text-slate-400">
            {{ t('settings.modules.groups.description') }}
          </p>
          <p class="text-xs text-slate-500 dark:text-slate-400">
            {{ t('settings.groups.open') }}
          </p>
        </div>
        <div class="flex items-center gap-2">
          <NuxtLink
            to="/settings/groups"
            class="inline-flex items-center gap-2 rounded-lg border border-slate-200 px-4 py-2 text-sm font-semibold text-slate-700 transition hover:border-brand hover:text-brand dark:border-white/10 dark:text-white dark:hover:border-brand"
          >
            {{ t('settings.groups.open') }}
          </NuxtLink>
          <button
            type="button"
            class="inline-flex items-center gap-2 rounded-lg border border-slate-200 px-3 py-2 text-xs font-semibold text-slate-700 shadow-sm transition hover:bg-slate-50 disabled:opacity-50 dark:border-white/10 dark:bg-white/5 dark:text-slate-100 dark:hover:bg-white/10"
            :disabled="groupsPending"
            @click="() => refreshGroups()"
          >
            <Icon icon="mdi:refresh" class="h-4 w-4" />
            {{ t('common.refresh') }}
          </button>
        </div>
      </div>
      <p class="mt-2 text-xs text-slate-500 dark:text-slate-400">
        <span v-if="groupsPending">{{ t('settings.modules.groups.loading') }}</span>
        <span v-else-if="!groups.length">{{ t('settings.modules.groups.empty') }}</span>
        <span v-else>{{ t('settings.modules.results', { count: groups.length }) }}</span>
      </p>
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
              <div class="flex items-center gap-2">
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
                <StatusPill v-if="module.tenantPolicy?.mode === 'blocked'" variant="danger">
                  {{ t('settings.modules.tenantBlocked') }}
                </StatusPill>
              </div>
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
                :disabled="!canManageModuleStatus(module) || module.updating"
                :class="[
                  'rounded-lg border px-3 py-1.5 text-sm font-medium transition focus:border-brand focus:outline-none focus:ring-1 focus:ring-brand',
                  canManageModuleStatus(module)
                    ? getStatusSelectClass(getModuleStatus(module))
                    : 'border-slate-300 bg-slate-100 text-slate-400 cursor-not-allowed dark:border-white/10 dark:bg-slate-800 dark:text-slate-500'
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
            
            <NuxtLink
              :to="module.rootRoute"
              :title="t('adminModules.openModule')"
              class="inline-flex items-center justify-center rounded-lg bg-brand p-2 text-white shadow transition hover:bg-brand-600"
              target="_blank"
              rel="noopener"
            >
              <Icon icon="mdi:open-in-new" class="h-5 w-5" />
            </NuxtLink>
          </div>
        </div>

        <!-- Status hint -->
        <p class="mt-1.5 text-xs text-slate-500 dark:text-slate-400">
          {{ t('adminTenants.modules.statusHints.' + getStatusHintKey(getModuleStatus(module))) }}
        </p>

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

        <!-- Description + error -->
        <div class="mt-3 flex items-start justify-between gap-4">
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
          <p v-if="module.error" class="shrink-0 text-xs text-red-600 dark:text-red-400">
            {{ module.error }}
          </p>
        </div>

        <!-- Collapsible details -->
        <div class="mt-2">
          <button
            type="button"
            class="inline-flex items-center gap-1 text-xs font-medium text-slate-500 transition hover:text-slate-700 dark:text-slate-400 dark:hover:text-slate-200"
            @click="toggleDetails(module.key)"
          >
            <Icon
              icon="mdi:chevron-right"
              :class="['h-4 w-4 transition-transform', expandedDetails[module.key] ? 'rotate-90' : '']"
            />
            {{ expandedDetails[module.key] ? t('common.hideDetails') : t('common.details') }}
          </button>
          <div v-if="expandedDetails[module.key]" class="mt-2 space-y-2">
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
        </div>

        <!-- Permissions links -->
        <div class="mt-4 flex flex-wrap items-center gap-3 border-t border-slate-200 pt-3 dark:border-white/10">
          <Icon icon="mdi:shield-key" class="h-4 w-4 text-slate-400" />
          <span class="text-xs text-slate-500 dark:text-slate-400">{{ t('settings.modules.permissions.hint') }}</span>
          <NuxtLink
            to="/settings/members"
            class="inline-flex items-center gap-1 rounded-md border border-slate-200 px-2.5 py-1 text-xs font-medium text-slate-700 transition hover:border-brand hover:text-brand dark:border-white/10 dark:text-slate-200 dark:hover:border-brand"
          >
            <Icon icon="mdi:account-group" class="h-3.5 w-3.5" />
            {{ t('settings.modules.permissions.members') }}
          </NuxtLink>
          <NuxtLink
            to="/settings/group-permissions"
            class="inline-flex items-center gap-1 rounded-md border border-slate-200 px-2.5 py-1 text-xs font-medium text-slate-700 transition hover:border-brand hover:text-brand dark:border-white/10 dark:text-slate-200 dark:hover:border-brand"
          >
            <Icon icon="mdi:shield-account" class="h-3.5 w-3.5" />
            {{ t('settings.modules.permissions.groupPermissions') }}
          </NuxtLink>
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
import type { ModuleStatusDto } from '~/types/modules'

definePageMeta({
  layout: 'default'
})

const { t } = useI18n()
const auth = useAuth()
const currentOrgId = computed(() => auth.currentOrg.value?.id)

type UiModule = ModuleStatusDto & {
  updating?: boolean
  error?: string | null
}

const { data, pending, error, refresh } = await (useFetch as any)(() =>
  currentOrgId.value ? `/api/organizations/${currentOrgId.value}/modules` : (null as unknown as string)
)
type GroupsResponse = { organizationId: string; groups: Array<{ id: string; name: string; description: string | null }> }
const {
  data: groupsData,
  pending: groupsPending,
  error: groupsError,
  refresh: refreshGroups
} = await (useFetch as any)(
  () => (currentOrgId.value ? `/api/organizations/${currentOrgId.value}/groups` : (null as unknown as string))
)

const modules = computed(() => (data.value as { modules: ModuleStatusDto[] } | null)?.modules ?? [])
const moduleRows = ref<UiModule[]>([])
const modulesError = computed(() => error.value?.message ?? '')
const groups = computed(() => (groupsData.value as GroupsResponse | null)?.groups ?? [])
const expandedGroups = ref<Record<string, boolean>>({})
const groupMembersInput = ref<Record<string, string>>({})
const savingGroupMembers = ref<Record<string, boolean>>({})
const groupsErrorMessage = computed(() => groupsError.value?.message ?? '')
const newGroupName = ref('')
const newGroupDescription = ref('')
const newGroupMembers = ref('')

watch(
  modules,
  (list?: ModuleStatusDto[]) => {
    moduleRows.value =
      list?.map((module) => ({
        ...module,
        updating: false,
        error: null
      })) ?? []
  },
  { immediate: true }
)

const expandedDetails = ref<Record<string, boolean>>({})
const toggleDetails = (key: string) => {
  expandedDetails.value[key] = !expandedDetails.value[key]
}

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

const updateModuleStatus = async (
  module: UiModule,
  patch: {
    enabled?: boolean
    disabled?: boolean
    comingSoonMessage?: string | null
  }
) => {
  module.updating = true
  module.error = null

  const payload: any = {
    moduleKey: module.key,
    mode: module.orgPolicy?.mode ?? 'inherit'
  }

  if (patch.enabled !== undefined) payload.enabled = patch.enabled
  if (patch.disabled !== undefined) payload.disabled = patch.disabled
  if (patch.comingSoonMessage !== undefined) payload.comingSoonMessage = patch.comingSoonMessage

  try {
    const response = await ($fetch as any)(
      `/api/organizations/${currentOrgId.value}/modules`,
      {
        method: 'PUT',
        body: payload
      }
    )

    Object.assign(module, response)
    if (response.orgPolicy) {
      module.orgPolicy = response.orgPolicy
    }
  } catch (err: any) {
    module.error = err?.data?.message ?? err?.message ?? t('settings.modules.updateFailed')
  } finally {
    module.updating = false
  }
}

type ModuleStatusValue = 'active' | 'disabled' | 'hidden' | 'coming-soon'

const getStatusSelectClass = (status: ModuleStatusValue) => {
  switch (status) {
    case 'active':
      return 'border-emerald-300 bg-emerald-50 text-emerald-700 dark:border-emerald-500 dark:bg-slate-800 dark:text-emerald-400'
    case 'disabled':
      return 'border-slate-300 bg-slate-100 text-slate-600 dark:border-slate-500 dark:bg-slate-800 dark:text-slate-300'
    case 'hidden':
      return 'border-red-300 bg-red-50 text-red-700 dark:border-red-500 dark:bg-slate-800 dark:text-red-400'
    case 'coming-soon':
      return 'border-amber-300 bg-amber-50 text-amber-700 dark:border-amber-500 dark:bg-slate-800 dark:text-amber-400'
    default:
      return 'border-slate-200 bg-white text-slate-700 dark:border-slate-600 dark:bg-slate-800 dark:text-slate-200'
  }
}

const getStatusHintKey = (status: string) => {
  return status === 'coming-soon' ? 'comingSoon' : status
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

const onStatusChange = async (module: UiModule, newStatus: ModuleStatusValue) => {
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
      const existingMessage = module.orgPolicy?.comingSoonMessage
      const isValidMessage = existingMessage && !existingMessage.startsWith('modules.')
      comingSoonMessage = isValidMessage ? existingMessage : 'Kommer snart! Kontakta oss för mer information.'
      break
  }

  await updateModuleStatus(module, {
    enabled,
    disabled,
    comingSoonMessage
  })
}

const onComingSoonMessageChange = async (module: UiModule, message: string) => {
  const trimmed = message.trim()
  // Only update if message actually changed
  const currentMessage = module.orgPolicy?.comingSoonMessage ?? ''
  if (trimmed === currentMessage) return

  await updateModuleStatus(module, {
    enabled: true,
    disabled: true,
    comingSoonMessage: trimmed || null
  })
}

const getModuleStatus = (module: UiModule): ModuleStatusValue => {
  // Check effectiveDisabled which cascades from global -> tenant -> org
  const isDisabled = module.effectiveDisabled === true
  // Use the resolved comingSoonMessage from backend (includes global/tenant/org)
  const comingSoonMessage = module.comingSoonMessage ?? 
    module.effectivePolicy?.comingSoonMessage ?? 
    module.orgPolicy?.comingSoonMessage ?? 
    module.tenantPolicy?.comingSoonMessage ?? 
    null
  
  if (isDisabled && comingSoonMessage) {
    return 'coming-soon'
  }
  if (isDisabled) {
    return 'disabled'
  }
  if (module.orgEnabled === false) {
    return 'hidden'
  }
  return 'active'
}

const getModuleStatusClass = (module: UiModule) => {
  const status = getModuleStatus(module)
  if (status === 'hidden') {
    return 'border-slate-300 bg-slate-50 dark:border-white/5 dark:bg-slate-900/50 opacity-60'
  }
  if (status === 'disabled' || status === 'coming-soon') {
    return 'border-slate-200 bg-slate-50 dark:border-white/10 dark:bg-slate-900/30 opacity-75'
  }
  return 'border-slate-200 bg-white dark:border-white/10 dark:bg-white/5'
}

const getModuleComingSoonMessage = (module: UiModule) => {
  // Use the resolved comingSoonMessage from backend (includes global/tenant/org)
  const message = module.comingSoonMessage ?? 
    module.effectivePolicy?.comingSoonMessage ?? 
    module.orgPolicy?.comingSoonMessage ?? 
    module.tenantPolicy?.comingSoonMessage ?? 
    null
  // Filter out broken translation keys that were saved by mistake
  if (message && message.startsWith('modules.')) {
    return null
  }
  return message
}

// Kontrollera om modulen kan hanteras på organisationsnivå
// Man kan hantera statusen om:
// 1. Modulen är enabled på tenant-nivå (inte inaktiverad av tenant)
// 2. Modulen är INTE disabled på TENANT nivå (kan inte överskridas)
// Men man SKA kunna hantera även om man själv (org) har inaktiverat/disabled modulen,
// annars kan man aldrig återställa!
const canManageModuleStatus = (module: UiModule): boolean => {
  // Om modulen är blocked på tenant-nivå, kan den inte hanteras
  if (module.tenantPolicy?.mode === 'blocked') {
    return false
  }
  // Om modulen är INAKTIVERAD (enabled=false) på TENANT nivå, kan den inte hanteras
  // Men om ORG själv har inaktiverat, ska vi kunna återaktivera
  const tenantInaktiverad = module.tenantPolicy?.enabled === false
  if (tenantInaktiverad) {
    return false
  }
  // Kontrollera om modulen är disabled på TENANT nivå (inte org-nivå)
  // Vi kan inte överskriva tenant disabled-status, men vi SKA kunna
  // ändra vår egen (org) disabled-status
  // tenantPolicy?.disabled = true betyder att tenant har disabled modulen
  if (module.tenantPolicy?.disabled) {
    return false
  }
  // Om modulen har "kommer snart" på tenant-nivå, kan den inte hanteras
  // (tenant's coming soon blockerar org från att ändra)
  if (module.tenantPolicy?.comingSoonMessage) {
    return false
  }
  return true
}
</script>


