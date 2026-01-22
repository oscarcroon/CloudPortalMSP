<template>
  <div class="flex min-h-screen items-center justify-center bg-slate-50 p-4 dark:bg-slate-900">
    <div class="w-full max-w-4xl">
      <!-- Header -->
      <div class="mb-8 text-center">
        <h1 class="text-3xl font-bold text-slate-900 dark:text-white">
          {{ t('orgSetup.title') }}
        </h1>
        <p class="mt-2 text-slate-600 dark:text-slate-400">
          {{ t('orgSetup.subtitle', { orgName: currentOrg?.name ?? '' }) }}
        </p>
      </div>

      <!-- Step indicator -->
      <div class="mb-8 flex items-center justify-center gap-4">
        <div
          v-for="(stepItem, index) in steps"
          :key="stepItem.id"
          class="flex items-center"
        >
          <div
            :class="[
              'flex h-10 w-10 items-center justify-center rounded-full text-sm font-semibold transition',
              currentStep >= index
                ? 'bg-brand text-white'
                : 'bg-slate-200 text-slate-500 dark:bg-slate-700 dark:text-slate-400'
            ]"
          >
            {{ index + 1 }}
          </div>
          <span
            :class="[
              'ml-2 text-sm font-medium',
              currentStep >= index
                ? 'text-brand'
                : 'text-slate-500 dark:text-slate-400'
            ]"
          >
            {{ stepItem.label }}
          </span>
          <div
            v-if="index < steps.length - 1"
            class="mx-4 h-0.5 w-12 bg-slate-200 dark:bg-slate-700"
          />
        </div>
      </div>

      <!-- Loading state -->
      <div v-if="loading" class="rounded-2xl bg-white p-8 text-center shadow-lg dark:bg-slate-800">
        <Icon icon="mdi:loading" class="mx-auto h-12 w-12 animate-spin text-brand" />
        <p class="mt-4 text-slate-600 dark:text-slate-400">{{ t('common.loading') }}</p>
      </div>

      <!-- Error state -->
      <div v-else-if="error" class="rounded-2xl bg-white p-8 shadow-lg dark:bg-slate-800">
        <div class="text-center">
          <Icon icon="mdi:alert-circle" class="mx-auto h-12 w-12 text-red-500" />
          <p class="mt-4 text-red-600 dark:text-red-400">{{ error }}</p>
          <button
            class="mt-4 rounded-lg bg-brand px-6 py-2 text-white hover:bg-brand-600"
            @click="loadSetupData"
          >
            {{ t('common.retry') }}
          </button>
        </div>
      </div>

      <!-- Step content -->
      <div v-else class="rounded-2xl bg-white p-8 shadow-lg dark:bg-slate-800">
        <!-- Step 1: Modules -->
        <div v-if="currentStep === 0">
          <h2 class="text-xl font-semibold text-slate-900 dark:text-white">
            {{ t('orgSetup.steps.modules.title') }}
          </h2>
          <p class="mt-2 text-sm text-slate-600 dark:text-slate-400">
            {{ t('orgSetup.steps.modules.description') }}
          </p>

          <div class="mt-6 flex items-center justify-between">
            <span class="text-sm text-slate-500 dark:text-slate-400">
              {{ enabledModulesCount }} / {{ availableModules.length }} {{ t('orgSetup.steps.modules.enabled') }}
            </span>
            <button
              type="button"
              class="rounded-lg border border-slate-200 px-4 py-2 text-sm font-semibold text-slate-700 hover:border-brand hover:text-brand dark:border-white/10 dark:text-white"
              @click="toggleAllModules"
            >
              {{ allModulesEnabled ? t('orgSetup.steps.modules.disableAll') : t('orgSetup.steps.modules.enableAll') }}
            </button>
          </div>

          <div class="mt-4 grid gap-3 sm:grid-cols-2">
            <div
              v-for="module in availableModules"
              :key="module.id"
              :class="[
                'rounded-lg border p-4 transition cursor-pointer',
                module.enabled
                  ? 'border-brand bg-brand/5 dark:bg-brand/10'
                  : 'border-slate-200 dark:border-white/10 hover:border-slate-300'
              ]"
              @click="toggleModule(module)"
            >
              <div class="flex items-start gap-3">
                <Icon
                  :icon="module.icon ?? 'mdi:puzzle'"
                  :class="[
                    'h-8 w-8 flex-shrink-0',
                    module.enabled ? 'text-brand' : 'text-slate-400'
                  ]"
                />
                <div class="flex-1 min-w-0">
                  <div class="flex items-center gap-2">
                    <span class="font-semibold text-slate-900 dark:text-white">
                      {{ module.name }}
                    </span>
                    <span
                      :class="[
                        'rounded-full px-2 py-0.5 text-xs font-medium',
                        getRiskClassStyle(module.riskClass)
                      ]"
                    >
                      {{ module.riskClass }}
                    </span>
                  </div>
                  <p class="mt-1 text-sm text-slate-500 dark:text-slate-400 line-clamp-2">
                    {{ module.description }}
                  </p>
                </div>
                <div class="flex-shrink-0">
                  <div
                    :class="[
                      'h-5 w-5 rounded-full border-2 flex items-center justify-center',
                      module.enabled
                        ? 'border-brand bg-brand'
                        : 'border-slate-300 dark:border-slate-600'
                    ]"
                  >
                    <Icon v-if="module.enabled" icon="mdi:check" class="h-3 w-3 text-white" />
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>

        <!-- Step 2: Templates -->
        <div v-if="currentStep === 1">
          <h2 class="text-xl font-semibold text-slate-900 dark:text-white">
            {{ t('orgSetup.steps.templates.title') }}
          </h2>
          <p class="mt-2 text-sm text-slate-600 dark:text-slate-400">
            {{ t('orgSetup.steps.templates.description') }}
          </p>

          <div class="mt-6 grid gap-4 sm:grid-cols-3">
            <div
              v-for="template in templates"
              :key="template.id"
              :class="[
                'rounded-lg border p-4 transition cursor-pointer',
                selectedTemplate === template.id
                  ? 'border-brand bg-brand/5 dark:bg-brand/10'
                  : 'border-slate-200 dark:border-white/10 hover:border-slate-300'
              ]"
              @click="selectedTemplate = template.id"
            >
              <div class="flex items-center justify-between">
                <span class="font-semibold text-slate-900 dark:text-white">
                  {{ template.name }}
                </span>
                <div
                  :class="[
                    'h-5 w-5 rounded-full border-2 flex items-center justify-center',
                    selectedTemplate === template.id
                      ? 'border-brand bg-brand'
                      : 'border-slate-300 dark:border-slate-600'
                  ]"
                >
                  <Icon v-if="selectedTemplate === template.id" icon="mdi:check" class="h-3 w-3 text-white" />
                </div>
              </div>
              <p class="mt-2 text-sm text-slate-500 dark:text-slate-400">
                {{ template.description }}
              </p>
            </div>
          </div>
        </div>

        <!-- Step 3: Default Group -->
        <div v-if="currentStep === 2">
          <h2 class="text-xl font-semibold text-slate-900 dark:text-white">
            {{ t('orgSetup.steps.defaultGroup.title') }}
          </h2>
          <p class="mt-2 text-sm text-slate-600 dark:text-slate-400">
            {{ t('orgSetup.steps.defaultGroup.description') }}
          </p>

          <div class="mt-6 space-y-3">
            <div
              v-for="group in orgGroups"
              :key="group.id"
              :class="[
                'rounded-lg border p-4 transition cursor-pointer',
                selectedDefaultGroup === group.id
                  ? 'border-brand bg-brand/5 dark:bg-brand/10'
                  : 'border-slate-200 dark:border-white/10 hover:border-slate-300'
              ]"
              @click="selectedDefaultGroup = group.id"
            >
              <div class="flex items-center justify-between">
                <div>
                  <span class="font-semibold text-slate-900 dark:text-white">
                    {{ group.name }}
                  </span>
                  <p class="mt-1 text-sm text-slate-500 dark:text-slate-400">
                    {{ group.description }}
                  </p>
                </div>
                <div
                  :class="[
                    'h-5 w-5 rounded-full border-2 flex items-center justify-center',
                    selectedDefaultGroup === group.id
                      ? 'border-brand bg-brand'
                      : 'border-slate-300 dark:border-slate-600'
                  ]"
                >
                  <Icon v-if="selectedDefaultGroup === group.id" icon="mdi:check" class="h-3 w-3 text-white" />
                </div>
              </div>
            </div>
          </div>
        </div>

        <!-- Navigation -->
        <div class="mt-8 flex items-center justify-between border-t border-slate-200 pt-6 dark:border-white/10">
          <button
            v-if="currentStep > 0"
            type="button"
            class="flex items-center gap-2 rounded-lg border border-slate-200 px-6 py-2 text-sm font-semibold text-slate-700 hover:border-brand hover:text-brand dark:border-white/10 dark:text-white"
            :disabled="saving"
            @click="currentStep--"
          >
            <Icon icon="mdi:arrow-left" class="h-4 w-4" />
            {{ t('common.back') }}
          </button>
          <div v-else />

          <button
            type="button"
            class="flex items-center gap-2 rounded-lg bg-brand px-6 py-2 text-sm font-semibold text-white hover:bg-brand-600 disabled:opacity-60"
            :disabled="saving || !canProceed"
            @click="nextStep"
          >
            <Icon v-if="saving" icon="mdi:loading" class="h-4 w-4 animate-spin" />
            <template v-else>
              {{ currentStep === steps.length - 1 ? t('orgSetup.complete') : t('common.next') }}
              <Icon v-if="currentStep < steps.length - 1" icon="mdi:arrow-right" class="h-4 w-4" />
            </template>
          </button>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed, ref, onMounted, useI18n, useRouter, navigateTo } from '#imports'
import { Icon } from '@iconify/vue'
import { useAuth } from '~/composables/useAuth'

definePageMeta({
  layout: false,
  middleware: ['auth']
})

const { t } = useI18n()
const router = useRouter()
const auth = useAuth()

const currentOrg = computed(() => auth.currentOrg.value)
const currentOrgId = computed(() => currentOrg.value?.id)

// Step state
const currentStep = ref(0)
const steps = computed(() => [
  { id: 'modules', label: t('orgSetup.steps.modules.label') },
  { id: 'templates', label: t('orgSetup.steps.templates.label') },
  { id: 'defaultGroup', label: t('orgSetup.steps.defaultGroup.label') }
])

// Loading/error state
const loading = ref(true)
const saving = ref(false)
const error = ref<string | null>(null)

// Data
interface SetupModule {
  id: string
  name: string
  description: string
  category: string
  icon?: string
  riskClass: 'high' | 'medium' | 'low'
  enabled: boolean
}

interface SetupTemplate {
  id: string
  name: string
  description: string
}

interface SetupGroup {
  id: string
  name: string
  description: string
}

const availableModules = ref<SetupModule[]>([])
const templates = ref<SetupTemplate[]>([])
const orgGroups = ref<SetupGroup[]>([])
const selectedTemplate = ref<string>('standard')
const selectedDefaultGroup = ref<string>('')

// Computed
const enabledModulesCount = computed(() => availableModules.value.filter(m => m.enabled).length)
const allModulesEnabled = computed(() => availableModules.value.every(m => m.enabled))

const canProceed = computed(() => {
  if (currentStep.value === 0) {
    return enabledModulesCount.value > 0
  }
  if (currentStep.value === 1) {
    return !!selectedTemplate.value
  }
  if (currentStep.value === 2) {
    return !!selectedDefaultGroup.value
  }
  return true
})

// Methods
function getRiskClassStyle(riskClass: string) {
  switch (riskClass) {
    case 'high':
      return 'bg-red-100 text-red-700 dark:bg-red-900/40 dark:text-red-300'
    case 'medium':
      return 'bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-300'
    case 'low':
      return 'bg-green-100 text-green-700 dark:bg-green-900/40 dark:text-green-300'
    default:
      return 'bg-slate-100 text-slate-700 dark:bg-slate-700 dark:text-slate-300'
  }
}

function toggleModule(module: SetupModule) {
  module.enabled = !module.enabled
}

function toggleAllModules() {
  const newState = !allModulesEnabled.value
  availableModules.value.forEach(m => {
    m.enabled = newState
  })
}

async function loadSetupData() {
  if (!currentOrgId.value) {
    error.value = 'No organization selected'
    return
  }

  loading.value = true
  error.value = null

  try {
    const response = await $fetch<{
      setupStatus: string
      availableModules: Array<{
        id: string
        name: string
        description: string
        category: string
        icon?: string
        riskClass: 'high' | 'medium' | 'low'
      }>
      templates: SetupTemplate[]
      groups: SetupGroup[]
      defaultGroupId?: string
    }>(`/api/organizations/${currentOrgId.value}/setup`)

    // If setup is already complete, redirect to home
    if (response.setupStatus === 'complete') {
      await navigateTo('/', { replace: true })
      return
    }

    availableModules.value = response.availableModules.map(m => ({
      ...m,
      enabled: false
    }))
    templates.value = response.templates
    orgGroups.value = response.groups
    
    // Set default selection for default group
    if (response.defaultGroupId) {
      selectedDefaultGroup.value = response.defaultGroupId
    } else if (response.groups.length > 0) {
      // Default to 'members' group if it exists
      const membersGroup = response.groups.find(g => g.name.toLowerCase().includes('member'))
      selectedDefaultGroup.value = membersGroup?.id ?? response.groups[0].id
    }
  } catch (e: any) {
    console.error('Failed to load setup data', e)
    error.value = e.message ?? t('common.error')
  } finally {
    loading.value = false
  }
}

async function saveModules() {
  if (!currentOrgId.value) return

  const enabledModuleIds = availableModules.value
    .filter(m => m.enabled)
    .map(m => m.id)

  // Enable each module
  for (const moduleId of enabledModuleIds) {
    await $fetch(`/api/organizations/${currentOrgId.value}/modules`, {
      method: 'PUT',
      body: {
        moduleKey: moduleId,
        mode: 'allowlist',
        enabled: true,
        disabled: false
      }
    })
  }
}

async function applyTemplate() {
  if (!currentOrgId.value || !selectedTemplate.value) return

  await $fetch(`/api/organizations/${currentOrgId.value}/setup/apply-template`, {
    method: 'POST',
    body: {
      templateId: selectedTemplate.value
    }
  })
}

async function setDefaultGroup() {
  if (!currentOrgId.value || !selectedDefaultGroup.value) return

  await $fetch(`/api/organizations/${currentOrgId.value}/setup/set-default-group`, {
    method: 'POST',
    body: {
      groupId: selectedDefaultGroup.value
    }
  })
}

async function completeSetup() {
  if (!currentOrgId.value) return

  await $fetch(`/api/organizations/${currentOrgId.value}/setup/complete`, {
    method: 'POST'
  })

  // Refresh auth to update setupStatus
  await auth.fetchMe()

  // Redirect to home
  await navigateTo('/', { replace: true })
}

async function nextStep() {
  saving.value = true
  error.value = null

  try {
    if (currentStep.value === 0) {
      // Save module selections
      await saveModules()
      currentStep.value++
    } else if (currentStep.value === 1) {
      // Apply template
      await applyTemplate()
      currentStep.value++
    } else if (currentStep.value === 2) {
      // Set default group and complete setup
      await setDefaultGroup()
      await completeSetup()
    }
  } catch (e: any) {
    console.error('Failed to save step', e)
    error.value = e.message ?? t('common.error')
  } finally {
    saving.value = false
  }
}

// Initialize
onMounted(() => {
  loadSetupData()
})
</script>
