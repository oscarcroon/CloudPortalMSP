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
            @click="refreshGroups"
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
        <div class="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
          <div class="space-y-2">
            <div class="flex items-center gap-2">
              <Icon
                v-if="module.icon"
                :icon="module.icon"
                :class="[
                  'h-6 w-6 flex-shrink-0',
                  getModuleStatus(module) === 'disabled' || getModuleStatus(module) === 'coming-soon'
                    ? 'text-slate-400 dark:text-slate-500'
                    : 'text-brand'
                ]"
              />
              <p
                :class="[
                  'text-lg font-semibold',
                  getModuleStatus(module) === 'disabled' || getModuleStatus(module) === 'coming-soon'
                    ? 'text-slate-400 dark:text-slate-500'
                    : 'text-slate-900 dark:text-white'
                ]"
              >
                {{ module.name }}
              </p>
              <StatusPill :variant="getModuleStatusBadgeVariant(module)">
                {{ getModuleStatusLabel(module) }}
              </StatusPill>
              <span class="rounded-full bg-slate-100 px-3 py-1 text-xs text-slate-700 dark:bg-white/10 dark:text-slate-200">
                {{ t('adminModules.layerLabel') }} {{ module.layerKey }}
              </span>
              <StatusPill v-if="module.tenantPolicy?.mode === 'blocked'" variant="danger">
                {{ t('settings.modules.tenantBlocked') }}
              </StatusPill>
            </div>
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
            <div
              v-if="getModuleStatus(module) === 'coming-soon' && getModuleComingSoonMessage(module)"
              class="rounded-lg border border-amber-200 bg-amber-50 p-3 text-sm text-amber-800 dark:border-amber-800 dark:bg-amber-900/20 dark:text-amber-200"
            >
              <p class="font-semibold">{{ t('modules.statusModal.options.comingSoon.title') }}</p>
              <p class="mt-1">{{ getModuleComingSoonMessage(module) }}</p>
            </div>
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
                    @change="onModeChange(module, option.value as PolicyMode)"
                  />
                  <span>{{ t(`settings.modules.modes.${option.value}`) }}</span>
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
                    {{ t('settings.modules.loadingPermissions') }}
                  </p>
                  <div v-else-if="!permissionState(module.key).items.length" class="text-slate-500 dark:text-slate-400">
                    {{ t('settings.modules.noPermissions') }}
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
              <p v-else-if="module.tenantPolicy?.mode === 'blocked'" class="text-xs text-slate-500 dark:text-slate-300">
                {{ t('settings.modules.lockedByTenant') }}
              </p>
            </div>
            <div class="relative">
              <button
                type="button"
                :disabled="!canManageModuleStatus(module)"
                :class="[
                  'inline-flex items-center gap-2 rounded-lg border px-4 py-2 text-sm font-semibold transition',
                  canManageModuleStatus(module)
                    ? 'border-slate-200 text-slate-800 hover:border-brand hover:text-brand dark:border-white/20 dark:text-white'
                    : 'border-slate-300 bg-slate-100 text-slate-400 cursor-not-allowed dark:border-white/10 dark:bg-slate-800 dark:text-slate-500'
                ]"
                :title="!canManageModuleStatus(module) ? t('settings.modules.cannotManageStatusReason') : ''"
                @click="canManageModuleStatus(module) && openStatusModal(module)"
              >
                <Icon icon="mdi:cog" class="h-4 w-4" />
                {{ t('settings.modules.manageStatus') }}
              </button>
              <p v-if="!canManageModuleStatus(module)" class="mt-1 text-xs text-slate-500 dark:text-slate-400">
                {{ t('settings.modules.cannotManageStatusReason') }}
              </p>
            </div>
            <button
              type="button"
              class="inline-flex items-center gap-2 rounded-lg border border-slate-200 px-4 py-2 text-sm font-semibold text-slate-800 transition hover:border-brand hover:text-brand dark:border-white/20 dark:text-white"
              @click="openAclDialog(module)"
            >
              <Icon icon="mdi:shield-lock" class="h-4 w-4" />
              {{ t('settings.modules.manageAcl') }}
            </button>
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

  <teleport to="body">
    <div
      v-if="aclDialog.open && aclDialog.module"
      class="fixed inset-0 z-40 flex items-center justify-center bg-black/60 p-4"
    >
      <div class="w-full max-w-2xl rounded-2xl bg-white p-6 shadow-xl dark:bg-slate-900">
        <div class="flex items-start justify-between">
          <div>
            <p class="text-xs uppercase tracking-[0.3em] text-slate-400 dark:text-slate-500">
              {{ t('settings.modules.aclTitle') }}
            </p>
            <h2 class="text-xl font-semibold text-slate-900 dark:text-white">
              {{ aclDialog.module.name }}
            </h2>
          </div>
          <button class="text-slate-500 hover:text-slate-700 dark:text-slate-300" @click="closeAcl">
            <Icon icon="mdi:close" class="h-5 w-5" />
          </button>
        </div>
        <p class="mt-2 text-sm text-slate-600 dark:text-slate-300">
          {{ t('settings.modules.aclDescription') }}
        </p>

        <div class="mt-4 grid grid-cols-1 gap-4 md:grid-cols-2">
          <div
            v-for="operation in ['read', 'create', 'update', 'delete']"
            :key="operation"
            class="rounded-lg border border-slate-200 p-3 dark:border-white/10"
          >
            <p class="text-sm font-semibold capitalize text-slate-800 dark:text-slate-100">
              {{ operation }}
            </p>
            <p class="text-xs text-slate-500 dark:text-slate-400">
              {{ t('settings.modules.aclOperationHint') }}
            </p>
            <div v-if="!groups.length" class="mt-2 rounded-md border border-dashed border-slate-200 p-3 text-xs text-slate-500 dark:border-white/10 dark:text-slate-400">
              {{ t('settings.modules.groups.empty') }}
            </div>
            <div v-else class="mt-2 flex flex-col gap-2">
              <label
                v-for="group in groups"
                :key="group.id"
                :class="[
                  'flex items-center gap-2 rounded-md border px-3 py-2 text-sm transition dark:border-white/10',
                  isAclGroupSelected(operation as 'create' | 'read' | 'update' | 'delete', group.id)
                    ? 'border-brand/60 bg-brand/5 text-brand-700 dark:text-brand-200'
                    : 'border-slate-200 text-slate-700 dark:text-slate-200'
                ]"
              >
                <input
                  type="checkbox"
                  class="h-4 w-4 text-brand focus:ring-brand dark:border-white/20"
                  :checked="isAclGroupSelected(operation as 'create' | 'read' | 'update' | 'delete', group.id)"
                  @change="toggleAclGroup(operation as 'create' | 'read' | 'update' | 'delete', group.id)"
                />
                <span class="flex-1">{{ group.name }}</span>
              </label>
            </div>
          </div>
        </div>

        <div v-if="aclDialog.error" class="mt-3 rounded-md bg-red-500/10 px-3 py-2 text-sm text-red-700 dark:text-red-300">
          {{ aclDialog.error }}
        </div>

        <div class="mt-4 flex items-center justify-end gap-3">
          <button
            type="button"
            class="rounded-lg border border-slate-200 px-4 py-2 text-sm font-semibold text-slate-700 transition hover:border-brand hover:text-brand dark:border-white/10 dark:text-white"
            @click="closeAcl"
          >
            {{ t('common.cancel') }}
          </button>
          <button
            type="button"
            class="inline-flex items-center gap-2 rounded-lg bg-brand px-4 py-2 text-sm font-semibold text-white shadow transition hover:bg-brand-600 disabled:opacity-60"
            :disabled="aclDialog.saving"
            @click="saveAcl"
          >
            <Icon icon="mdi:content-save" class="h-4 w-4" />
            {{ t('settings.modules.saveAcl') }}
          </button>
        </div>
      </div>
    </div>
  </teleport>

  <ModuleStatusModal
    :open="statusModal.open"
    :module="statusModal.module as any"
    :current-enabled="statusModal.module?.orgEnabled ?? true"
    :current-disabled="statusModal.module?.orgDisabled ?? false"
    :current-coming-soon-message="statusModal.module?.orgPolicy?.comingSoonMessage ?? null"
    @close="closeStatusModal"
    @save="onStatusSave"
  />
</template>

<script setup lang="ts">
import { computed, ref, useFetch, useI18n, watch } from '#imports'
import { Icon } from '@iconify/vue'
import StatusPill from '~/components/shared/StatusPill.vue'
import ModuleStatusModal from '~/components/modules/ModuleStatusModal.vue'
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

const { data, pending, error, refresh } = await useFetch<{ modules: ModuleStatusDto[] }>(() =>
  currentOrgId.value ? `/api/organizations/${currentOrgId.value}/modules` : null
)
const {
  data: groupsData,
  pending: groupsPending,
  error: groupsError,
  refresh: refreshGroups
} = await useFetch<{ organizationId: string; groups: Array<{ id: string; name: string; description: string | null }> }>(
  () => (currentOrgId.value ? `/api/organizations/${currentOrgId.value}/groups` : null)
)

const modules = computed(() => data.value?.modules ?? [])
const moduleRows = ref<UiModule[]>([])
const modulesError = computed(() => error.value?.message ?? '')
const groups = computed(() => groupsData.value?.groups ?? [])
const expandedGroups = ref<Record<string, boolean>>({})
const groupMembersInput = ref<Record<string, string>>({})
const savingGroupMembers = ref<Record<string, boolean>>({})
const groupsErrorMessage = computed(() => groupsError.value?.message ?? '')
const newGroupName = ref('')
const newGroupDescription = ref('')
const newGroupMembers = ref('')
const aclDialog = ref<{
  open: boolean
  module: UiModule | null
  operations: Record<'create' | 'read' | 'update' | 'delete', string[]>
  saving: boolean
  error: string | null
}>({
  open: false,
  module: null,
  operations: {
    create: [],
    read: [],
    update: [],
    delete: []
  },
  saving: false,
  error: null
})

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
  } catch (err) {
    const anyErr = err as any
    state.error = anyErr?.data?.message ?? anyErr?.message ?? 'Kunde inte hämta permissions.'
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

watch(
  modules,
  (list?: ModuleStatusDto[]) => {
    moduleRows.value =
      list?.map((module) => ({
      ...module,
      uiMode: module.orgPolicy?.mode ?? 'inherit',
        uiAllowedPermissions:
          module.orgPolicy?.allowedPermissions ??
          module.effectivePolicy.allowedPermissions ??
          module.requiredPermissions ??
          [],
      updating: false,
      error: null
      })) ?? []
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
  patch: {
    mode?: PolicyMode
    allowedPermissions?: string[]
    enabled?: boolean
    disabled?: boolean
    comingSoonMessage?: string | null
  }
) => {
  if (module.tenantPolicy?.mode === 'blocked') {
    return
  }

  module.updating = true
  module.error = null

  const payload: any = {
    moduleKey: module.key,
    mode: patch.mode ?? module.uiMode,
    allowedPermissions:
      (patch.mode ?? module.uiMode) === 'allowlist'
        ? patch.allowedPermissions ?? module.uiAllowedPermissions
        : []
  }

  if (patch.enabled !== undefined) payload.enabled = patch.enabled
  if (patch.disabled !== undefined) payload.disabled = patch.disabled
  if (patch.comingSoonMessage !== undefined) payload.comingSoonMessage = patch.comingSoonMessage

  try {
    const response = await $fetch<ModuleStatusDto>(
      `/api/organizations/${currentOrgId.value}/modules`,
      {
        method: 'PUT',
        body: payload
      }
    )

    module.uiMode = response.orgPolicy?.mode ?? 'inherit'
    // Update the module with response data, including status fields
    Object.assign(module, response)
    // Ensure orgPolicy is updated with the new enabled/disabled values
    if (response.orgPolicy) {
      module.orgPolicy = response.orgPolicy
    }
  } catch (err: any) {
    module.error = err?.data?.message ?? err?.message ?? t('settings.modules.updateFailed')
  } finally {
    module.updating = false
    await refresh()
  }
}

const openAclDialog = async (module: UiModule) => {
  if (!currentOrgId.value) return
  aclDialog.value = {
    open: true,
    module,
    operations: {
      create: [],
      read: [],
      update: [],
      delete: []
    },
    saving: false,
    error: null
  }

  try {
    const res = await $fetch<{
      acl: Record<'create' | 'read' | 'update' | 'delete', { groupId: string }[]>
    }>(`/api/organizations/${currentOrgId.value}/plugins/${module.key}/acl`)
    aclDialog.value.operations = {
      create: res.acl.create.map((item) => item.groupId),
      read: res.acl.read.map((item) => item.groupId),
      update: res.acl.update.map((item) => item.groupId),
      delete: res.acl.delete.map((item) => item.groupId)
    }
  } catch (err: any) {
    aclDialog.value.error = err?.data?.message ?? err?.message ?? 'Kunde inte läsa ACL'
  }
}

const saveAcl = async () => {
  if (!currentOrgId.value || !aclDialog.value.module) return
  aclDialog.value.saving = true
  aclDialog.value.error = null
  try {
    await $fetch(`/api/organizations/${currentOrgId.value}/plugins/${aclDialog.value.module.key}/acl`, {
      method: 'PUT',
      body: { operations: aclDialog.value.operations }
    })
    aclDialog.value.open = false
  } catch (err: any) {
    aclDialog.value.error = err?.data?.message ?? err?.message ?? 'Kunde inte spara ACL'
  } finally {
    aclDialog.value.saving = false
  }
}

const closeAcl = () => {
  aclDialog.value.open = false
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

type AclOperation = 'create' | 'read' | 'update' | 'delete'

const isAclGroupSelected = (operation: AclOperation, groupId: string) =>
  (aclDialog.value.operations[operation] ?? []).includes(groupId)

const toggleAclGroup = (operation: AclOperation, groupId: string) => {
  const current = new Set(aclDialog.value.operations[operation] ?? [])
  if (current.has(groupId)) {
    current.delete(groupId)
  } else {
    current.add(groupId)
  }
  aclDialog.value.operations[operation] = Array.from(current)
}

const statusModal = ref<{
  open: boolean
  module: UiModule | null
}>({
  open: false,
  module: null
})

const openStatusModal = (module: UiModule) => {
  statusModal.value = {
    open: true,
    module
  }
}

const closeStatusModal = () => {
  statusModal.value = {
    open: false,
    module: null
  }
}

const onStatusSave = async (data: { enabled: boolean; disabled: boolean; comingSoonMessage: string | null }) => {
  if (!statusModal.value.module) return

  const module = statusModal.value.module
  await updatePolicy(module, {
    enabled: data.enabled,
    disabled: data.disabled,
    comingSoonMessage: data.comingSoonMessage
  } as any)
  closeStatusModal()
}

const getModuleStatus = (module: UiModule): 'active' | 'disabled' | 'hidden' | 'coming-soon' => {
  const policy = module.orgPolicy
  if (policy?.comingSoonMessage && policy?.disabled) {
    return 'coming-soon'
  }
  if (policy?.disabled) {
    return 'disabled'
  }
  if (policy?.enabled === false || module.orgEnabled === false) {
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

const getModuleStatusBadgeVariant = (module: UiModule) => {
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

const getModuleStatusLabel = (module: UiModule) => {
  const status = getModuleStatus(module)
  return t(`modules.statusModal.options.${status === 'coming-soon' ? 'comingSoon' : status}.title`)
}

const getModuleComingSoonMessage = (module: UiModule) => {
  return module.orgPolicy?.comingSoonMessage ?? null
}

// Kontrollera om modulen kan hanteras på organisationsnivå
// Modulen måste vara aktiverad på tenant-nivå för att kunna hanteras
const canManageModuleStatus = (module: UiModule): boolean => {
  // Om modulen är blocked på tenant-nivå, kan den inte hanteras
  if (module.tenantPolicy?.mode === 'blocked') {
    return false
  }
  // Om modulen inte är enabled på tenant-nivå, kan den inte hanteras
  if (!module.tenantEnabled) {
    return false
  }
  // Om modulen är disabled på tenant-nivå, kan den inte hanteras
  if (module.tenantDisabled) {
    return false
  }
  // Om modulen har "kommer snart" på tenant-nivå, kan den inte hanteras
  if (module.tenantPolicy?.comingSoonMessage) {
    return false
  }
  return true
}
</script>


