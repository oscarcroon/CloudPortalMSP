<template>
  <section class="space-y-6">
    <header class="space-y-2">
      <NuxtLink
        :to="`/tenant-admin/tenants/${tenantId}`"
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

    <div v-if="resyncMessage" class="rounded-lg bg-emerald-500/10 px-4 py-3 text-sm text-emerald-600 dark:text-emerald-300">
      {{ resyncMessage }}
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
      <div class="flex items-center gap-3">
        <div class="text-xs text-slate-500 dark:text-slate-300">
          {{ t('adminTenants.modules.results', { count: filteredModules.length }) }}
        </div>
        <button
          v-if="isSuperAdmin"
          type="button"
          :disabled="resyncing"
          class="inline-flex items-center gap-2 rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-xs font-semibold text-slate-700 transition hover:bg-slate-50 disabled:opacity-50 dark:border-white/10 dark:bg-white/5 dark:text-slate-200 dark:hover:bg-white/10"
          @click="resyncModules"
        >
          <Icon :icon="resyncing ? 'mdi:loading' : 'mdi:refresh'" :class="{ 'animate-spin': resyncing }" class="h-4 w-4" />
          {{ resyncing ? t('adminTenants.modules.resyncing') : t('adminTenants.modules.resync') }}
        </button>
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

        <!-- Default for new organizations -->
        <div class="mt-3 flex flex-wrap items-center gap-3 rounded-lg border border-indigo-200 bg-indigo-50 px-4 py-2.5 dark:border-indigo-800 dark:bg-indigo-900/20">
          <Icon icon="mdi:office-building-plus" class="h-4 w-4 text-indigo-500" />
          <span class="text-xs font-semibold text-indigo-700 dark:text-indigo-300">
            {{ t('adminTenants.modules.defaultOrgState') }}
          </span>
          <select
            :value="module.uiDefaultOrgState"
            :disabled="module.updating"
            class="rounded-lg border border-indigo-300 bg-white px-3 py-1 text-xs font-medium text-indigo-700 focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500 dark:border-indigo-500 dark:bg-slate-800 dark:text-indigo-300"
            @change="onDefaultOrgStateChange(module, ($event.target as HTMLSelectElement).value as DefaultOrgState)"
          >
            <option value="active">{{ t('adminTenants.modules.defaultOrgStates.active') }}</option>
            <option value="disabled">{{ t('adminTenants.modules.defaultOrgStates.disabled') }}</option>
            <option value="hidden">{{ t('adminTenants.modules.defaultOrgStates.hidden') }}</option>
            <option value="coming-soon">{{ t('adminTenants.modules.defaultOrgStates.comingSoon') }}</option>
          </select>
          <div v-if="module.uiDefaultOrgState === 'coming-soon'" class="flex flex-1 items-center gap-2">
            <input
              :value="module.uiDefaultOrgComingSoonMessage ?? ''"
              type="text"
              :placeholder="t('adminTenants.modules.defaultOrgComingSoonMessage')"
              class="flex-1 rounded-lg border border-indigo-300 bg-white px-3 py-1 text-xs text-indigo-900 placeholder:text-indigo-400 focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500 dark:border-indigo-600 dark:bg-indigo-900/40 dark:text-indigo-100 dark:placeholder:text-indigo-500"
              @blur="onDefaultOrgComingSoonMessageChange(module, ($event.target as HTMLInputElement).value)"
              @keydown.enter="onDefaultOrgComingSoonMessageChange(module, ($event.target as HTMLInputElement).value)"
            />
          </div>
          <p class="mt-1 w-full text-xs text-indigo-500/80 dark:text-indigo-400/70">
            {{ t('adminTenants.modules.statusHints.' + getStatusHintKey(module.uiDefaultOrgState)) }}
          </p>
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
      </div>
    </div>
  </section>

</template>

<script setup lang="ts">
import { computed, ref, useFetch, useI18n, useRoute, watch } from '#imports'
import { useAuth } from '~/composables/useAuth'
import { Icon } from '@iconify/vue'
import type { DefaultOrgState, ModuleStatusDto } from '~/types/modules'

definePageMeta({
  layout: 'default'
})

const { t } = useI18n()
const route = useRoute()
const tenantId = computed(() => route.params.id as string)
const { user } = useAuth()
const isSuperAdmin = computed(() => user.value?.isSuperAdmin ?? false)

type UiModule = ModuleStatusDto & {
  uiDefaultOrgState: DefaultOrgState
  uiDefaultOrgComingSoonMessage: string | null
  updating?: boolean
  error?: string | null
}

const { data: tenantResponse } = await (useFetch as any)(() =>
  `/api/admin/tenants/${tenantId.value}`
)

const { data, pending, error, refresh } = await (useFetch as any)(() =>
  tenantId.value ? `/api/admin/tenants/${tenantId.value}/modules` : (null as unknown as string)
)

const modules = computed(() => (data.value as { modules: ModuleStatusDto[] } | null)?.modules ?? [])
const moduleRows = ref<UiModule[]>([])
const modulesError = computed(() => error.value?.message ?? '')
const tenantName = computed(() => tenantResponse.value?.tenant?.name ?? '...')
const resyncing = ref(false)
const resyncMessage = ref('')

const resyncModules = async () => {
  if (resyncing.value) return
  resyncing.value = true
  resyncMessage.value = ''
  try {
    const result = await ($fetch as any)('/api/admin/modules/resync', { method: 'POST' })
    resyncMessage.value = t('adminTenants.modules.resyncSuccess', { count: result.result?.modulesUpdated ?? 0 })
    await refresh()
  } catch (err: any) {
    resyncMessage.value = err?.data?.message ?? err?.message ?? 'Resync failed'
  } finally {
    resyncing.value = false
  }
}

watch(
  modules,
  (list: ModuleStatusDto[] | undefined) => {
    const safeList = list ?? []
    moduleRows.value = safeList.map((module: ModuleStatusDto) => ({
      ...module,
      uiDefaultOrgState: (module.tenantPolicy?.defaultOrgState as DefaultOrgState) ?? 'disabled',
      uiDefaultOrgComingSoonMessage: module.tenantPolicy?.defaultOrgComingSoonMessage ?? null,
      updating: false,
      error: null
    }))
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

const updatePolicy = async (
  module: UiModule,
  patch: {
    enabled?: boolean
    disabled?: boolean
    comingSoonMessage?: string | null
    defaultOrgState?: DefaultOrgState
    defaultOrgComingSoonMessage?: string | null
  }
) => {
  module.updating = true
  module.error = null

  const payload: any = {
    moduleKey: module.key,
    defaultOrgState: patch.defaultOrgState ?? module.uiDefaultOrgState,
    defaultOrgComingSoonMessage: patch.defaultOrgComingSoonMessage !== undefined ? patch.defaultOrgComingSoonMessage : module.uiDefaultOrgComingSoonMessage
  }

  if (patch.enabled !== undefined) payload.enabled = patch.enabled
  if (patch.disabled !== undefined) payload.disabled = patch.disabled
  if (patch.comingSoonMessage !== undefined) payload.comingSoonMessage = patch.comingSoonMessage

  try {
    const response = await ($fetch as any)(`/api/admin/tenants/${tenantId.value}/modules`, {
      method: 'PUT',
      body: payload
    })

    module.uiDefaultOrgState = (response.tenantPolicy?.defaultOrgState as DefaultOrgState) ?? 'disabled'
    module.uiDefaultOrgComingSoonMessage = response.tenantPolicy?.defaultOrgComingSoonMessage ?? null
    Object.assign(module, response)
    if (response.tenantPolicy) {
      module.tenantPolicy = response.tenantPolicy
    }
  } catch (err: any) {
    module.error = err?.data?.message ?? err?.message ?? t('adminTenants.modules.updateFailed')
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
      const existingMessage = module.tenantPolicy?.comingSoonMessage
      const isValidMessage = existingMessage && !existingMessage.startsWith('modules.')
      comingSoonMessage = isValidMessage ? existingMessage : 'Kommer snart! Kontakta oss för mer information.'
      break
  }

  await updatePolicy(module, {
    enabled,
    disabled,
    comingSoonMessage
  })
}

const onComingSoonMessageChange = async (module: UiModule, message: string) => {
  const trimmed = message.trim()
  // Only update if message actually changed
  const currentMessage = module.tenantPolicy?.comingSoonMessage ?? ''
  if (trimmed === currentMessage) return

  await updatePolicy(module, {
    enabled: true,
    disabled: true,
    comingSoonMessage: trimmed || null
  })
}

const onDefaultOrgStateChange = async (module: UiModule, newState: DefaultOrgState) => {
  module.uiDefaultOrgState = newState
  if (newState !== 'coming-soon') {
    module.uiDefaultOrgComingSoonMessage = null
  }
  await updatePolicy(module, {
    defaultOrgState: newState,
    defaultOrgComingSoonMessage: newState === 'coming-soon' ? (module.uiDefaultOrgComingSoonMessage ?? null) : null
  })
}

const onDefaultOrgComingSoonMessageChange = async (module: UiModule, message: string) => {
  const trimmed = message.trim()
  if (trimmed === (module.uiDefaultOrgComingSoonMessage ?? '')) return
  module.uiDefaultOrgComingSoonMessage = trimmed || null
  await updatePolicy(module, {
    defaultOrgState: 'coming-soon',
    defaultOrgComingSoonMessage: trimmed || null
  })
}

const getModuleStatus = (module: UiModule): ModuleStatusValue => {
  // Check tenantDisabled which cascades from global -> tenant
  const isDisabled = module.tenantDisabled === true
  // Use the resolved comingSoonMessage from backend (includes global/tenant/org)
  const comingSoonMessage = module.comingSoonMessage ?? 
    module.effectivePolicy?.comingSoonMessage ?? 
    module.tenantPolicy?.comingSoonMessage ?? 
    null
  
  if (isDisabled && comingSoonMessage) {
    return 'coming-soon'
  }
  if (isDisabled) {
    return 'disabled'
  }
  if (module.tenantEnabled === false) {
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
    module.tenantPolicy?.comingSoonMessage ?? 
    null
  // Filter out broken translation keys that were saved by mistake
  if (message && message.startsWith('modules.')) {
    return null
  }
  return message
}

// Kontrollera om modulen kan hanteras på tenant-nivå
// Logik:
// - Om modulen FINNS i listan, är den enabled på GLOBAL nivå (global inaktiverade visas inte)
// - Om tenantEnabled=false, är det alltid TENANT som har inaktiverat (inte global)
// - Om tenantDisabled=true men tenant inte har satt disabled, kommer det från GLOBAL eller DISTRIBUTÖR
// Man SKA alltid kunna hantera sin egen nivås status för att kunna återställa!
const canManageModuleStatus = (module: UiModule): boolean => {
  // Modulen finns i listan = den är enabled globalt
  // Så vi kan alltid hantera tenant's egen enabled/disabled status
  
  // Kontrollera om modulen är DISABLED på GLOBAL eller DISTRIBUTÖR nivå
  // Vi kan inte överskriva global/distributör disabled-status
  // tenantDisabled inkluderar global+distributör disabled, så vi behöver kontrollera
  // om disabled kommer från tenant-nivån eller högre nivå
  // Om tenantPolicy?.disabled är true, är det tenant som har disabled
  // Om tenantDisabled är true men tenantPolicy?.disabled inte är true,
  // då kommer disabled från global eller distributör nivå
  const disabledByHigherLevel = module.tenantDisabled && !module.tenantPolicy?.disabled
  if (disabledByHigherLevel) {
    return false
  }
  
  // Tenant kan alltid hantera sin egen status (enabled/disabled)
  return true
}
</script>

