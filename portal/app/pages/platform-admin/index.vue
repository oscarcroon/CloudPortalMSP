<template>
  <section class="space-y-8">
    <header class="space-y-2">
      <p class="text-xs uppercase tracking-[0.3em] text-slate-400 dark:text-slate-500">Superadmin</p>
      <h1 class="text-3xl font-semibold text-slate-900 dark:text-white">{{ t('admin.title') }}</h1>
      <p class="text-sm text-slate-500 dark:text-slate-400">
        {{ t('admin.subtitle') }}
      </p>
    </header>

    <!-- Infrastructure Status Cards -->
    <div class="grid gap-6 md:grid-cols-2 xl:grid-cols-3">
      <!-- Traefik Status Card -->
      <article class="flex flex-col rounded-2xl border border-slate-200 bg-white/90 p-5 shadow-card dark:border-slate-700 dark:bg-slate-900/70">
        <div class="flex items-center justify-between">
          <div class="flex items-center gap-3 text-slate-900 dark:text-slate-100">
            <div class="flex h-12 w-12 items-center justify-center rounded-xl bg-blue-500/10 text-blue-500">
              <Icon icon="mdi:router-network" class="h-5 w-5" />
            </div>
            <div>
              <p class="text-base font-semibold">{{ t('admin.infrastructure.traefik.title') }}</p>
              <p class="text-xs uppercase tracking-wide text-slate-400">
                {{ t('admin.infrastructure.traefik.category') }}
              </p>
            </div>
          </div>
          <span
            v-if="!traefikLoading"
            class="inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-medium"
            :class="traefikStatusClass"
          >
            <span class="h-2 w-2 rounded-full" :class="traefikDotClass" />
            {{ traefikStatusLabel }}
          </span>
        </div>
        
        <div v-if="traefikLoading" class="mt-4 flex items-center justify-center py-4">
          <Icon icon="mdi:loading" class="h-6 w-6 animate-spin text-slate-400" />
        </div>
        
        <div v-else-if="traefikError" class="mt-4 rounded-lg bg-red-50 p-3 text-sm text-red-600 dark:bg-red-500/10 dark:text-red-300">
          {{ traefikError }}
        </div>
        
        <div v-else class="mt-4 flex-1 space-y-3">
          <div class="grid grid-cols-2 gap-3 text-sm">
            <div class="rounded-lg bg-slate-50 p-3 dark:bg-white/5">
              <p class="text-xs text-slate-500 dark:text-slate-400">{{ t('admin.infrastructure.traefik.sftpHost') }}</p>
              <p class="font-mono text-xs text-slate-900 dark:text-slate-100">{{ traefikData?.sftpHost || '—' }}</p>
            </div>
            <div class="rounded-lg bg-slate-50 p-3 dark:bg-white/5">
              <p class="text-xs text-slate-500 dark:text-slate-400">{{ t('admin.infrastructure.traefik.domains') }}</p>
              <p class="text-lg font-bold text-slate-900 dark:text-slate-100">{{ traefikData?.stats?.totalDomains ?? 0 }}</p>
            </div>
          </div>
          
          <div v-if="traefikData?.stats" class="flex flex-wrap gap-2 text-xs">
            <span class="rounded-full bg-emerald-100 px-2 py-1 text-emerald-700 dark:bg-emerald-500/20 dark:text-emerald-300">
              {{ t('admin.infrastructure.traefik.tenants') }}: {{ traefikData.stats.tenantDomains }}
            </span>
            <span class="rounded-full bg-blue-100 px-2 py-1 text-blue-700 dark:bg-blue-500/20 dark:text-blue-300">
              {{ t('admin.infrastructure.traefik.orgs') }}: {{ traefikData.stats.orgDomains }}
            </span>
          </div>
          
          <!-- Connection error message -->
          <div v-if="traefikData?.connectionStatus === 'disconnected' && traefikData?.connectionError" class="rounded-lg bg-red-50 p-2 text-xs text-red-600 dark:bg-red-500/10 dark:text-red-300">
            <Icon icon="mdi:alert-circle" class="mr-1 inline-block h-3.5 w-3.5" />
            {{ traefikData.connectionError }}
          </div>
        </div>
        
        <div class="mt-4 flex items-center gap-2">
          <button
            class="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs font-medium text-slate-700 transition hover:bg-slate-50 disabled:opacity-50 dark:border-white/10 dark:bg-white/5 dark:text-slate-200 dark:hover:bg-white/10"
            :disabled="testingConnection"
            @click="testTraefikConnection"
          >
            <Icon v-if="testingConnection" icon="mdi:loading" class="h-3.5 w-3.5 animate-spin" />
            <Icon v-else icon="mdi:connection" class="h-3.5 w-3.5" />
            {{ t('admin.infrastructure.traefik.testConnection') }}
          </button>
          <button
            class="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs font-medium text-slate-700 transition hover:bg-slate-50 disabled:opacity-50 dark:border-white/10 dark:bg-white/5 dark:text-slate-200 dark:hover:bg-white/10"
            :disabled="traefikLoading"
            @click="refreshTraefikStatus"
          >
            <Icon icon="mdi:refresh" class="h-3.5 w-3.5" />
            {{ t('admin.infrastructure.traefik.refresh') }}
          </button>
        </div>
        
        <p v-if="connectionTestResult" class="mt-2 text-xs" :class="connectionTestResult.success ? 'text-emerald-600' : 'text-red-600'">
          {{ connectionTestResult.message }}
        </p>
      </article>
    </div>

    <!-- Admin Sections -->
    <div class="grid gap-6 md:grid-cols-2 xl:grid-cols-3">
      <article
        v-for="section in adminSections"
        :key="section.to"
        class="flex flex-col rounded-2xl border border-slate-200 bg-white/90 p-5 shadow-card transition hover:-translate-y-0.5 hover:border-brand hover:shadow-lg dark:border-slate-700 dark:bg-slate-900/70"
      >
        <div class="flex items-center gap-3 text-slate-900 dark:text-slate-100">
          <div class="flex h-12 w-12 items-center justify-center rounded-xl bg-brand/10 text-brand">
            <Icon :icon="section.icon" class="h-5 w-5" />
          </div>
          <div>
            <p class="text-base font-semibold">{{ section.title }}</p>
            <p v-if="section.category" class="text-xs uppercase tracking-wide text-slate-400">
              {{ section.category }}
            </p>
          </div>
        </div>
        <p class="mt-4 flex-1 text-sm text-slate-600 dark:text-slate-400">
          {{ section.description }}
        </p>
        <div class="mt-5 flex items-center justify-between">
          <span class="text-xs font-semibold uppercase tracking-wide text-slate-400">
            {{ section.badge }}
          </span>
          <NuxtLink
            :to="section.to"
            class="inline-flex items-center gap-2 rounded-full bg-brand px-4 py-2 text-sm font-semibold text-white transition hover:bg-brand/90"
          >
            {{ t('admin.open') }}
            <Icon icon="mdi:open-in-new" class="h-4 w-4" />
          </NuxtLink>
        </div>
      </article>
    </div>

    <div class="rounded-2xl border border-amber-200 bg-amber-50/80 p-4 text-sm text-amber-900 dark:border-amber-500/30 dark:bg-amber-500/10 dark:text-amber-100">
      <p class="font-semibold">{{ t('admin.quickTip') }}</p>
      <p class="mt-1">
        {{ t('admin.quickTipText') }}
      </p>
    </div>
  </section>
</template>

<script setup lang="ts">
import { Icon } from '@iconify/vue'
import { useI18n, ref, computed, onMounted } from '#imports'

definePageMeta({
  layout: 'default',
  superAdmin: true
})

const { t } = useI18n()

// Traefik status state
interface TraefikStats {
  totalDomains: number
  tenantDomains: number
  orgDomains: number
}

interface TraefikData {
  enabled: boolean
  sftpConfigured: boolean
  sftpHost: string | null
  sftpRemoteDir: string | null
  portalBackendUrl: string | null
  defaultDomain: string | null
  connectionStatus: 'connected' | 'disconnected' | 'unconfigured'
  connectionError: string | null
  stats: TraefikStats
  domains: Array<{
    type: 'tenant' | 'organization'
    id: string
    name: string
    slug: string
    customDomain: string
  }>
}

const traefikData = ref<TraefikData | null>(null)
const traefikLoading = ref(true)
const traefikError = ref<string | null>(null)
const testingConnection = ref(false)
const connectionTestResult = ref<{ success: boolean; message: string } | null>(null)

const traefikStatusClass = computed(() => {
  if (!traefikData.value) return 'bg-slate-100 text-slate-600 dark:bg-slate-500/10 dark:text-slate-400'
  if (!traefikData.value.enabled) return 'bg-slate-100 text-slate-600 dark:bg-slate-500/10 dark:text-slate-400'
  
  switch (traefikData.value.connectionStatus) {
    case 'connected':
      return 'bg-emerald-100 text-emerald-700 dark:bg-emerald-500/10 dark:text-emerald-300'
    case 'disconnected':
      return 'bg-red-100 text-red-700 dark:bg-red-500/10 dark:text-red-300'
    case 'unconfigured':
    default:
      return 'bg-amber-100 text-amber-700 dark:bg-amber-500/10 dark:text-amber-300'
  }
})

const traefikDotClass = computed(() => {
  if (!traefikData.value) return 'bg-slate-400'
  if (!traefikData.value.enabled) return 'bg-slate-400'
  
  switch (traefikData.value.connectionStatus) {
    case 'connected':
      return 'bg-emerald-500'
    case 'disconnected':
      return 'bg-red-500'
    case 'unconfigured':
    default:
      return 'bg-amber-500'
  }
})

const traefikStatusLabel = computed(() => {
  if (!traefikData.value) return t('admin.infrastructure.traefik.status.unknown')
  if (!traefikData.value.enabled) return t('admin.infrastructure.traefik.status.disabled')
  
  switch (traefikData.value.connectionStatus) {
    case 'connected':
      return t('admin.infrastructure.traefik.status.connected')
    case 'disconnected':
      return t('admin.infrastructure.traefik.status.disconnected')
    case 'unconfigured':
    default:
      return t('admin.infrastructure.traefik.status.notConfigured')
  }
})

async function refreshTraefikStatus() {
  traefikLoading.value = true
  traefikError.value = null
  connectionTestResult.value = null
  
  try {
    const response = await ($fetch as any)('/api/admin/traefik/status')
    traefikData.value = response
  } catch (err: any) {
    traefikError.value = err.data?.message || err.message || t('admin.infrastructure.traefik.error.fetchFailed')
  } finally {
    traefikLoading.value = false
  }
}

async function testTraefikConnection() {
  testingConnection.value = true
  connectionTestResult.value = null
  
  try {
    const response = await ($fetch as any)('/api/admin/traefik/test-connection', {
      method: 'POST'
    })
    connectionTestResult.value = {
      success: response.success,
      message: response.success 
        ? t('admin.infrastructure.traefik.connectionSuccess')
        : (response.error || t('admin.infrastructure.traefik.connectionFailed'))
    }
  } catch (err: any) {
    connectionTestResult.value = {
      success: false,
      message: err.data?.message || err.message || t('admin.infrastructure.traefik.connectionFailed')
    }
  } finally {
    testingConnection.value = false
  }
}

onMounted(() => {
  refreshTraefikStatus()
})

const adminSections = [
  {
    title: t('admin.sections.tenants.title'),
    description: t('admin.sections.tenants.description'),
    badge: t('admin.sections.tenants.badge'),
    category: t('admin.sections.tenants.category'),
    icon: 'mdi:account-group',
    to: '/tenant-admin/tenants'
  },
  {
    title: t('admin.sections.modules.title'),
    description: t('admin.sections.modules.description'),
    badge: t('admin.sections.modules.badge'),
    category: t('admin.sections.modules.category'),
    icon: 'mdi:puzzle-outline',
    to: '/platform-admin/modules'
  },
  {
    title: t('admin.sections.organizations.title'),
    description: t('admin.sections.organizations.description'),
    badge: t('admin.sections.organizations.badge'),
    category: t('admin.sections.organizations.category'),
    icon: 'mdi:office-building',
    to: '/platform-admin/organizations'
  },
  {
    title: t('admin.sections.globalBranding.title'),
    description: t('admin.sections.globalBranding.description'),
    badge: t('admin.sections.globalBranding.badge'),
    category: t('admin.sections.globalBranding.category'),
    icon: 'mdi:palette-outline',
    to: '/platform-admin/branding'
  },
  {
    title: t('admin.sections.rbacMatrix.title'),
    description: t('admin.sections.rbacMatrix.description'),
    badge: t('admin.sections.rbacMatrix.badge'),
    category: t('admin.sections.rbacMatrix.category'),
    icon: 'mdi:shield-key',
    to: '/platform-admin/rbac-matrix'
  },
  {
    title: t('admin.sections.auditLogs.title'),
    description: t('admin.sections.auditLogs.description'),
    badge: t('admin.sections.auditLogs.badge'),
    category: t('admin.sections.auditLogs.category'),
    icon: 'mdi:file-search-outline',
    to: '/platform-admin/audit-logs'
  },
  {
    title: t('admin.sections.adminEmail.title'),
    description: t('admin.sections.adminEmail.description'),
    badge: t('admin.sections.adminEmail.badge'),
    category: t('admin.sections.adminEmail.category'),
    icon: 'mdi:email-send-outline',
    to: '/platform-admin/settings/email'
  },
  {
    title: t('admin.sections.users.title'),
    description: t('admin.sections.users.description'),
    badge: t('admin.sections.users.badge'),
    category: t('admin.sections.users.category'),
    icon: 'mdi:shield-crown',
    to: '/platform-admin/users'
  },
  {
    title: t('admin.sections.customDomains.title'),
    description: t('admin.sections.customDomains.description'),
    badge: t('admin.sections.customDomains.badge'),
    category: t('admin.sections.customDomains.category'),
    icon: 'mdi:earth',
    to: '/tenant-admin/tenants?tab=domains'
  }
]
</script>
